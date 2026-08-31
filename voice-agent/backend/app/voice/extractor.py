"""Transcript -> Transaction.

Pure logic: no mic, no network, no clock beyond the timestamp. Feed it a string
and the merchant's product list, get a PENDING transaction back. Every rule
here exists because merchants don't speak in a fixed format:

    "two samosas for fifty rupees"   -> Samosa x2, 50     (total)
    "two samosa each 50 rupees"      -> Samosa x2, 100    (rate x quantity)
    "10 rupees 5 samosa"             -> Samosa x5, 50     (rate stated first)
    "10 rupees teas for 12"          -> Tea x12, 120      (rate stated first)
    "5 rupees 18 chocolate"          -> Chocolate x18, 90 (item not in catalog)
    "tea twenty rupees"              -> Tea x1, 20
    "two teas"                       -> Tea x2, 20        (priced from catalog)
    "100 rupees"                     -> no item, 100
    "chai do sau"                    -> Tea x1, 200       (aliases + Hindi)

The central question is whether the amount heard is the *total* or the *price
of one*. Signals decide it, in order: "for" introduces a total ("for fifty
rupees"); an explicit per-unit word makes it a rate ("each", "per"); a price
spoken *before* the goods is a rate, because a total lands at the end of a
sentence and never in front of what was bought; otherwise it is the total.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from ..config import settings
from ..models.product import Product
from ..models.transaction import Transaction, TransactionStatus
from .numbers import HINDI, SCALES, TEENS, TENS, UNITS, SpokenNumber, find_numbers

# How close a garbled word has to be to a catalog entry to count as that item.
# "some also" -> "samosas" is the job; "coffee" -> "toffee" is what to avoid.
FUZZY_ITEM_MIN = 0.66

_NUMBER_WORDS = set(UNITS) | set(TEENS) | set(TENS) | set(SCALES) | set(HINDI)


def _similar_enough(heard: str, term: str, minimum: float) -> bool:
    """Fuzzy match with a length guard.

    A mishearing is roughly the same length as the word it replaced —
    "some also" for "samosas". Without this, "chocolates" scores well enough
    against "chais" to sell someone a tea.
    """
    if not heard or not term or heard[0] != term[0]:
        # Mishearings keep the opening sound: "samosa" becomes "some also",
        # never "masala tea". Without this, long words find long partners.
        return False
    if abs(len(heard) - len(term)) > max(2, 0.35 * max(len(heard), len(term))):
        return False
    return SequenceMatcher(None, heard, term).ratio() >= minimum


CURRENCY_RE = re.compile(
    r"(₹|\brupees?\b|\brupaye?\b|\brupaiya\b|\brupya\b|\brs\.?\b|\bbucks?\b"
    r"|\brepeat\b|\brepeats\b|\brubies\b|\bruby\b|\broopees?\b|\brupiah\b"
    r"|\brepeated\b|\brupess\b|\bripped\b)",
    re.IGNORECASE,
)
FOR_RE = re.compile(r"\bfor\b", re.IGNORECASE)

# "each" and friends: the amount is the price of one, not the bill.
PER_UNIT_RE = re.compile(
    r"\b(each|apiece|per|a ?piece|per piece|per plate|per unit|ek ka|har ek|prati)\b",
    re.IGNORECASE,
)

# Words that are never a product name, so an unknown item guess skips them.
NOT_AN_ITEM = {
    "rupees", "rupee", "rupaye", "rupay", "rs", "buck", "bucks", "each",
    "apiece", "per", "piece", "pieces", "plate", "plates", "unit", "units",
    "and", "the", "for", "of", "at", "to", "a", "an", "is", "it", "that",
    "this", "total", "please", "thanks", "thank", "sir", "madam", "bhaiya",
    "ok", "okay", "yes", "no", "more", "less", "only", "just", "give", "want",
}

# Words a recognizer produces instead of a digit. Only applied when the next
# word is a product, so "two samosas for fifty rupees" keeps its "for" while
# "for samosas" becomes "four samosas".
DIGIT_HOMOPHONES = {
    "why": "five", "fife": "five", "file": "five", "hi": "five",
    "too": "two", "to": "two", "tu": "two", "dew": "two", "due": "two",
    "for": "four", "fore": "four", "far": "four",  # see FOR_LIKE below
    "tree": "three", "free": "three", "thee": "three",
    "sex": "six", "sicks": "six", "seeks": "six",
    "sever": "seven", "heaven": "seven",
    "wait": "eight", "eat": "eight",
    "wine": "nine", "night": "nine", "nain": "nine",
    "tan": "ten", "den": "ten", "then": "ten", "than": "ten",
    "wan": "one", "when": "one",
}

# Homophones of "four" that are also ordinary English; only repaired sentence
# initially.
FOR_LIKE = {"for", "fore", "far"}

# Things people say that are commands, not purchases.
CANCEL_RE = re.compile(r"\b(cancel|undo|delete|remove|scratch that|galat)\b", re.IGNORECASE)


@dataclass
class ExtractionResult:
    transaction: Transaction | None
    reason: str = ""
    cancel: bool = False

    @property
    def ok(self) -> bool:
        return self.transaction is not None


@dataclass
class _ItemHit:
    product: Product
    start: int
    end: int


class TransactionExtractor:
    def __init__(self, products: list[Product] | None = None) -> None:
        self.products = products or []

    def set_products(self, products: list[Product]) -> None:
        self.products = products

    # -- public ----------------------------------------------------------

    def extract(self, raw_text: str, confidence: float | None = None) -> ExtractionResult:
        text = self._repair_counts(" ".join(raw_text.lower().split()))
        if not text:
            return ExtractionResult(None, "empty transcript")

        if CANCEL_RE.search(text):
            return ExtractionResult(None, "cancel command", cancel=True)

        numbers = find_numbers(text)
        item = self._find_item(text) or self._guess_item(text, numbers)
        heard = self._find_amount_number(text, numbers, item)

        quantity, amount, unit_price = self._resolve(text, numbers, item, heard)

        if amount is None:
            if numbers and item is None:
                return ExtractionResult(
                    None, "heard a number but no item or rupees — nothing saved"
                )
            return ExtractionResult(None, "no amount heard")
        if amount <= 0:
            return ExtractionResult(None, "amount was zero")
        if amount > settings.MAX_AMOUNT:
            # "hundred four hundred four hundred rupees" parsed to 1,040,400.
            # A counter sale is not a lakh; that transcript was noise.
            return ExtractionResult(
                None, f"₹{amount:,.0f} is too large to be a sale — nothing saved"
            )
        if confidence is not None and confidence < settings.MIN_CONFIDENCE:
            return ExtractionResult(
                None, "didn't catch that clearly — say it again"
            )

        return ExtractionResult(
            Transaction(
                item=item.product.name if item else None,
                quantity=quantity if item else None,
                amount=float(amount),
                unit_price=unit_price,
                status=TransactionStatus.pending,
                raw_text=raw_text.strip(),
                confidence=confidence,
            )
        )

    # -- deciding what the numbers meant ---------------------------------

    def _resolve(
        self,
        text: str,
        numbers: list[SpokenNumber],
        item: _ItemHit | None,
        heard: SpokenNumber | None,
    ) -> tuple[int | None, float | None, float | None]:
        """Return (quantity, amount, unit_price)."""
        if item is None:
            return None, (heard.value if heard else None), None

        others = [n for n in numbers if n is not heard]
        before = [n for n in others if n.end <= item.start]
        after = [n for n in others if n.start >= item.end]

        # No amount spoken at all: "two teas" — price it from the catalog.
        if heard is None:
            count = before[-1] if before else (after[0] if after else None)
            quantity = self._as_count(count)
            unit = item.product.price
            if unit <= 0:  # a guessed item has no price; don't invent one
                return quantity, None, None
            return quantity, round(unit * quantity, 2), unit

        # 1. "two samosas each fifty rupees" — an explicit rate beats
        #    everything, including a "for" elsewhere in the sentence.
        if PER_UNIT_RE.search(text):
            counts = before or after
            return self._rate(heard, counts[-1] if counts else None)

        # 2. "for fifty rupees" states the bill. Strongest signal for a total,
        #    so it is checked before position.
        if self._introduced_by_for(text, numbers, heard):
            return self._as_count(before[-1] if before else None), heard.value, None

        # 3. A price spoken *before* the goods is a rate: "ten rupees five
        #    samosa", "ten rupee teas for twelve". A total lands at the end of
        #    a sentence, never in front of what was bought.
        if heard.end <= item.start:
            counts = before or after
            return self._rate(heard, counts[-1] if counts else None)

        # 4. Otherwise the amount is the bill: "two samosas fifty rupees".
        quantity = self._as_count(before[-1] if before else None)
        return quantity, heard.value, None

    def _rate(
        self, heard: SpokenNumber, count: SpokenNumber | None
    ) -> tuple[int, float, float | None]:
        """Multiply a per-unit price by the count. One of something is just
        its price, so no unit_price is recorded in that case."""
        quantity = self._as_count(count)
        if quantity > 1:
            return quantity, round(heard.value * quantity, 2), heard.value
        return quantity, heard.value, None

    @staticmethod
    def _introduced_by_for(
        text: str, numbers: list[SpokenNumber], heard: SpokenNumber
    ) -> bool:
        """True for "...for fifty rupees" — a "for" leading into the amount
        with no other number in between."""
        priors = [m for m in FOR_RE.finditer(text) if m.end() <= heard.start]
        if not priors:
            return False
        gap_start = priors[-1].end()
        return not any(n.start >= gap_start and n.end <= heard.start for n in numbers)

    @staticmethod
    def _as_count(number: SpokenNumber | None) -> int:
        """A quantity has to be a small whole number; anything else means the
        word was never a count, so fall back to one."""
        if number is None:
            return 1
        value = number.value
        if value <= 0 or value != int(value) or value > 99:
            return 1
        return int(value)

    def _repair_counts(self, text: str) -> str:
        """Turn a misheard count back into a number when a product follows it.

        "why cold coffees" is five cold coffees; "for 700 rupees" is not four
        of anything, so the lookahead has to be a product and nothing else.
        """
        if not text or not self.products:
            return text

        terms = sorted(
            {t for p in self.products for t in p.match_terms()},
            key=len,
            reverse=True,
        )
        tokens = text.split()
        for i, token in enumerate(tokens):
            digit = DIGIT_HOMOPHONES.get(token)
            if digit is None:
                continue
            # "for" is a real word in "two teas each for fifty rupees". Only
            # trust it as "four" when it opens the sentence.
            if token in FOR_LIKE and i != 0:
                continue
            rest = " ".join(tokens[i + 1:])
            if any(re.match(rf"{re.escape(t)}\b", rest) for t in terms):
                tokens[i] = digit
        return " ".join(tokens)

    # -- finding the pieces ----------------------------------------------

    def _find_item(self, text: str) -> _ItemHit | None:
        """Longest catalog term that appears in the text wins, so 'masala tea'
        beats 'tea'. Falls back to a fuzzy match on what the model garbled."""
        best: _ItemHit | None = None
        for product in self.products:
            for term in product.match_terms():
                m = re.search(rf"\b{re.escape(term)}\b", text)
                if not m:
                    continue
                if best is None or (m.end() - m.start()) > (best.end - best.start):
                    best = _ItemHit(product, m.start(), m.end())
                break  # match_terms is longest-first; first hit is the best one
        return best or self._fuzzy_item(text)

    def _fuzzy_item(self, text: str) -> _ItemHit | None:
        """Recover an item from a mangled transcript.

        Offline models produce approximations of words they half-know:
        "samosa" comes back as "some also", "cold coffee" as "cold copy". The
        sounds are close, so compare the actual strings. Numbers and currency
        words are skipped — those are the one thing the model gets right, and
        letting them fuzzy-match products would be a disaster.
        """
        if not self.products:
            return None

        tokens = [
            (m.group(0), m.start(), m.end())
            for m in re.finditer(r"[a-z]+", text)
            if m.group(0) not in _NUMBER_WORDS
            and m.group(0) not in NOT_AN_ITEM
            and not CURRENCY_RE.fullmatch(m.group(0))
        ]
        if not tokens:
            return None

        best: _ItemHit | None = None
        best_score = FUZZY_ITEM_MIN

        # Longer windows first: "cold copy" should beat "copy".
        for size in (3, 2, 1):
            for i in range(len(tokens) - size + 1):
                window = tokens[i : i + size]
                phrase = "".join(w[0] for w in window)
                if len(phrase) < 3:
                    continue
                for product in self.products:
                    for term in product.match_terms():
                        flat = term.replace(" ", "")
                        if not _similar_enough(phrase, flat, best_score):
                            continue
                        score = SequenceMatcher(None, phrase, flat).ratio()
                        if score > best_score:
                            best_score = score
                            best = _ItemHit(product, window[0][1], window[-1][2])
        return best

    def _guess_item(
        self, text: str, numbers: list[SpokenNumber]
    ) -> _ItemHit | None:
        """Nothing in the catalog matched. If a count is followed by a plain
        word — "five rupees eighteen chocolate" — take that word as the item
        rather than filing the sale as unnamed.

        This runs before the amount is chosen, so that the count in "two
        chocolates" is understood as a count and not as two rupees. The guess
        carries no price: an unknown item with no amount spoken is rejected,
        never sold for zero.
        """
        for number in numbers:
            tail = text[number.end:]
            m = re.match(r"\s+([a-z]+)", tail)
            if not m:
                continue
            word = m.group(1)
            if len(word) < 3 or word in NOT_AN_ITEM or find_numbers(word):
                continue
            start = number.end + m.start(1)

            # Before inventing a product, check it isn't a mangled real one.
            # The bar is lower here than in _fuzzy_item because the
            # alternative is a catalog entry named "Some".
            loose = self._closest_product(text[start:], 0.6)
            if loose is not None:
                return _ItemHit(loose, start, start + len(word))

            if not settings.ALLOW_UNKNOWN_ITEMS:
                continue
            return _ItemHit(
                Product(name=word.title(), price=0.0), start, start + len(word)
            )
        return None

    def _closest_product(self, tail: str, minimum: float) -> Product | None:
        """Best catalog match for the first word or two of `tail`."""
        words = re.findall(r"[a-z]+", tail)[:2]
        if not words:
            return None

        best: Product | None = None
        best_score = minimum
        for phrase in ("".join(words), words[0]):
            for product in self.products:
                for term in product.match_terms():
                    flat = term.replace(" ", "")
                    if not _similar_enough(phrase, flat, best_score):
                        continue
                    best_score = SequenceMatcher(None, phrase, flat).ratio()
                    best = product
        return best

    def _find_amount_number(
        self, text: str, numbers: list[SpokenNumber], item: _ItemHit | None
    ) -> SpokenNumber | None:
        """Which number carries the money. Position matters to the caller, so
        this returns the number itself rather than its value."""
        if not numbers:
            return None

        # 1. The number attached to a currency word: "fifty rupees", "rs 50".
        for m in CURRENCY_RE.finditer(text):
            before = [n for n in numbers if n.end <= m.start()]
            if before:
                return before[-1]
            after = [n for n in numbers if n.start >= m.end()]
            if after:
                return after[0]

        # 2. The number after "for": "two samosas for fifty".
        m = FOR_RE.search(text)
        if m:
            after = [n for n in numbers if n.start >= m.end()]
            if after:
                return after[0]

        # 3. No currency word survived transcription. With an item and more
        #    than one number, the money is the one that isn't the count —
        #    quantity comes before the item, price after it.
        if item is not None and len(numbers) > 1:
            after_item = [n for n in numbers if n.start >= item.end]
            if after_item:
                return after_item[-1]

        # 4. A bare "two teas" has a count but no price; let the caller price
        #    it from the catalog instead of guessing.
        if item is not None and len(numbers) == 1 and numbers[0].end <= item.start:
            return None

        # 5. A number on its own, with no product and no currency word, is a
        #    fragment — the merchant said "two" and the recognizer cut in
        #    before "cold coffee". Filing it as a two-rupee sale is worse than
        #    filing nothing.
        if item is None and not CURRENCY_RE.search(text):
            return None

        return numbers[-1]
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
FUZZY_ITEM_MIN = 0.55

_NUMBER_WORDS = set(UNITS) | set(TEENS) | set(TENS) | set(SCALES) | set(HINDI)

_PHONETIC_START_EQUIVS = {
    "c": {"c", "k", "s"},
    "k": {"k", "c", "q"},
    "s": {"s", "c", "sh"},
    "p": {"p", "f", "b"},
    "f": {"f", "p", "ph", "v"},
    "t": {"t", "th", "d"},
    "d": {"d", "t", "th"},
    "w": {"w", "v", "u"},
    "v": {"v", "w", "b"},
    "m": {"m", "n"},
}


def _similar_enough(heard: str, term: str, minimum: float) -> bool:
    """Fuzzy match with a length guard and phonetic sound compatibility.

    A mishearing is roughly the same length as the word it replaced —
    "some also" for "samosas", "copy" for "coffee".
    """
    if not heard or not term:
        return False

    # Check first letter or phonetic equivalent
    h0, t0 = heard[0], term[0]
    if h0 != t0:
        equivs = _PHONETIC_START_EQUIVS.get(h0, {h0})
        if t0 not in equivs:
            return False

    if abs(len(heard) - len(term)) > max(2, 0.40 * max(len(heard), len(term))):
        return False
    return SequenceMatcher(None, heard, term).ratio() >= minimum


CURRENCY_RE = re.compile(
    r"(₹|\brupees?\b|\brupaye?\b|\brupaiya\b|\brupya\b|\brs\.?\b|\bbucks?\b"
    r"|\brepeat\b|\brepeats\b|\brubies\b|\bruby\b|\broopees?\b|\brupiah\b"
    r"|\brepeated\b|\brupess\b|\bripped\b|\brupays?\b|\brepay\b"
    r"|\bpaisa\b|\bpaise\b|\brupya\b)",
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
    # Hinglish filler that floats around orders
    "kya", "hai", "bhai", "yaar", "aur", "nahi", "dena", "lena", "wala",
    "wali", "wale", "ek", "do", "jo", "karo", "kardo",
}

# Words a recognizer produces instead of a digit. Only applied when the next
# non-filler word is a product term (or for "for/fore/far" which also need
# position context — see _repair_counts).
DIGIT_HOMOPHONES = {
    # Hindi / Hinglish numerals
    "do": "two", "du": "two", "doe": "two", "dough": "two",
    "ek": "one", "yak": "one", "ik": "one",
    "teen": "three", "tin": "three",
    "char": "four", "chaar": "four",
    "paanch": "five", "panch": "five", "punch": "five",
    "chhe": "six", "che": "six", "chheh": "six",
    "saat": "seven", "sat": "seven",
    "aath": "eight", "aat": "eight",
    "nau": "nine",
    "das": "ten", "dus": "ten",
    # one
    "wan": "one", "when": "one", "won": "one", "wun": "one",
    # two
    "too": "two", "to": "two", "tu": "two", "dew": "two", "due": "two",
    "tow": "two",
    # three
    "tree": "three", "free": "three", "thee": "three", "trey": "three",
    # four — handled separately in FOR_LIKE because "for" is also a preposition
    "for": "four", "fore": "four", "far": "four", "fort": "four", "fir": "four",
    "oar": "four", "ore": "four",
    # five
    "why": "five", "fife": "five", "file": "five", "hi": "five",
    "wife": "five",
    # six
    "sex": "six", "sicks": "six", "seeks": "six", "sax": "six",
    # seven
    "sever": "seven", "heaven": "seven",
    # eight
    "wait": "eight", "eat": "eight", "ate": "eight", "rate": "eight",
    # nine
    "wine": "nine", "night": "nine", "nain": "nine", "nigh": "nine",
    "nye": "nine",
    # ten
    "tan": "ten", "den": "ten", "then": "ten", "than": "ten",
}

# Homophones of "four" that are also ordinary English words. These are treated
# as a count only when they open the sentence OR when the lookahead confirms a
# product follows — see _repair_counts().
FOR_LIKE = {"for", "fore", "far", "fort", "fir", "oar", "ore"}

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
        # Normalise first (collapse stutters, strip junk), then repair digit
        # homophones, then run the rest of the pipeline.
        normalised = self._normalize_transcript(" ".join(raw_text.lower().split()))
        text = self._repair_counts(normalised)
        if not text:
            return ExtractionResult(None, "empty transcript")

        if CANCEL_RE.search(text):
            return ExtractionResult(None, "cancel command", cancel=True)

        numbers = self._merge_digit_pairs(text, find_numbers(text))
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

    # -- transcript normalisation ----------------------------------------

    @staticmethod
    def _normalize_transcript(text: str) -> str:
        """Clean up common STT artefacts before the extractor sees the sentence.

        1. Collapse immediate stutter repetitions: "two two teas" → "two teas".
        2. Strip leading filler words ("okay yes two teas" → "two teas").
        3. Remove 'the' inserted between number words
           ("three the four tea" → "three four tea").
        4. Expand adjacent bare digit-words into compound tens+units before
           currency markers: "for five rupees" → "forty five rupees" (= ₹45).
           STT frequently splits "forty five" into two tokens when each syllable
           lands in a different audio chunk.
        """
        if not text:
            return text

        # _NUMBER_WORDS is module-level — no rebuild per call.

        # 1. Collapse adjacent identical tokens (stutter)
        tokens = text.split()
        deduped: list[str] = []
        for tok in tokens:
            if deduped and tok == deduped[-1]:
                continue
            deduped.append(tok)
        tokens = deduped

        # 2. Strip leading pure-filler tokens
        LEADING_FILLERS = {
            "ok", "okay", "yes", "please", "give", "take", "hello", "hi",
            "bhaiya", "bhai", "sir", "madam", "boss", "yaar", "uh", "um",
            "so", "now", "hey", "right",
        }
        while tokens and tokens[0] in LEADING_FILLERS:
            tokens = tokens[1:]

        # 3. Strip 'the' / 'a' inserted between two number words by the model.
        #    "three the four tea" → "three four tea"
        BETWEEN_NUM_FILLERS = {"the", "a", "an"}
        cleaned: list[str] = []
        for j, tok in enumerate(tokens):
            if tok in BETWEEN_NUM_FILLERS:
                prev_tok = cleaned[-1] if cleaned else ""
                next_tok = tokens[j + 1] if j + 1 < len(tokens) else ""
                if prev_tok in _NUMBER_WORDS and next_tok in _NUMBER_WORDS:
                    continue  # drop the filler
            cleaned.append(tok)
        tokens = cleaned

        # 4. Expand adjacent bare unit-words into compound tens+units before
        #    a currency marker.  Addresses: "for five rupees" → "forty five rupees"
        #    and "two five rupees" → "twenty five rupees" etc.
        #
        #    Rule: if token[i] is a unit-word (value 2-9) AND token[i+1] is also
        #    a unit-word (value 0-9) AND the word immediately after that is a
        #    currency marker (or end of meaningful text), replace token[i] with
        #    its tens equivalent so find_numbers can parse "forty five" → 45.
        UNIT_TO_TENS = {
            "two": "twenty",  "to": "twenty",  "too": "twenty",
            "three": "thirty",
            "four": "forty",  "for": "forty",  "fore": "forty",
            "five": "fifty",
            "six": "sixty",
            "seven": "seventy",
            "eight": "eighty",
            "nine": "ninety",
        }
        # digit words that can be the 'units' part (0-9)
        UNITS_PART = {
            "zero", "one", "two", "three", "four", "five",
            "six", "seven", "eight", "nine",
            "won", "wun", "wan",           # one homophones
            "to", "too", "tu",             # two homophones (only valid units here)
        }
        CURRENCY_STARTERS = {
            "rupees", "rupee", "rs", "paisa", "paise", "rupay", "rupaye",
            "rubies", "ruby", "roopees", "bucks", "buck",
        }
        expanded: list[str] = list(tokens)
        for i in range(len(expanded) - 1):
            t1 = expanded[i]
            t2 = expanded[i + 1]
            if t1 not in UNIT_TO_TENS or t2 not in UNITS_PART:
                continue
            # Check that the word after t2 is a currency marker or EOS
            t3 = expanded[i + 2] if i + 2 < len(expanded) else ""
            if t3 == "" or t3 in CURRENCY_STARTERS:
                expanded[i] = UNIT_TO_TENS[t1]  # "for" → "forty"
                # t2 stays as-is; find_numbers sees "forty five" → 45
        tokens = expanded

        return " ".join(tokens)

    @staticmethod
    def _merge_digit_pairs(
        text: str, numbers: list["SpokenNumber"]
    ) -> list["SpokenNumber"]:
        """Merge adjacent single-digit SpokenNumbers into compound tens+units.

        After _normalize_transcript runs, most "for five" → "forty five" cases
        are already handled.  This covers residual cases where two numeric
        tokens landed in different Vosk sentence boundaries so they were never
        in the same normalisation pass.

        Rule: if n1.value ∈ [2,9] and n2.value ∈ [0,9] and the two spans are
        adjacent in the text (only whitespace between them) and the word
        immediately after n2 is a currency word → merge into n1*10+n2.
        """
        if len(numbers) < 2:
            return numbers

        CURRENCY_STARTERS = {
            "rupees", "rupee", "rs", "paisa", "paise", "rupay",
            "rubies", "ruby", "roopees", "bucks",
        }

        out: list = []
        i = 0
        while i < len(numbers):
            if i < len(numbers) - 1:
                n1, n2 = numbers[i], numbers[i + 1]
                adjacent = n2.start - n1.end <= 2  # only whitespace between
                both_small = 2 <= n1.value <= 9 and 0 <= n2.value <= 9
                both_word = not n1.from_digits and not n2.from_digits
                if adjacent and both_small and both_word:
                    # Check the word right after n2
                    tail = text[n2.end:].lstrip()
                    first_tail_word = tail.split()[0] if tail.split() else ""
                    if first_tail_word in CURRENCY_STARTERS or not tail:
                        compound = n1.value * 10 + n2.value
                        out.append(SpokenNumber(float(compound), n1.start, n2.end))
                        i += 2
                        continue
            out.append(numbers[i])
            i += 1
        return out

    def _repair_counts(self, text: str) -> str:
        """Turn a misheard count into the correct digit when a product follows.

        Improvements over the original:
        * Looks ahead up to 4 tokens through filler/currency words, not just
          the immediately next token.  "for please samosas" → "four … samosas".
        * FOR_LIKE tokens (for/fore/far/fort…) are trusted as "four" when a
          product is found in the lookahead, even mid-sentence.
        * Pre-compiles all product-term patterns once per call (not per token).
        """
        if not text or not self.products:
            return text

        # Build and compile term patterns once for the whole sentence.
        raw_terms = sorted(
            {t for p in self.products for t in p.match_terms()},
            key=len,
            reverse=True,
        )
        # Compiled patterns: each matches its term at the start of a string.
        term_patterns = [re.compile(rf"{re.escape(t)}\b") for t in raw_terms]

        # Words that don't break the lookahead scan.
        SKIP_WORDS = {
            "please", "me", "a", "the", "some", "of", "and",
            "bhaiya", "bhai", "sir", "ok", "okay",
        }

        def _product_follows(tok_list: list[str], start: int, max_skip: int = 4) -> bool:
            """True if a product term begins within `max_skip` non-filler tokens of `start`."""
            skip = 0
            for j in range(start, len(tok_list)):
                # Build the remaining string only when we have a potential match.
                tok = tok_list[j]
                if any(p.match(" ".join(tok_list[j:])) for p in term_patterns):
                    return True
                if tok not in SKIP_WORDS:
                    skip += 1
                    if skip >= max_skip:
                        break
            return False

        tokens = text.split()
        for i, token in enumerate(tokens):
            digit = DIGIT_HOMOPHONES.get(token)
            if digit is None:
                continue
            if not _product_follows(tokens, i + 1):
                continue
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
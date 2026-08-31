"""A vocabulary for the recognizer, built from the merchant's own catalog.

A shop counter uses maybe sixty words: numbers, product names, "rupees",
"each". A general-purpose model is choosing from 200,000 and picks whatever is
acoustically closest — which is how "five cold coffees" becomes "why cold
coffees" and "for 700 rupees" becomes "there were rendered".

Vosk lets a recognizer be built against a fixed word list, and the small models
support it. Given the list, the decoder can only emit those words, so "why"
isn't an option and "five" wins. This is a much bigger accuracy gain than a
bigger model, and it costs nothing at runtime.

Two caveats:
  * Only small models support this. Big ones (en-us-0.22 and up) are static.
  * Every word here must exist in the model's own lexicon; unknown ones are
    ignored, which is why product names still need sensible spellings.
"""

from __future__ import annotations

import re

from ..models.product import Product
from .numbers import HINDI, SCALES, TEENS, TENS, UNITS
from .wake import HOMOPHONES

# Everything a sale can be phrased with.
CORE_WORDS = {
    # money
    "rupees", "rupee", "rs", "paisa",
    # quantity and rate
    "each", "per", "piece", "pieces", "plate", "plates", "half", "full",
    "and", "for", "of", "a", "the", "one",
    # corrections
    "cancel", "undo", "delete", "remove",
    # politeness that shows up mid-sentence
    "please", "total", "give", "take", "ok",
}

NUMBER_WORDS = set(UNITS) | set(TEENS) | set(TENS) | set(SCALES) | set(HINDI)

# Lets the decoder emit "[unk]" for anything off-list instead of forcing a
# wrong in-vocabulary word. Without it, background chatter turns into orders.
UNKNOWN = "[unk]"

_WORD_RE = re.compile(r"[a-z]+")


def phrases_for(products: list[Product], wake_word: str = "merc") -> list[str]:
    """The word list to hand Vosk. Sorted so it's stable across restarts."""
    words: set[str] = set(CORE_WORDS) | NUMBER_WORDS
    words.add(wake_word.lower())
    words |= {w.lower() for w in HOMOPHONES}

    for product in products:
        for term in product.match_terms():
            words.update(_WORD_RE.findall(term))

    words = {w for w in words if w.isalpha() and len(w) > 1 or w in {"a"}}
    return sorted(words) + [UNKNOWN]


def strip_unknown(text: str) -> str:
    """Remove the [unk] placeholders before the extractor sees the sentence."""
    return " ".join(t for t in text.split() if t != UNKNOWN).strip()

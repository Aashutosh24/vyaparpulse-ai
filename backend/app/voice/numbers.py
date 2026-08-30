"""Turn spoken numbers into values.

Offline STT writes numbers as words ("fifty", "one hundred twenty"), not
digits, so the extractor needs a real parser rather than a regex over \\d+.
Every number keeps its character span, because position is what tells quantity
apart from amount later on.

Splitting rule worth knowing: two number words that cannot combine start a new
number. "two fifty" is 2 and 50, not 250 — which is what a merchant saying
"two samosas fifty rupees" means. Say "two hundred fifty" for 250.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9,
    # things a small model coughs up for digits
    "won": 1, "to": None, "too": None, "for": None, "ate": 8,
}
UNITS = {k: v for k, v in UNITS.items() if v is not None}

TEENS = {
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19,
}

TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fourty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}

SCALES = {"hundred": 100, "thousand": 1000, "lakh": 100_000, "lac": 100_000}

# Common Hindi/Hinglish numerals, in case a Hindi model or a mixed-language
# transcript comes through. Harmless for English input.
HINDI = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5,
    "panch": 5, "chhe": 6, "che": 6, "saat": 7, "aath": 8, "nau": 9,
    "das": 10, "bees": 20, "pachas": 50, "sau": 100,
}

FILLER = {"and", "a", "rupees", "rupee"}

_TOKEN_RE = re.compile(r"\d+(?:\.\d+)?|[a-z]+", re.IGNORECASE)


@dataclass
class SpokenNumber:
    value: float
    start: int
    end: int
    from_digits: bool = False


class _Group:
    """One number being assembled from consecutive words."""

    def __init__(self, start: int) -> None:
        self.result = 0
        self.current = 0
        self.has_unit = False
        self.has_ten = False
        self.start = start
        self.end = start

    @property
    def value(self) -> int:
        return self.result + self.current

    @property
    def empty(self) -> bool:
        return self.result == 0 and self.current == 0


def find_numbers(text: str) -> list[SpokenNumber]:
    """All numbers in `text`, digits and words alike, left to right."""
    out: list[SpokenNumber] = []
    group: _Group | None = None

    def flush() -> None:
        nonlocal group
        if group is not None and not group.empty:
            out.append(SpokenNumber(float(group.value), group.start, group.end))
        group = None

    for m in _TOKEN_RE.finditer(text):
        raw = m.group(0)
        word = raw.lower()

        if raw[0].isdigit():
            flush()
            out.append(SpokenNumber(float(raw), m.start(), m.end(), from_digits=True))
            continue

        if word in FILLER and group is not None:
            continue  # "one hundred and fifty" stays one number

        unit = UNITS.get(word, HINDI.get(word))
        teen = TEENS.get(word)
        ten = TENS.get(word)
        scale = SCALES.get(word)

        if unit is None and teen is None and ten is None and scale is None:
            flush()
            continue

        if group is None:
            group = _Group(m.start())

        if scale is not None:
            if scale == 100:
                group.current = max(group.current, 1) * 100
            else:
                group.result += max(group.value, 1) * scale
                group.current = 0
            group.has_unit = False
            group.has_ten = False
        elif ten is not None:
            if group.has_ten or group.has_unit:
                flush()
                group = _Group(m.start())
            group.current += ten
            group.has_ten = True
        else:  # unit or teen
            value = unit if unit is not None else teen
            if group.has_unit or (teen is not None and group.has_ten):
                flush()
                group = _Group(m.start())
            group.current += value
            group.has_unit = True

        group.end = m.end()

    flush()
    out.sort(key=lambda n: n.start)
    return out

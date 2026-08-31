"""Wake word detection for "Merc".

A small offline STT model almost certainly doesn't have "merc" in its
vocabulary, so it returns the nearest thing it does know: mark, march, merck,
murk. Matching only the literal spelling would mean the wake word never fires
on a real device. So: an explicit homophone list, plus a fuzzy fallback for
short tokens.

The detector also returns whatever followed the wake word, which is what makes
"Merc, two samosas fifty rupees" work in a single breath.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

# Heard-as spellings for "merc". Keep these short and merc-shaped; adding
# common English words here would fire the agent constantly.
HOMOPHONE_SETS = {
    "merc": {
        "merc", "merck", "merk", "mercs", "mark", "marc", "marck", "marks",
        "murk", "murc", "merch", "march", "mercy", "merge", "burke", "mirk",
    },
    "hello": {"hello", "hallo", "hullo", "halo", "yellow"},
    "boss": {"boss", "bos", "bass", "boas"},
}

# Everything any wake word can be heard as — grammar.py needs the full set.
HOMOPHONES = {word for words in HOMOPHONE_SETS.values() for word in words}


def homophones_for(wake_word: str) -> set[str]:
    """Spellings that count as this wake word, and no others. Without this,
    setting WAKE_WORD=hello would still fire on "mark"."""
    return HOMOPHONE_SETS.get(wake_word.lower(), {wake_word.lower()})

_TOKEN_RE = re.compile(r"[a-z0-9₹.]+")


@dataclass
class WakeMatch:
    hit: bool
    remainder: str = ""  # everything spoken after the wake word
    token: str = ""      # what the model actually transcribed


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def detect(text: str, wake_word: str = "merc", fuzz: float = 0.78) -> WakeMatch:
    """Look for the wake word in a transcript.

    Matches on the *last* occurrence, so "merc merc tea ten rupees" doesn't
    treat a stutter as part of the command.
    """
    if not text:
        return WakeMatch(False)

    wake = wake_word.lower()

    heard_as = homophones_for(wake)
    tokens = list(_TOKEN_RE.finditer(text.lower()))

    match_index = -1
    matched_token = ""
    for i, m in enumerate(tokens):
        token = m.group(0)
        if token == wake or token in heard_as:
            match_index, matched_token = i, token
            continue
        # Fuzzy fallback, deliberately limited to short words so long words
        # can't drift into range.
        if 3 <= len(token) <= len(wake) + 3 and _similar(token, wake) >= fuzz:
            match_index, matched_token = i, token

    if match_index < 0:
        return WakeMatch(False)

    remainder = text[tokens[match_index].end():].strip(" ,.;:-")
    return WakeMatch(True, remainder, matched_token)


def strip_wake(text: str, wake_word: str = "merc", fuzz: float = 0.78) -> str:
    """Text with a leading wake word removed, unchanged if there isn't one."""
    match = detect(text, wake_word, fuzz)
    return match.remainder if match.hit else text

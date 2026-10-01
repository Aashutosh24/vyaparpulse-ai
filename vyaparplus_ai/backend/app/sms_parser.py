"""
Rule-based SMS classification and extraction.

Deliberately regex-based, not ML — bank SMS formats are fairly formulaic
("Rs.X credited...", "INR X debited..."), so pattern matching is reliable
and needs no training data or model to ship. Extend the regexes here as
real-world SMS formats turn up that these patterns miss.
"""

import re
from dataclasses import dataclass
from typing import Optional

# OTP and promotional messages are filtered out FIRST, before any
# CREDIT/DEBIT check — a promotional SMS that happens to mention "credited"
# (e.g. cashback offers) should never be treated as a real payment.
OTP_PATTERN = re.compile(
    r"\b(otp|one[-\s]?time password|verification code)\b", re.IGNORECASE
)
PROMO_PATTERN = re.compile(
    r"\b(offer|sale now|discount|cashback offer|unsubscribe|win rs|limited period)\b",
    re.IGNORECASE,
)

CREDIT_PATTERN = re.compile(
    r"\b(credited|credit of|received|deposited)\b", re.IGNORECASE
)
DEBIT_PATTERN = re.compile(
    r"\b(debited|debit of|spent|paid to|withdrawn)\b", re.IGNORECASE
)

AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE
)
REFERENCE_PATTERN = re.compile(
    r"(?:ref(?:erence)?(?:\s*no)?|txn(?:\s*id)?|utr|transaction id)[\s:#-]*([a-zA-Z0-9]+)",
    re.IGNORECASE,
)


@dataclass
class ParsedSms:
    type: str  # "CREDIT" | "DEBIT" | "UNKNOWN"
    amount: Optional[float]
    reference: Optional[str]


def parse_sms(body: str) -> ParsedSms:
    """
    Classifies a raw SMS body and extracts amount + reference when present.
    OTP and promotional messages are always UNKNOWN, regardless of what
    other keywords they contain, so they're never eligible for matching.
    """
    if OTP_PATTERN.search(body) or PROMO_PATTERN.search(body):
        return ParsedSms(type="UNKNOWN", amount=None, reference=None)

    amount_match = AMOUNT_PATTERN.search(body)
    amount = float(amount_match.group(1).replace(",", "")) if amount_match else None

    reference_match = REFERENCE_PATTERN.search(body)
    reference = reference_match.group(1) if reference_match else None

    # A CREDIT/DEBIT classification without an extractable amount isn't
    # useful for matching, so it's left UNKNOWN too (still stored for audit,
    # via the caller, just never picked up by the matcher).
    if CREDIT_PATTERN.search(body) and amount is not None:
        return ParsedSms(type="CREDIT", amount=amount, reference=reference)
    if DEBIT_PATTERN.search(body) and amount is not None:
        return ParsedSms(type="DEBIT", amount=amount, reference=reference)

    return ParsedSms(type="UNKNOWN", amount=amount, reference=reference)

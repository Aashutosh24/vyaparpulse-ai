"""
Extracts structured payment info (type, amount, timestamp, reference) out of
raw bank/UPI SMS or notification text captured on the merchant's Android
device.

This is intentionally rule-based (regex) rather than ML-based: bank/UPI SMS
in India follow a small number of fairly predictable templates, and a
regex approach is fast, dependency-free, and easy to extend for a hackathon.

Typical messages this handles, e.g.:
  "Rs.50.00 credited to your A/c ...1234 on 28-08-26. UPI Ref 123456789012"
  "You have received Rs 50 in your PhonePe account"
  "INR 50.00 credited to your account via UPI on 28/08/2026 20:31:05"
  "Rs 200.00 debited from A/c ...1234"
"""
import hashlib
import re
from datetime import datetime, timezone
from typing import Optional
from dateutil import parser as dateutil_parser

CREDIT_WORDS = re.compile(r"\b(credited|received|credit)\b", re.IGNORECASE)
DEBIT_WORDS = re.compile(r"\b(debited|spent|debit|withdrawn|paid)\b", re.IGNORECASE)

# Matches amounts like: Rs.50, Rs 50.00, INR 50, ₹50.00, Rs50
AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)",
    re.IGNORECASE,
)

# Matches explicit dates/times embedded in the SMS, e.g. "28-08-2026 20:31:05"
# or "on 28/08/26" or "at 20:31". Kept broad; dateutil does the heavy lifting.
DATETIME_HINT_PATTERN = re.compile(
    r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:[ ,]+\d{1,2}:\d{2}(?::\d{2})?)?)"
    r"|(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)"
)

REFERENCE_PATTERN = re.compile(
    r"(?:UPI\s*Ref(?:erence)?\.?|Ref(?:erence)?\s*No\.?|UTR)[:\s]*([A-Za-z0-9]{6,})",
    re.IGNORECASE,
)


class ParsedPayment:
    def __init__(self, type_: Optional[str], amount: Optional[float],
                 timestamp: datetime, reference: Optional[str], raw_message: str,
                 sender_name: Optional[str] = None):
        self.type = type_
        self.amount = amount
        self.timestamp = timestamp
        self.reference = reference
        self.raw_message = raw_message
        self.sender_name = sender_name

    @property
    def is_valid(self) -> bool:
        return self.type is not None and self.amount is not None


SENDER_NAME_PATTERNS = [
    re.compile(r"(?:by\s+vpa\s+[^\s(]+\s*\()([A-Za-z][A-Za-z\s]{1,30})(?:\))", re.IGNORECASE),
    re.compile(r"(?:from|paid by|transfer from|by transfer from|received from)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:via|on|ref|upi|to|dated|a/c|acct)|\.|\,|$)", re.IGNORECASE),
]


def _extract_sender_name(message: str) -> Optional[str]:
    for pat in SENDER_NAME_PATTERNS:
        match = pat.search(message)
        if match:
            candidate = match.group(1).strip()
            if candidate.lower() not in {"your", "your account", "bank", "upi", "account", "phonepe", "paytm", "gpay"}:
                return candidate
    return None



def _extract_type(message: str) -> Optional[str]:
    if CREDIT_WORDS.search(message):
        return "CREDIT"
    if DEBIT_WORDS.search(message):
        return "DEBIT"
    return None


def _extract_amount(message: str) -> Optional[float]:
    match = AMOUNT_PATTERN.search(message)
    if not match:
        return None
    raw = match.group(1).replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def _extract_timestamp(message: str, received_at: datetime) -> datetime:
    """
    Try to parse an explicit date/time out of the message; fall back to the
    time the notification/SMS was received on the device, which is a very
    reliable proxy since bank SMS arrive within seconds of the real event.
    """
    hint = DATETIME_HINT_PATTERN.search(message)
    if hint:
        candidate = hint.group(0)
        try:
            parsed = dateutil_parser.parse(candidate, default=received_at, dayfirst=True)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=received_at.tzinfo or timezone.utc)
            return parsed
        except (ValueError, OverflowError):
            pass
    return received_at


def _extract_reference(message: str) -> Optional[str]:
    match = REFERENCE_PATTERN.search(message)
    return match.group(1) if match else None


def make_dedupe_key(message: str, sender: Optional[str], reference: Optional[str]) -> str:
    """
    Prefer the bank's own reference/UTR number when present (strongest
    guarantee against double-processing). Otherwise fall back to a hash of
    the sender + exact message text, which is still a reasonable duplicate
    guard for repeated notification deliveries of the same SMS.
    """
    if reference:
        return f"ref:{reference.upper()}"
    basis = f"{sender or ''}|{message.strip()}"
    return "hash:" + hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]


def parse_payment_message(message: str, received_at: Optional[datetime] = None) -> ParsedPayment:
    received_at = received_at or datetime.now(timezone.utc)
    return ParsedPayment(
        type_=_extract_type(message),
        amount=_extract_amount(message),
        timestamp=_extract_timestamp(message, received_at),
        reference=_extract_reference(message),
        raw_message=message,
        sender_name=_extract_sender_name(message),
    )


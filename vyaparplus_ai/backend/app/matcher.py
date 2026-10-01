"""
Payment matching.

Only CREDIT messages that haven't already been matched to a transaction are
considered (that's what prevents the same SMS being used twice). For each
one, we look for a PENDING transaction with the same amount, within a time
window either side of the SMS timestamp, and pick whichever candidate is
closest in time if more than one qualifies.
"""

import re
from datetime import timedelta
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from . import models

MATCH_WINDOW = timedelta(minutes=15)
AMOUNT_TOLERANCE = 0.01  # guards against float rounding, not a business rule

SENDER_NAME_PATTERNS = [
    re.compile(r"(?:by\s+vpa\s+[^\s(]+\s*\()([A-Za-z][A-Za-z\s]{1,30})(?:\))", re.IGNORECASE),
    re.compile(r"(?:from|paid by|transfer from|by transfer from|received from)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:via|on|ref|upi|to|dated|a/c|acct)|\.|\,|$)", re.IGNORECASE),
]


def extract_sender_name(raw: str | None) -> str | None:
    if not raw:
        return None
    for pat in SENDER_NAME_PATTERNS:
        m = pat.search(raw)
        if m:
            c = m.group(1).strip()
            if c.lower() not in {"your", "your account", "bank", "upi", "account", "phonepe", "paytm", "gpay"}:
                return c
    return None


def fuzzy_name_match(name1: str | None, name2: str | None) -> bool:
    """
    Checks if two names match, even partially.
    Examples:
      - 'Rahul' matches 'Rahul Sharma' (and vice versa)
      - 'Rahul S' matches 'Rahul Sharma'
      - 'Sharma Rahul' matches 'Rahul'
      - 'Anita Stores' matches 'Anita'
    """
    if not name1 or not name2:
        return False
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True
    if n1 in n2 or n2 in n1:
        return True
    tokens1 = set(re.findall(r"\b[a-z]{2,}\b", n1))
    tokens2 = set(re.findall(r"\b[a-z]{2,}\b", n2))
    ignore = {"mr", "mrs", "shri", "smt", "dr", "ji", "store", "stores", "traders", "kirana"}
    m1 = tokens1 - ignore or tokens1
    m2 = tokens2 - ignore or tokens2
    return bool(m1 & m2)


def run_matching(db: Session) -> list[dict]:
    results = []

    unmatched_credits = (
        db.query(models.PaymentMessageDB)
        .filter(models.PaymentMessageDB.type == "CREDIT")
        .filter(models.PaymentMessageDB.matched_transaction_id.is_(None))
        .all()
    )

    for msg in unmatched_credits:
        candidates = (
            db.query(models.TransactionDB)
            .filter(models.TransactionDB.status == "PENDING")
            .filter(
                models.TransactionDB.amount.between(
                    msg.amount - AMOUNT_TOLERANCE, msg.amount + AMOUNT_TOLERANCE
                )
            )
            .all()
        )

        # Check if sender name is present
        sender_name = None
        if msg.sender and not (msg.sender.upper().endswith("BK") or "OTP" in msg.sender.upper() or len(msg.sender) <= 6):
            sender_name = msg.sender
        if not sender_name:
            sender_name = extract_sender_name(msg.raw_sms)

        # Prioritize candidates whose customer_name matches sender_name
        name_matched = []
        if sender_name:
            name_matched = [
                t for t in candidates
                if t.customer_name and fuzzy_name_match(t.customer_name, sender_name)
            ]

        pool = name_matched if name_matched else candidates

        best = None
        best_delta = None
        for txn in pool:
            delta = abs((msg.sms_timestamp - txn.timestamp).total_seconds())
            if delta <= MATCH_WINDOW.total_seconds():
                if best is None or delta < best_delta:
                    best, best_delta = txn, delta


        if best:
            best.status = "PAID"
            best.paid_at = msg.sms_timestamp
            best.payment_reference = msg.reference
            msg.matched_transaction_id = best.id
            results.append(
                {
                    "payment_message_id": msg.id,
                    "matched": True,
                    "transaction_id": best.id,
                    "reason": None,
                }
            )
        else:
            results.append(
                {
                    "payment_message_id": msg.id,
                    "matched": False,
                    "transaction_id": None,
                    "reason": "No PENDING transaction with matching amount within the time window",
                }
            )

    db.commit()
    return results

import re
from datetime import timedelta
from typing import Optional

AMOUNT_TOLERANCE = 0.005  # ±0.5 paise — handles float rounding in bank SMS

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app import models
from app.config import MATCH_TIME_WINDOW_SECONDS
from app.models import utcnow


def fuzzy_name_match(name1: Optional[str], name2: Optional[str]) -> bool:
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


def find_matching_transaction(db: Session, payment: models.Payment) -> Optional[models.Transaction]:
    """
    Finds the best PENDING transaction for a given payment:
      - same merchant
      - same amount
      - still PENDING (not already paid)
      - transaction.created_at within MATCH_TIME_WINDOW_SECONDS of payment.timestamp
      - prioritizes candidate matching customer_name / UPI sender name (even half/partial match)

    Only CREDIT payments can match (a debit can never settle a sale).
    If multiple candidates exist, candidates matching the customer name are preferred,
    breaking ties by whichever is closest to the payment timestamp.
    """
    if payment.type != "CREDIT":
        return None

    window = timedelta(seconds=MATCH_TIME_WINDOW_SECONDS)
    lower = payment.timestamp - window
    upper = payment.timestamp + window

    candidates = (
        db.query(models.Transaction)
        .filter(
            and_(
                models.Transaction.merchant_id == payment.merchant_id,
                models.Transaction.status == "PENDING",
                # Use a tolerance band instead of == to handle float rounding
                # (e.g. SMS "Rs.1200.00" parsed as 1200.0 vs stored 1200.005).
                models.Transaction.amount >= payment.amount - AMOUNT_TOLERANCE,
                models.Transaction.amount <= payment.amount + AMOUNT_TOLERANCE,
                models.Transaction.created_at >= lower,
                models.Transaction.created_at <= upper,
            )
        )
        .all()
    )

    if not candidates:
        return None

    # Check if a customer name / sender name is present in the SMS
    from app.payment_parser import _extract_sender_name
    sender_name = _extract_sender_name(payment.raw_message) if payment.raw_message else None

    if sender_name:
        name_matching_candidates = [
            c for c in candidates if c.customer_name and fuzzy_name_match(c.customer_name, sender_name)
        ]
        if name_matching_candidates:
            return min(name_matching_candidates, key=lambda t: abs((t.created_at - payment.timestamp).total_seconds()))

    return min(candidates, key=lambda t: abs((t.created_at - payment.timestamp).total_seconds()))



def process_payment(db: Session, payment: models.Payment) -> Optional[models.Transaction]:
    """
    Attempts to match `payment` (already persisted, unprocessed) against a
    pending transaction. Marks the payment as processed either way, and on
    a match marks the transaction PAID and links the two records together.
    Returns the matched transaction, or None if nothing matched.
    """
    matched_transaction = find_matching_transaction(db, payment)

    payment.processed = True

    if matched_transaction:
        matched_transaction.status = "PAID"
        matched_transaction.paid_at = payment.timestamp
        matched_transaction.payment_id = payment.payment_id
        payment.matched = True

    db.commit()
    if matched_transaction:
        db.refresh(matched_transaction)
    db.refresh(payment)

    return matched_transaction


def is_stale(transaction: models.Transaction, after_minutes: int) -> bool:
    """True if a PENDING transaction has been unmatched for longer than the threshold."""
    if transaction.status != "PENDING":
        return False
    # SQLite stores datetimes without timezone info; normalise both sides to UTC
    # before subtracting so we never get the offset-naive vs offset-aware error.
    from datetime import timezone
    now = utcnow()
    created = transaction.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age = now - created
    return age.total_seconds() >= after_minutes * 60

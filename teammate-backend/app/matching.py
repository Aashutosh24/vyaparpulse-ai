from datetime import timedelta
from typing import Optional

AMOUNT_TOLERANCE = 0.005  # ±0.5 paise — handles float rounding in bank SMS

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app import models
from app.config import MATCH_TIME_WINDOW_SECONDS
from app.models import utcnow


def find_matching_transaction(db: Session, payment: models.Payment) -> Optional[models.Transaction]:
    """
    Finds the best PENDING transaction for a given payment:
      - same merchant
      - same amount
      - still PENDING (not already paid)
      - transaction.created_at within MATCH_TIME_WINDOW_SECONDS of payment.timestamp

    Only CREDIT payments can match (a debit can never settle a sale).
    If multiple candidates exist, the one whose created_at is closest to the
    payment timestamp wins (e.g. two customers buying the same-priced item
    back to back).
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

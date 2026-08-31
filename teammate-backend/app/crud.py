from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app import models, schemas
from app.config import DEFAULT_MERCHANT_ID
from app.models import utcnow


# ------------------------------ Transactions ---------------------------------

def create_transaction(db: Session, payload: schemas.TransactionCreate) -> models.Transaction:
    txn = models.Transaction(
        merchant_id=payload.merchant_id or DEFAULT_MERCHANT_ID,
        customer_name=payload.customer_name,
        item=payload.item,
        quantity=payload.quantity,
        amount=payload.amount,
        created_at=payload.created_at or utcnow(),
        status="PENDING",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def get_transactions(db: Session, merchant_id: str, status: Optional[str] = None,
                      limit: int = 100, offset: int = 0):
    query = db.query(models.Transaction).filter(models.Transaction.merchant_id == merchant_id)
    if status:
        query = query.filter(models.Transaction.status == status.upper())
    return (
        query.order_by(models.Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_transaction(db: Session, transaction_id: str) -> Optional[models.Transaction]:
    return db.query(models.Transaction).filter(
        models.Transaction.transaction_id == transaction_id
    ).first()


def get_todays_transactions(db: Session, merchant_id: str):
    today = utcnow().date()
    start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)
    return (
        db.query(models.Transaction)
        .filter(
            models.Transaction.merchant_id == merchant_id,
            models.Transaction.created_at >= start,
            models.Transaction.created_at <= end,
        )
        .all()
    )


# -------------------------------- Payments -----------------------------------

def get_payment_by_dedupe_key(db: Session, dedupe_key: str) -> Optional[models.Payment]:
    return db.query(models.Payment).filter(models.Payment.dedupe_key == dedupe_key).first()


def create_payment(db: Session, merchant_id: str, type_: str, amount: float,
                    timestamp: datetime, raw_message: Optional[str] = None,
                    dedupe_key: Optional[str] = None) -> models.Payment:
    payment = models.Payment(
        merchant_id=merchant_id,
        type=type_,
        amount=amount,
        timestamp=timestamp,
        raw_message=raw_message,
        dedupe_key=dedupe_key,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def link_payment_to_transaction(
    db: Session,
    payment: models.Payment,
    transaction: models.Transaction,
) -> None:
    """
    Manually link an existing (unmatched) payment to a specific pending
    transaction. Called when the merchant manually confirms a match in the
    Payment Review screen on the Flutter app.
    """
    transaction.status = "PAID"
    transaction.paid_at = payment.timestamp
    transaction.payment_id = payment.payment_id
    payment.processed = True
    payment.matched = True
    db.commit()
    db.refresh(transaction)
    db.refresh(payment)


def get_payments(db: Session, merchant_id: str, limit: int = 100, offset: int = 0):
    return (
        db.query(models.Payment)
        .filter(models.Payment.merchant_id == merchant_id)
        .order_by(models.Payment.received_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


# -------------------------------- Insights ----------------------------------

def get_insights_data(db: Session, merchant_id: str, days: int = 7):
    """
    Returns (current_period_transactions, previous_period_transactions) for
    the last `days` calendar days and the `days` before that.
    Used to compute revenue change % and trend arrays.
    """
    now = utcnow()
    period_start = datetime.combine(
        (now - timedelta(days=days - 1)).date(), datetime.min.time(), tzinfo=timezone.utc
    )
    prev_start = datetime.combine(
        (now - timedelta(days=days * 2 - 1)).date(), datetime.min.time(), tzinfo=timezone.utc
    )

    current = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.merchant_id == merchant_id,
            models.Transaction.created_at >= period_start,
        )
        .all()
    )
    previous = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.merchant_id == merchant_id,
            models.Transaction.created_at >= prev_start,
            models.Transaction.created_at < period_start,
        )
        .all()
    )
    return current, previous

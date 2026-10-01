"""
ORM models.

Transaction  — one recorded sale, starts PENDING, flips to PAID once matched.
PaymentMessageDB — one parsed incoming SMS. Kept as its own table (rather
    than just updating Transaction directly) so every SMS the app has ever
    seen is auditable, including the ones that never matched anything.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, DateTime
from .database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class TransactionDB(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=gen_id)
    item = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    amount = Column(Float, nullable=False)
    customer_name = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="PENDING", nullable=False)  # PENDING | PAID
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, nullable=True)


class PaymentMessageDB(Base):
    __tablename__ = "payment_messages"

    id = Column(String, primary_key=True, default=gen_id)
    # Device-provided SMS id when available (Android SMS content provider's
    # own row id). Unique so the same SMS can never be stored twice, even if
    # the app tries to re-ingest it (e.g. after a crash/restart).
    sms_id = Column(String, unique=True, nullable=True, index=True)
    sender = Column(String, nullable=True)
    raw_sms = Column(String, nullable=False)
    type = Column(String, nullable=False)  # CREDIT | DEBIT | UNKNOWN
    amount = Column(Float, nullable=True)
    reference = Column(String, nullable=True)
    sms_timestamp = Column(DateTime, nullable=False)
    # Set once this message has been used to mark a transaction PAID.
    # A non-null value here is what prevents the same SMS being used twice.
    matched_transaction_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

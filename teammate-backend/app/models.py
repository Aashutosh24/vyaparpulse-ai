import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex[:12]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String, primary_key=True, default=_uuid)
    merchant_id = Column(String, index=True, nullable=False)

    customer_name = Column(String, nullable=True, index=True)  # optional; set by voice-agent
    item = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    amount = Column(Float, nullable=False)

    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    status = Column(String, default="PENDING", index=True)  # PENDING | PAID | EXPIRED

    paid_at = Column(DateTime(timezone=True), nullable=True)
    payment_id = Column(String, ForeignKey("payments.payment_id"), nullable=True)

    payment = relationship("Payment", back_populates="transactions")


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(String, primary_key=True, default=_uuid)
    merchant_id = Column(String, index=True, nullable=False)

    type = Column(String, nullable=False)  # CREDIT | DEBIT
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Raw text of the SMS/notification, kept for debugging & audit trail.
    raw_message = Column(String, nullable=True)

    # Best-effort unique fingerprint of the source message (e.g. hash of raw
    # text + sender), used for duplicate-payment prevention when the bank
    # doesn't give us a clean reference/UTR number.
    dedupe_key = Column(String, unique=True, index=True, nullable=True)

    processed = Column(Boolean, default=False)  # True once matched or explicitly skipped
    matched = Column(Boolean, default=False)    # True only if it produced a PAID transaction

    received_at = Column(DateTime(timezone=True), default=utcnow)

    transactions = relationship("Transaction", back_populates="payment")

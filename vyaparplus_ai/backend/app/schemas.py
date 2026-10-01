"""Pydantic schemas — request/response shapes for every endpoint."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TransactionStatus(str, Enum):
    pending = "PENDING"
    paid = "PAID"


class TransactionCreate(BaseModel):
    item: Optional[str] = None
    quantity: Optional[int] = None
    amount: float
    customer_name: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item: Optional[str] = None
    quantity: Optional[int] = None
    amount: float
    customer_name: Optional[str] = None
    timestamp: datetime
    status: TransactionStatus
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None


class PaymentMessageIn(BaseModel):
    # Device-provided unique SMS id, if the caller has one (real Android SMS
    # does; mock data supplies its own). Used for de-duplication.
    sms_id: Optional[str] = None
    sender: Optional[str] = None
    raw_sms: str
    # If omitted, the server timestamps it on arrival. Real SMS should
    # always pass the device's own message timestamp — that's what the
    # matcher compares against transaction time, not server receive time.
    sms_timestamp: Optional[datetime] = None


class PaymentMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sms_id: Optional[str] = None
    sender: Optional[str] = None
    raw_sms: str
    type: str
    amount: Optional[float] = None
    reference: Optional[str] = None
    sms_timestamp: datetime
    matched_transaction_id: Optional[str] = None
    created_at: datetime


class MatchResult(BaseModel):
    payment_message_id: str
    matched: bool
    transaction_id: Optional[str] = None
    reason: Optional[str] = None


class DailySummary(BaseModel):
    date: str
    total_transactions: int
    total_amount: float
    paid_transactions: int
    paid_amount: float
    pending_transactions: int
    pending_amount: float

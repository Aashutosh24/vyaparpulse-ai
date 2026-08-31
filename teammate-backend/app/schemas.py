from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------- Transactions ----------------------------------

class TransactionCreate(BaseModel):
    """Payload sent by the voice-agent module when a new sale is spoken out."""
    merchant_id: Optional[str] = None  # falls back to DEFAULT_MERCHANT_ID if omitted
    customer_name: Optional[str] = None  # who the sale was made to
    item: str
    quantity: int = 1
    amount: float = Field(gt=0)
    created_at: Optional[datetime] = None  # defaults to "now" if omitted


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: str
    merchant_id: str
    customer_name: Optional[str] = None
    item: str
    quantity: int
    amount: float
    created_at: datetime
    status: str
    paid_at: Optional[datetime] = None
    payment_id: Optional[str] = None


class TodaySummary(BaseModel):
    date: str
    merchant_id: str
    total_transactions: int
    paid_count: int
    pending_count: int
    total_paid_amount: float
    total_pending_amount: float


class DailyRevenue(BaseModel):
    date: str
    revenue: float
    transaction_count: int


class InsightsSummary(BaseModel):
    merchant_id: str
    period_days: int
    total_revenue: float
    revenue_change_percent: float  # vs previous equivalent period
    collection_rate: float          # paid / total
    pending_amount: float
    transaction_count: int
    top_product: Optional[str] = None
    daily_revenue: List[DailyRevenue]  # last N days, ascending


# ------------------------------ Payments ------------------------------------

class PaymentCreate(BaseModel):
    """Structured payload if the client already parsed the payment itself."""
    merchant_id: Optional[str] = None
    type: Literal["CREDIT", "DEBIT"]
    amount: float = Field(gt=0)
    timestamp: Optional[datetime] = None
    raw_message: Optional[str] = None
    reference: Optional[str] = None  # bank UTR / txn ref if available


class PaymentRawIn(BaseModel):
    """
    Payload for raw SMS / notification text captured on the Android device
    (e.g. via a NotificationListenerService). The backend extracts type,
    amount, and timestamp itself.
    """
    merchant_id: Optional[str] = None
    message: str
    # When the notification/SMS arrived on the phone. If omitted, "now" is
    # used, which is fine since bank SMS usually arrive within seconds of
    # the actual debit/credit.
    received_at: Optional[datetime] = None
    sender: Optional[str] = None  # e.g. "VM-HDFCBK" - improves dedupe key


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_id: str
    merchant_id: str
    type: str
    amount: float
    timestamp: datetime
    raw_message: Optional[str] = None
    processed: bool
    matched: bool
    received_at: datetime


class PaymentResult(BaseModel):
    payment: PaymentOut
    matched_transaction: Optional[TransactionOut] = None
    message: str


class PaymentMatchIn(BaseModel):
    """
    Body for PATCH /payments/{payment_id}/match.
    Pass `transaction_id` to link the payment to a specific pending transaction.
    Pass `transaction_id=null` (or omit) to mark the payment as intentionally
    skipped without matching.
    """
    transaction_id: Optional[str] = None


# ------------------------------ Intelligence --------------------------------

class IntelligenceForecast(BaseModel):
    next_7_days_revenue: Optional[float] = None
    confidence: Optional[float] = None
    range: Optional[float] = None

class IntelligenceHealth(BaseModel):
    revenue_growth_pct: Optional[float] = None
    payment_collection_rate: Optional[float] = None
    outstanding_ratio: Optional[float] = None
    revenue_volatility_7d: Optional[float] = None
    payment_reliability: Optional[float] = None

class IntelligenceInsights(BaseModel):
    product_demand: dict = Field(default_factory=dict)

class IntelligenceResponse(BaseModel):
    status: str
    forecast: IntelligenceForecast
    health: IntelligenceHealth
    insights: IntelligenceInsights

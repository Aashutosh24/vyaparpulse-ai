import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Text, JSON
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


# ─────────────────────────────────────────────────────────────────────────────
# SAKSHAM Economic Intelligence Models
# ─────────────────────────────────────────────────────────────────────────────

class Product(Base):
    """Product catalog — selling prices, purchase prices, supplier."""
    __tablename__ = "products"

    product_id = Column(String, primary_key=True, default=_uuid)
    merchant_id = Column(String, index=True, nullable=False)

    name = Column(String, nullable=False, index=True)
    unit = Column(String, nullable=False, default="piece")  # kg, litre, piece, packet, bag
    category = Column(String, nullable=True)

    selling_price = Column(Float, nullable=False)
    purchase_price_old = Column(Float, nullable=True)   # before latest supplier change
    purchase_price_new = Column(Float, nullable=False)  # current purchase price
    supplier_name = Column(String, nullable=True)

    margin_old = Column(Float, nullable=True)    # % business label
    margin_new = Column(Float, nullable=False)   # % business label

    safety_stock_days = Column(Float, default=2.0)
    reorder_unit = Column(Float, default=1.0)  # standard purchase quantity

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    inventory_snapshots = relationship("InventorySnapshot", back_populates="product")
    price_history = relationship("SupplierPriceHistory", back_populates="product")


class InventorySnapshot(Base):
    """Point-in-time stock level for a product."""
    __tablename__ = "inventory_snapshots"

    snapshot_id = Column(String, primary_key=True, default=_uuid)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False, index=True)
    merchant_id = Column(String, index=True, nullable=False)

    quantity = Column(Float, nullable=False)       # in product's unit
    source = Column(String, default="manual")      # manual | invoice | estimated
    notes = Column(String, nullable=True)

    recorded_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    product = relationship("Product", back_populates="inventory_snapshots")


class SupplierInvoice(Base):
    """A supplier invoice — scanned or manually entered.
    Becomes part of the Business Evidence stream.
    """
    __tablename__ = "supplier_invoices"

    invoice_id = Column(String, primary_key=True, default=_uuid)
    merchant_id = Column(String, index=True, nullable=False)

    supplier_name = Column(String, nullable=False, index=True)
    invoice_number = Column(String, nullable=True)
    invoice_date = Column(String, nullable=False)  # ISO date string

    # JSON array of {product_name, quantity, unit, unit_price, total_amount, product_id?}
    line_items = Column(JSON, nullable=False, default=list)
    grand_total = Column(Float, nullable=True)

    source = Column(String, default="manual")   # manual | scanned | demo
    ocr_confidence = Column(Float, nullable=True)   # 0-1, present only for scanned
    raw_text = Column(Text, nullable=True)          # Raw OCR text for debugging

    added_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    price_history_entries = relationship("SupplierPriceHistory", back_populates="invoice")


class SupplierPriceHistory(Base):
    """Tracks supplier price per product over time.
    Populated automatically when a SupplierInvoice is processed.
    """
    __tablename__ = "supplier_price_history"

    id = Column(String, primary_key=True, default=_uuid)
    merchant_id = Column(String, index=True, nullable=False)

    supplier_name = Column(String, nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=True, index=True)
    product_name = Column(String, nullable=False)   # denormalized for resilience

    price_per_unit = Column(Float, nullable=False)
    unit = Column(String, nullable=False)

    invoice_id = Column(String, ForeignKey("supplier_invoices.invoice_id"), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    product = relationship("Product", back_populates="price_history")
    invoice = relationship("SupplierInvoice", back_populates="price_history_entries")

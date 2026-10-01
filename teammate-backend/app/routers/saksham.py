"""
SAKSHAM Economic Intelligence API Router
=========================================
Endpoints for the SAKSHAM layer:
  - Product catalog
  - Inventory management
  - Supplier invoices (business evidence)
  - Supplier price history
  - Economic memory
  - Reorder recommendations
  - Demo seed

All business calculations happen in the frontend Economic Engine.
The backend stores and retrieves evidence; it does NOT run inference.
"""
from typing import List, Optional
from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.config import DEFAULT_MERCHANT_ID
from app.database import get_db
from app.models import utcnow

router = APIRouter(prefix="/saksham", tags=["saksham"])


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    product_id: str
    merchant_id: str
    name: str
    unit: str
    category: Optional[str]
    selling_price: float
    purchase_price_old: Optional[float]
    purchase_price_new: float
    supplier_name: Optional[str]
    margin_old: Optional[float]
    margin_new: float
    safety_stock_days: float
    reorder_unit: float

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    merchant_id: Optional[str] = None
    name: str
    unit: str = "piece"
    category: Optional[str] = None
    selling_price: float
    purchase_price_old: Optional[float] = None
    purchase_price_new: float
    supplier_name: Optional[str] = None
    margin_old: Optional[float] = None
    margin_new: float
    safety_stock_days: float = 2.0
    reorder_unit: float = 1.0


class InventorySnapshotOut(BaseModel):
    snapshot_id: str
    product_id: str
    merchant_id: str
    quantity: float
    source: str
    notes: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


class InventoryCreate(BaseModel):
    merchant_id: Optional[str] = None
    product_id: str
    quantity: float
    source: str = "manual"
    notes: Optional[str] = None


class InvoiceLineIn(BaseModel):
    product_name: str
    quantity: float
    unit: str
    unit_price: float
    total_amount: float
    product_id: Optional[str] = None


class SupplierInvoiceCreate(BaseModel):
    merchant_id: Optional[str] = None
    supplier_name: str
    invoice_number: Optional[str] = None
    invoice_date: str
    line_items: List[InvoiceLineIn]
    grand_total: Optional[float] = None
    source: str = "manual"
    ocr_confidence: Optional[float] = None
    raw_text: Optional[str] = None


class SupplierInvoiceOut(BaseModel):
    invoice_id: str
    merchant_id: str
    supplier_name: str
    invoice_number: Optional[str]
    invoice_date: str
    line_items: list
    grand_total: Optional[float]
    source: str
    ocr_confidence: Optional[float]
    added_at: datetime

    class Config:
        from_attributes = True


class SupplierPriceHistoryOut(BaseModel):
    id: str
    merchant_id: str
    supplier_name: str
    product_id: Optional[str]
    product_name: str
    price_per_unit: float
    unit: str
    invoice_id: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


# ─── Products ────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductOut])
def list_products(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """All products in the merchant's catalog."""
    return (
        db.query(models.Product)
        .filter(models.Product.merchant_id == merchant_id)
        .order_by(models.Product.name)
        .all()
    )


@router.post("/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
):
    """Add a new product to the catalog."""
    product = models.Product(
        merchant_id=payload.merchant_id or DEFAULT_MERCHANT_ID,
        name=payload.name,
        unit=payload.unit,
        category=payload.category,
        selling_price=payload.selling_price,
        purchase_price_old=payload.purchase_price_old,
        purchase_price_new=payload.purchase_price_new,
        supplier_name=payload.supplier_name,
        margin_old=payload.margin_old,
        margin_new=payload.margin_new,
        safety_stock_days=payload.safety_stock_days,
        reorder_unit=payload.reorder_unit,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ─── Inventory ────────────────────────────────────────────────────────────────

@router.get("/inventory", response_model=List[InventorySnapshotOut])
def list_inventory(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """Latest inventory snapshot per product."""
    # Subquery: most recent snapshot per product
    from sqlalchemy import func
    latest_dates = (
        db.query(
            models.InventorySnapshot.product_id,
            func.max(models.InventorySnapshot.recorded_at).label("max_date"),
        )
        .filter(models.InventorySnapshot.merchant_id == merchant_id)
        .group_by(models.InventorySnapshot.product_id)
        .subquery()
    )
    snapshots = (
        db.query(models.InventorySnapshot)
        .join(
            latest_dates,
            (models.InventorySnapshot.product_id == latest_dates.c.product_id)
            & (models.InventorySnapshot.recorded_at == latest_dates.c.max_date),
        )
        .filter(models.InventorySnapshot.merchant_id == merchant_id)
        .all()
    )
    return snapshots


@router.post("/inventory", response_model=InventorySnapshotOut)
def record_inventory(
    payload: InventoryCreate,
    db: Session = Depends(get_db),
):
    """Record a new inventory snapshot (stock level)."""
    # Verify product exists
    product = db.query(models.Product).filter(
        models.Product.product_id == payload.product_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    snapshot = models.InventorySnapshot(
        product_id=payload.product_id,
        merchant_id=payload.merchant_id or DEFAULT_MERCHANT_ID,
        quantity=payload.quantity,
        source=payload.source,
        notes=payload.notes,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


# ─── Supplier invoices ────────────────────────────────────────────────────────

@router.get("/invoices", response_model=List[SupplierInvoiceOut])
def list_invoices(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """All stored supplier invoices, newest first."""
    return (
        db.query(models.SupplierInvoice)
        .filter(models.SupplierInvoice.merchant_id == merchant_id)
        .order_by(models.SupplierInvoice.added_at.desc())
        .all()
    )


@router.post("/invoices", response_model=SupplierInvoiceOut)
def create_invoice(
    payload: SupplierInvoiceCreate,
    db: Session = Depends(get_db),
):
    """
    Store a supplier invoice and automatically populate SupplierPriceHistory
    for each line item that can be matched to a product.
    """
    merchant_id = payload.merchant_id or DEFAULT_MERCHANT_ID
    grand_total = payload.grand_total or sum(l.total_amount for l in payload.line_items)

    invoice = models.SupplierInvoice(
        merchant_id=merchant_id,
        supplier_name=payload.supplier_name,
        invoice_number=payload.invoice_number,
        invoice_date=payload.invoice_date,
        line_items=[l.dict() for l in payload.line_items],
        grand_total=grand_total,
        source=payload.source,
        ocr_confidence=payload.ocr_confidence,
        raw_text=payload.raw_text,
    )
    db.add(invoice)
    db.flush()  # get invoice_id before committing

    # Auto-populate price history for matched products
    for line in payload.line_items:
        product = None
        if line.product_id:
            product = db.query(models.Product).filter(
                models.Product.product_id == line.product_id,
                models.Product.merchant_id == merchant_id,
            ).first()
        if product is None:
            # Try fuzzy name match
            product = db.query(models.Product).filter(
                models.Product.merchant_id == merchant_id,
                models.Product.name.ilike(f"%{line.product_name.split()[0]}%"),
            ).first()

        price_entry = models.SupplierPriceHistory(
            merchant_id=merchant_id,
            supplier_name=payload.supplier_name,
            product_id=product.product_id if product else None,
            product_name=line.product_name,
            price_per_unit=line.unit_price,
            unit=line.unit,
            invoice_id=invoice.invoice_id,
            recorded_at=utcnow(),
        )
        db.add(price_entry)

        # Update product's current purchase price if it changed
        if product and line.unit_price != product.purchase_price_new:
            product.purchase_price_old = product.purchase_price_new
            product.purchase_price_new = line.unit_price
            # Recalculate margin: (selling - purchase) / selling * 100
            if product.selling_price > 0:
                old_margin = product.margin_new
                new_margin = round(
                    (product.selling_price - line.unit_price) / product.selling_price * 100, 1
                )
                product.margin_old = old_margin
                product.margin_new = new_margin

    db.commit()
    db.refresh(invoice)
    return invoice


# ─── Supplier price history ────────────────────────────────────────────────────

@router.get("/prices", response_model=List[SupplierPriceHistoryOut])
def get_price_history(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    product_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Supplier price history, optionally filtered by product."""
    query = db.query(models.SupplierPriceHistory).filter(
        models.SupplierPriceHistory.merchant_id == merchant_id
    )
    if product_id:
        query = query.filter(models.SupplierPriceHistory.product_id == product_id)
    return query.order_by(models.SupplierPriceHistory.recorded_at.desc()).all()


# ─── Economic memory ──────────────────────────────────────────────────────────

@router.get("/memory")
def get_economic_memory(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """
    Return a structured economic memory snapshot.
    The frontend Economic Engine uses this as raw evidence;
    it computes the changes and builds the memory entries itself.
    """
    products = (
        db.query(models.Product)
        .filter(models.Product.merchant_id == merchant_id)
        .all()
    )
    price_changes = (
        db.query(models.SupplierPriceHistory)
        .filter(models.SupplierPriceHistory.merchant_id == merchant_id)
        .order_by(models.SupplierPriceHistory.recorded_at.desc())
        .limit(50)
        .all()
    )

    return {
        "merchant_id": merchant_id,
        "products": [
            {
                "product_id": p.product_id,
                "name": p.name,
                "unit": p.unit,
                "selling_price": p.selling_price,
                "purchase_price_old": p.purchase_price_old,
                "purchase_price_new": p.purchase_price_new,
                "margin_old": p.margin_old,
                "margin_new": p.margin_new,
                "supplier_name": p.supplier_name,
            }
            for p in products
        ],
        "price_changes": [
            {
                "product_name": pc.product_name,
                "supplier_name": pc.supplier_name,
                "price_per_unit": pc.price_per_unit,
                "unit": pc.unit,
                "recorded_at": pc.recorded_at.isoformat(),
            }
            for pc in price_changes
        ],
        "generated_at": utcnow().isoformat(),
    }


# ─── Demo seed ────────────────────────────────────────────────────────────────

@router.post("/seed")
def seed_demo_data(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """
    Seed the Raju General Store demo dataset.
    Safe to call multiple times — uses upsert logic on product names.
    Returns counts of what was created/updated.
    """
    created_products = 0
    created_inventory = 0
    created_invoices = 0

    from app.data.seed_data import DEMO_PRODUCTS, DEMO_INVOICES, DEMO_INVENTORY

    # Seed products
    for prod_data in DEMO_PRODUCTS:
        existing = db.query(models.Product).filter(
            models.Product.merchant_id == merchant_id,
            models.Product.name == prod_data["name"],
        ).first()
        if existing:
            # Update prices if changed
            for k, v in prod_data.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            product = models.Product(merchant_id=merchant_id, **prod_data)
            db.add(product)
            created_products += 1

    db.flush()

    # Seed inventory snapshots
    for inv_data in DEMO_INVENTORY:
        product = db.query(models.Product).filter(
            models.Product.merchant_id == merchant_id,
            models.Product.name == inv_data["product_name"],
        ).first()
        if product:
            snapshot = models.InventorySnapshot(
                product_id=product.product_id,
                merchant_id=merchant_id,
                quantity=inv_data["quantity"],
                source="manual",
                notes="Demo seed data",
            )
            db.add(snapshot)
            created_inventory += 1

    # Seed supplier invoices
    for inv in DEMO_INVOICES:
        existing_inv = db.query(models.SupplierInvoice).filter(
            models.SupplierInvoice.merchant_id == merchant_id,
            models.SupplierInvoice.invoice_number == inv["invoice_number"],
        ).first()
        if not existing_inv:
            invoice = models.SupplierInvoice(
                merchant_id=merchant_id,
                supplier_name=inv["supplier_name"],
                invoice_number=inv["invoice_number"],
                invoice_date=inv["invoice_date"],
                line_items=inv["line_items"],
                grand_total=inv["grand_total"],
                source="demo",
            )
            db.add(invoice)
            db.flush()

            # Add price history
            for line in inv["line_items"]:
                product = db.query(models.Product).filter(
                    models.Product.merchant_id == merchant_id,
                    models.Product.name.ilike(f"%{line['product_name'].split()[0]}%"),
                ).first()
                ph = models.SupplierPriceHistory(
                    merchant_id=merchant_id,
                    supplier_name=inv["supplier_name"],
                    product_id=product.product_id if product else None,
                    product_name=line["product_name"],
                    price_per_unit=line["unit_price"],
                    unit=line["unit"],
                    invoice_id=invoice.invoice_id,
                )
                db.add(ph)
            created_invoices += 1

    db.commit()

    return {
        "status": "seeded",
        "created_products": created_products,
        "created_inventory_snapshots": created_inventory,
        "created_invoices": created_invoices,
        "merchant_id": merchant_id,
    }

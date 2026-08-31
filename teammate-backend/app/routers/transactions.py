from collections import Counter, defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import DEFAULT_MERCHANT_ID, PENDING_ALERT_AFTER_MINUTES
from app.database import get_db
from app.matching import is_stale

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=schemas.TransactionOut)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    """Called by the voice-agent module right after it parses a spoken sale."""
    return crud.create_transaction(db, payload)


@router.get("", response_model=List[schemas.TransactionOut])
def list_transactions(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """All transactions for a merchant, optionally filtered by status (PENDING/PAID)."""
    return crud.get_transactions(db, merchant_id=merchant_id, status=status, limit=limit, offset=offset)


@router.get("/pending", response_model=List[schemas.TransactionOut])
def list_pending_transactions(merchant_id: str = DEFAULT_MERCHANT_ID, db: Session = Depends(get_db)):
    """Currently pending (unpaid) transactions."""
    return crud.get_transactions(db, merchant_id=merchant_id, status="PENDING")


@router.get("/pending/stale", response_model=List[schemas.TransactionOut])
def list_stale_pending_transactions(merchant_id: str = DEFAULT_MERCHANT_ID, db: Session = Depends(get_db)):
    """
    Pending transactions older than PENDING_ALERT_AFTER_MINUTES — use this to
    drive an "unpaid transaction" push notification on the Flutter app.
    """
    pending = crud.get_transactions(db, merchant_id=merchant_id, status="PENDING")
    return [t for t in pending if is_stale(t, PENDING_ALERT_AFTER_MINUTES)]


@router.get("/today", response_model=schemas.TodaySummary)
def todays_summary(merchant_id: str = DEFAULT_MERCHANT_ID, db: Session = Depends(get_db)):
    txns = crud.get_todays_transactions(db, merchant_id)
    paid = [t for t in txns if t.status == "PAID"]
    pending = [t for t in txns if t.status == "PENDING"]
    from app.models import utcnow
    return schemas.TodaySummary(
        date=utcnow().date().isoformat(),
        merchant_id=merchant_id,
        total_transactions=len(txns),
        paid_count=len(paid),
        pending_count=len(pending),
        total_paid_amount=sum(t.amount for t in paid),
        total_pending_amount=sum(t.amount for t in pending),
    )


@router.get("/insights", response_model=schemas.InsightsSummary)
def get_insights(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    days: int = 7,
    db: Session = Depends(get_db),
):
    """
    Returns business insights for the last `days` days:
    revenue total, collection rate, % change vs prior period,
    per-day trend array, top product, pending amount.
    """
    current_txns, prev_txns = crud.get_insights_data(db, merchant_id, days)

    # Revenue / collection for current period
    paid_txns = [t for t in current_txns if t.status == "PAID"]
    pending_txns = [t for t in current_txns if t.status == "PENDING"]
    total_revenue = sum(t.amount for t in paid_txns)
    pending_amount = sum(t.amount for t in pending_txns)
    collection_rate = (total_revenue / (total_revenue + pending_amount)) if (total_revenue + pending_amount) > 0 else 0.0

    # Revenue change % vs previous period
    prev_revenue = sum(t.amount for t in prev_txns if t.status == "PAID")
    if prev_revenue > 0:
        revenue_change_pct = ((total_revenue - prev_revenue) / prev_revenue) * 100
    else:
        revenue_change_pct = 0.0

    # Top product by total paid revenue
    product_revenue: Counter = Counter()
    for t in paid_txns:
        product_revenue[t.item] += t.amount
    top_product = product_revenue.most_common(1)[0][0] if product_revenue else None

    # Per-day revenue trend (last `days` days, ascending)
    from datetime import timezone
    from app.models import utcnow
    now = utcnow()
    daily: defaultdict = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    for t in paid_txns:
        day = t.created_at.astimezone(timezone.utc).date().isoformat()
        daily[day]["revenue"] += t.amount
        daily[day]["count"] += 1

    daily_revenue = []
    for i in range(days - 1, -1, -1):
        from datetime import timedelta
        d = (now - timedelta(days=i)).date().isoformat()
        daily_revenue.append(schemas.DailyRevenue(
            date=d,
            revenue=round(daily[d]["revenue"], 2),
            transaction_count=daily[d]["count"],
        ))

    return schemas.InsightsSummary(
        merchant_id=merchant_id,
        period_days=days,
        total_revenue=round(total_revenue, 2),
        revenue_change_percent=round(revenue_change_pct, 1),
        collection_rate=round(collection_rate, 4),
        pending_amount=round(pending_amount, 2),
        transaction_count=len(current_txns),
        top_product=top_product,
        daily_revenue=daily_revenue,
    )


@router.get("/{transaction_id}", response_model=schemas.TransactionOut)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    txn = crud.get_transaction(db, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


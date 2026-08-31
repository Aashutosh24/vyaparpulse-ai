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


@router.get("/intelligence/ml2", response_model=schemas.IntelligenceResponse)
def get_intelligence(
    merchant_id: str = DEFAULT_MERCHANT_ID,
    db: Session = Depends(get_db),
):
    """
    Returns the ML-2 intelligence, forecasting, and health data for the merchant.
    """
    import sys
    from pathlib import Path
    import pandas as pd

    # 1. Fetch transactions and payments
    txns = crud.get_transactions(db, merchant_id=merchant_id)
    pays = crud.get_payments(db, merchant_id=merchant_id)
    
    ml2_txns = []
    for t in txns:
        ml2_txns.append({
            "transaction_id": t.transaction_id,
            "merchant_id": t.merchant_id,
            "customer": t.customer_name,
            "items": [{"product": t.item, "quantity": t.quantity}],
            "amount": float(t.amount),
            "timestamp": t.created_at.isoformat(),
            "confidence": 1.0
        })
        
    ml2_pays = []
    for p in pays:
        if p.matched:
            ml2_pays.append({
                "payment_id": p.payment_id,
                "merchant_id": p.merchant_id,
                "transaction_id": p.transactions[0].transaction_id if p.transactions else None,
                "amount": float(p.amount),
                "timestamp": p.timestamp.isoformat()
            })
            
    # Add ml2 path dynamically and invoke
    ml2_path = str(Path(__file__).resolve().parent.parent.parent.parent / "ml2")
    if ml2_path not in sys.path:
        sys.path.append(ml2_path)
        
    try:
        from features import feature_engine
        from predict import _most_recent_complete_row
        from forecasting.predict import load_latest, predict_next_7_days
    except ImportError as e:
        print("ImportError loading ML-2:", e)
        return schemas.IntelligenceResponse(
            status="error",
            forecast=schemas.IntelligenceForecast(),
            health=schemas.IntelligenceHealth(),
            insights=schemas.IntelligenceInsights()
        )
        
    try:
        result = feature_engine.generate(transactions=ml2_txns, payments=ml2_pays)
    except Exception as e:
        print("Error generating features:", e)
        return schemas.IntelligenceResponse(
            status="insufficient_data",
            forecast=schemas.IntelligenceForecast(),
            health=schemas.IntelligenceHealth(),
            insights=schemas.IntelligenceInsights()
        )
        
    features_df = result.features
    if features_df is None or features_df.empty:
        return schemas.IntelligenceResponse(
            status="insufficient_data",
            forecast=schemas.IntelligenceForecast(),
            health=schemas.IntelligenceHealth(),
            insights=schemas.IntelligenceInsights()
        )
        
    features_df = features_df[features_df["merchant_id"] == merchant_id]
    if features_df.empty:
        return schemas.IntelligenceResponse(
            status="insufficient_data",
            forecast=schemas.IntelligenceForecast(),
            health=schemas.IntelligenceHealth(),
            insights=schemas.IntelligenceInsights()
        )
        
    # Get the literal last row for health stats
    latest_row = features_df.iloc[-1].fillna(value=pd.NA).to_dict()
    
    def get_val(val):
        return None if pd.isna(val) else float(val)

    health = schemas.IntelligenceHealth(
        revenue_growth_pct=get_val(latest_row.get("revenue_growth_pct")),
        payment_collection_rate=get_val(latest_row.get("payment_collection_rate")),
        outstanding_ratio=get_val(latest_row.get("outstanding_ratio")),
        revenue_volatility_7d=get_val(latest_row.get("revenue_volatility_7d")),
        payment_reliability=get_val(latest_row.get("payment_reliability"))
    )
    
    insights = schemas.IntelligenceInsights(
        product_demand=latest_row.get("product_demand", {})
    )
    
    forecast = schemas.IntelligenceForecast()
    row = _most_recent_complete_row(features_df)
    if row is not None:
        try:
            # Note: models are loaded from ml2/models/ which relies on CWD if not absolute.
            # load_latest() uses MODELS_DIR = Path(__file__).parent.parent / "models"
            # which is correctly absolute based on file.
            model = load_latest()
            prediction = predict_next_7_days(model, row)
            forecast.next_7_days_revenue = float(prediction)
        except Exception as e:
            print("Error forecasting:", e)
            pass
            
    return schemas.IntelligenceResponse(
        status="success",
        forecast=forecast,
        health=health,
        insights=insights
    )



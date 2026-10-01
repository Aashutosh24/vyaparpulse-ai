"""
VyaparPlus AI — backend entrypoint.

Run with: uvicorn app.main:app --reload
Interactive docs at: http://127.0.0.1:8000/docs
"""

from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from . import models, schemas, mock_data
from .database import Base, engine, get_db
from .sms_parser import parse_sms
from .matcher import run_matching

Base.metadata.create_all(bind=engine)

app = FastAPI(title="VyaparPlus AI - Backend")


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@app.post("/transactions", response_model=schemas.TransactionOut)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    """Manual transaction entry. Every new transaction starts PENDING."""
    txn = models.TransactionDB(
        item=payload.item,
        quantity=payload.quantity,
        amount=payload.amount,
        customer_name=payload.customer_name,
        timestamp=datetime.utcnow(),
        status="PENDING",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@app.get("/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(status: Optional[str] = None, db: Session = Depends(get_db)):
    """All transactions, optionally filtered by ?status=PENDING or PAID."""
    query = db.query(models.TransactionDB)
    if status:
        query = query.filter(models.TransactionDB.status == status.upper())
    return query.order_by(models.TransactionDB.timestamp.desc()).all()


@app.get("/transactions/pending", response_model=list[schemas.TransactionOut])
def list_pending_transactions(db: Session = Depends(get_db)):
    return (
        db.query(models.TransactionDB)
        .filter(models.TransactionDB.status == "PENDING")
        .order_by(models.TransactionDB.timestamp.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Payment messages
# ---------------------------------------------------------------------------

@app.post("/payments", response_model=schemas.PaymentMessageOut)
def receive_payment_message(payload: schemas.PaymentMessageIn, db: Session = Depends(get_db)):
    """
    Receives one SMS from the mobile app (real Android SMS or mock data),
    parses it, and stores it. If sms_id has already been ingested, the
    existing record is returned instead of creating a duplicate — this is
    the de-duplication half of "never process the same SMS twice"; the
    other half (never using one SMS to pay two transactions) lives in the
    matcher via matched_transaction_id.
    """
    if payload.sms_id:
        existing = (
            db.query(models.PaymentMessageDB)
            .filter(models.PaymentMessageDB.sms_id == payload.sms_id)
            .first()
        )
        if existing:
            return existing

    parsed = parse_sms(payload.raw_sms)

    msg = models.PaymentMessageDB(
        sms_id=payload.sms_id,
        sender=payload.sender,
        raw_sms=payload.raw_sms,
        type=parsed.type,
        amount=parsed.amount,
        reference=parsed.reference,
        sms_timestamp=payload.sms_timestamp or datetime.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@app.get("/payments", response_model=list[schemas.PaymentMessageOut])
def list_payment_messages(db: Session = Depends(get_db)):
    """Every payment message the app has ever ingested, matched or not — powers the 'view detected payment messages' screen."""
    return (
        db.query(models.PaymentMessageDB)
        .order_by(models.PaymentMessageDB.created_at.desc())
        .all()
    )


@app.post("/payments/match", response_model=list[schemas.MatchResult])
def trigger_matching(db: Session = Depends(get_db)):
    """Runs matching now. This is what the app's 'Run Payment Verification' button calls."""
    return run_matching(db)


@app.post("/payments/mock/load", response_model=list[schemas.PaymentMessageOut])
def load_mock_payments(db: Session = Depends(get_db)):
    """
    Ingests a handful of representative SMS messages (mock_data.py) the same
    way real Android SMS would arrive via POST /payments — lets you
    demonstrate the full create-transaction -> receive-SMS -> match -> PAID
    flow without a physical device.
    """
    created = []
    for raw in mock_data.get_mock_sms():
        existing = (
            db.query(models.PaymentMessageDB)
            .filter(models.PaymentMessageDB.sms_id == raw["sms_id"])
            .first()
        )
        if existing:
            created.append(existing)
            continue

        parsed = parse_sms(raw["raw_sms"])
        msg = models.PaymentMessageDB(
            sms_id=raw["sms_id"],
            sender=raw["sender"],
            raw_sms=raw["raw_sms"],
            type=parsed.type,
            amount=parsed.amount,
            reference=parsed.reference,
            sms_timestamp=datetime.fromisoformat(raw["sms_timestamp"]),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        created.append(msg)
    return created


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@app.get("/summary/today", response_model=schemas.DailySummary)
def today_summary(db: Session = Depends(get_db)):
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    txns = (
        db.query(models.TransactionDB)
        .filter(models.TransactionDB.timestamp.between(start, end))
        .all()
    )

    paid = [t for t in txns if t.status == "PAID"]
    pending = [t for t in txns if t.status == "PENDING"]

    return schemas.DailySummary(
        date=today.isoformat(),
        total_transactions=len(txns),
        total_amount=sum(t.amount for t in txns),
        paid_transactions=len(paid),
        paid_amount=sum(t.amount for t in paid),
        pending_transactions=len(pending),
        pending_amount=sum(t.amount for t in pending),
    )


@app.get("/health")
def health():
    return {"status": "ok"}

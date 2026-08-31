import hashlib
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.config import DEFAULT_MERCHANT_ID
from app.database import get_db
from app.matching import process_payment
from app.models import utcnow
from app.payment_parser import parse_payment_message, make_dedupe_key

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=List[schemas.PaymentOut])
def list_payments(merchant_id: str = DEFAULT_MERCHANT_ID, db: Session = Depends(get_db)):
    return crud.get_payments(db, merchant_id=merchant_id)


@router.post("", response_model=schemas.PaymentResult)
def submit_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """
    Submit an already-structured payment (type/amount/timestamp known up
    front). Use this if the Android client does its own parsing, or for
    testing/demo purposes.
    """
    merchant_id = payload.merchant_id or DEFAULT_MERCHANT_ID
    timestamp = payload.timestamp or utcnow()

    dedupe_key = (
        f"ref:{payload.reference.upper()}"
        if payload.reference
        else "hash:" + hashlib.sha256(
            f"{merchant_id}|{payload.type}|{payload.amount}|{timestamp.isoformat()}".encode()
        ).hexdigest()[:24]
    )

    existing = crud.get_payment_by_dedupe_key(db, dedupe_key)
    if existing:
        return schemas.PaymentResult(
            payment=existing,
            matched_transaction=None,
            message="Payment already processed earlier (duplicate ignored).",
        )

    payment = crud.create_payment(
        db,
        merchant_id=merchant_id,
        type_=payload.type,
        amount=payload.amount,
        timestamp=timestamp,
        raw_message=payload.raw_message,
        dedupe_key=dedupe_key,
    )
    matched = process_payment(db, payment)

    return schemas.PaymentResult(
        payment=payment,
        matched_transaction=matched,
        message="Matched and marked PAID." if matched else "No matching pending transaction found.",
    )


@router.post("/raw", response_model=schemas.PaymentResult)
def submit_raw_payment_message(payload: schemas.PaymentRawIn, db: Session = Depends(get_db)):
    """
    Submit the raw text of a bank/UPI SMS or payment-app notification, as
    captured by the Android app's NotificationListenerService. The backend
    extracts CREDIT/DEBIT, amount, timestamp, and reference itself.
    """
    merchant_id = payload.merchant_id or DEFAULT_MERCHANT_ID
    received_at = payload.received_at or utcnow()

    parsed = parse_payment_message(payload.message, received_at=received_at)
    dedupe_key = make_dedupe_key(payload.message, payload.sender, parsed.reference)

    existing = crud.get_payment_by_dedupe_key(db, dedupe_key)
    if existing:
        return schemas.PaymentResult(
            payment=existing,
            matched_transaction=None,
            message="Payment already processed earlier (duplicate ignored).",
        )

    if not parsed.is_valid:
        # Not a recognizable payment message (could be an OTP, promo SMS,
        # balance-check alert, etc). We still store it as processed=True so
        # it isn't retried, but there's nothing to match.
        payment = crud.create_payment(
            db,
            merchant_id=merchant_id,
            type_="UNKNOWN",
            amount=0,
            timestamp=received_at,
            raw_message=payload.message,
            dedupe_key=dedupe_key,
        )
        payment.processed = True
        db.commit()
        db.refresh(payment)
        return schemas.PaymentResult(
            payment=payment,
            matched_transaction=None,
            message="Message did not look like a payment credit/debit alert; ignored.",
        )

    payment = crud.create_payment(
        db,
        merchant_id=merchant_id,
        type_=parsed.type,
        amount=parsed.amount,
        timestamp=parsed.timestamp,
        raw_message=payload.message,
        dedupe_key=dedupe_key,
    )
    matched = process_payment(db, payment)

    return schemas.PaymentResult(
        payment=payment,
        matched_transaction=matched,
        message="Matched and marked PAID." if matched else "No matching pending transaction found.",
    )


@router.patch("/{payment_id}/match", response_model=schemas.PaymentResult)
def manual_match_payment(
    payment_id: str,
    payload: schemas.PaymentMatchIn,
    db: Session = Depends(get_db),
):
    """
    Called by the Flutter Payment Review screen when the merchant manually
    selects which pending transaction an unmatched payment belongs to.

    - If `transaction_id` is provided: link the payment to that transaction
      and mark the transaction as PAID.
    - If `transaction_id` is null / omitted: mark the payment as processed
      (skipped) so the review banner disappears without matching anything.
    """
    payment = db.query(models.Payment).filter_by(
        payment_id=payment_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    matched_txn = None

    if payload.transaction_id:
        transaction = db.query(models.Transaction).filter_by(
            transaction_id=payload.transaction_id
        ).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if transaction.status != "PENDING":
            raise HTTPException(
                status_code=409,
                detail=f"Transaction is already {transaction.status}, cannot re-match.",
            )
        crud.link_payment_to_transaction(db, payment, transaction)
        db.refresh(transaction)
        matched_txn = transaction
        message = "Manually matched and marked PAID."
    else:
        # Merchant chose "None of these" — mark as intentionally skipped.
        payment.processed = True
        db.commit()
        db.refresh(payment)
        message = "Payment marked as reviewed (no match)."

    return schemas.PaymentResult(
        payment=payment,
        matched_transaction=matched_txn,
        message=message,
    )

# Smart Merchant — Payment Detection Backend

FastAPI backend that takes payment messages captured on the merchant's
Android device (bank/UPI SMS or notifications), extracts CREDIT/DEBIT +
amount + timestamp, and matches them against `PENDING` transactions created
by the voice-agent module.

Scope: **backend only** (no Flutter UI is built here — this just documents
what the Flutter app should call).

---

## 1. Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- `--host 0.0.0.0` so an Android device/emulator on the same network (or via
  `adb reverse tcp:8000 tcp:8000` for a USB-connected device) can reach it.
- Interactive API docs: `http://<server-ip>:8000/docs`
- Uses SQLite (`merchant.db`, created automatically on first run). To move
  to Postgres later, just set `DATABASE_URL` and reinstall `psycopg2-binary`
  — nothing else in the code needs to change (see `app/config.py`).

Config knobs (env vars, all optional):

| Var | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./merchant.db` | SQLAlchemy connection string |
| `MATCH_TIME_WINDOW_SECONDS` | `300` (5 min) | How close a payment's time must be to a transaction's `created_at` to count as a match |
| `PENDING_ALERT_AFTER_MINUTES` | `7` | Age after which a pending transaction is considered "stale" for merchant notification |
| `DEFAULT_MERCHANT_ID` | `merchant_1` | Used when a request omits `merchant_id` (single-merchant hackathon scope) |

---

## 2. How matching works

1. Voice-agent module calls `POST /transactions` right after a sale is
   spoken out loud → creates a row with `status=PENDING`.
2. Android app's `NotificationListenerService` (or SMS `BroadcastReceiver`)
   picks up a bank/UPI payment SMS/notification and posts the raw text to
   `POST /payments/raw`.
3. Backend extracts `CREDIT`/`DEBIT`, `amount`, and a `timestamp` from the
   text (`app/payment_parser.py`), and checks:
   - Has an equivalent payment already been processed? (dedupe key — UPI
     Ref/UTR if present, otherwise a hash of sender + message text) → if
     yes, **ignore**.
   - Is it a `CREDIT`?
   - Is there a `PENDING` transaction, same merchant, same `amount`, whose
     `created_at` is within `MATCH_TIME_WINDOW_SECONDS` of the payment
     timestamp?
   - If multiple candidates match, the closest in time wins.
4. On match: transaction → `PAID`, `paid_at` set, linked to the payment.
   No match: transaction stays `PENDING`.
5. `GET /transactions/pending/stale` returns transactions still pending
   past `PENDING_ALERT_AFTER_MINUTES`, for the app to raise an "unpaid
   transaction" alert.

---

## 3. API reference

Base URL: `http://<server-ip>:8000`

### Transactions (used by the voice-agent module + Flutter app)

**`POST /transactions`** — create a pending transaction
```json
// request
{ "item": "Samosa", "quantity": 2, "amount": 50, "merchant_id": "merchant_1" }

// response (201-ish, 200 by default FastAPI behavior)
{
  "transaction_id": "a1b2c3d4e5f6",
  "merchant_id": "merchant_1",
  "item": "Samosa",
  "quantity": 2,
  "amount": 50.0,
  "created_at": "2026-08-28T20:30:00+00:00",
  "status": "PENDING",
  "paid_at": null,
  "payment_id": null
}
```

**`GET /transactions?merchant_id=merchant_1&status=PENDING`** — list transactions
(status filter optional: `PENDING` / `PAID`)

**`GET /transactions/pending?merchant_id=merchant_1`** — currently pending

**`GET /transactions/pending/stale?merchant_id=merchant_1`** — pending &
older than the alert threshold (for merchant notifications)

**`GET /transactions/today?merchant_id=merchant_1`** — today's summary
```json
{
  "date": "2026-08-28",
  "merchant_id": "merchant_1",
  "total_transactions": 12,
  "paid_count": 9,
  "pending_count": 3,
  "total_paid_amount": 540.0,
  "total_pending_amount": 130.0
}
```

**`GET /transactions/{transaction_id}`** — single transaction

### Payments

**`POST /payments/raw`** — recommended for the Android app. Send the raw
SMS/notification text; backend does the parsing.
```json
// request
{
  "message": "Rs.50.00 credited to your A/c XX1234 on 28-08-26. UPI Ref 123456789012",
  "sender": "VM-HDFCBK",
  "merchant_id": "merchant_1"
}

// response
{
  "payment": { "payment_id": "...", "type": "CREDIT", "amount": 50.0, "...": "..." },
  "matched_transaction": { "transaction_id": "...", "status": "PAID", "...": "..." },
  "message": "Matched and marked PAID."
}
```

**`POST /payments`** — submit an already-structured payment (if the app
does its own parsing, or for quick testing):
```json
{ "type": "CREDIT", "amount": 50, "timestamp": "2026-08-28T20:31:00", "reference": "123456789012" }
```

**`GET /payments?merchant_id=merchant_1`** — list processed payments

---

## 4. Android integration notes

The Android app needs to capture bank/UPI payment alerts and forward the
raw text to `POST /payments/raw`. Two common approaches:

- **`NotificationListenerService`** (recommended) — listens to notifications
  from banking/UPI apps (GPay, PhonePe, Paytm, bank apps) without needing
  SMS permissions. Requires the user to grant "Notification access" once.
- **SMS `BroadcastReceiver`** on `SMS_RECEIVED` — simpler, but needs the
  `RECEIVE_SMS`/`READ_SMS` runtime permissions, which Play Store restricts
  to default SMS/dialer apps in most categories, so notification listening
  is usually the more viable path for a hackathon/production app.

Either way, the client just needs to POST the captured text as `message`
(plus `sender` if available) — parsing, deduping, and matching all happen
server-side.

For local testing against a physical device or emulator:
```bash
adb reverse tcp:8000 tcp:8000   # device can then reach http://localhost:8000
```

---

## 5. Project layout

```
app/
  config.py            # tunables (match window, DB URL, etc.)
  database.py           # SQLAlchemy engine/session
  models.py             # Transaction, Payment ORM models
  schemas.py             # Pydantic request/response models
  payment_parser.py     # regex extraction from raw SMS/notification text
  matching.py            # amount+time matching, PENDING -> PAID logic
  crud.py                 # DB read/write helpers
  routers/
    transactions.py
    payments.py
  main.py                  # FastAPI app + router wiring
requirements.txt
```

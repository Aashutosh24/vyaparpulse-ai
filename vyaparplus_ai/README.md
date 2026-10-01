# VyaparPlus AI — Offline-First Payment Tracking MVP

Small retailers record a sale, the app watches incoming bank SMS, and
matching CREDIT payments automatically flip transactions from `PENDING` to
`PAID`.

```
Create transaction (PENDING)
        |
Incoming SMS -> parse (CREDIT/DEBIT/amount/ref) -> store
        |
Run matching -> find PENDING txn with same amount, within time window
        |
Match found -> transaction -> PAID (+ paid_at, payment_reference)
        |
Dashboard reflects updated totals
```

This has been built and smoke-tested end-to-end (backend) as part of this
delivery — see "Verified" below.

## Project structure

```
vyaparplus_ai/
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # FastAPI app, all endpoints
│       ├── database.py        # SQLite engine/session
│       ├── models.py          # SQLAlchemy: Transaction, PaymentMessage
│       ├── schemas.py         # Pydantic request/response shapes
│       ├── sms_parser.py      # regex-based CREDIT/DEBIT/amount/ref extraction
│       ├── matcher.py         # matches CREDIT messages to PENDING transactions
│       └── mock_data.py       # sample SMS for testing without a device
│
└── frontend/                  # React Native testing UI
    ├── package.json
    ├── App.js                 # simple tab switcher (no nav library needed)
    └── src/
        ├── api.js             # fetch wrapper for every backend endpoint
        ├── SmsReader.js        # real Android SMS integration (see limitations)
        └── screens/
            ├── DashboardScreen.js
            ├── TransactionListScreen.js
            ├── NewTransactionScreen.js
            └── PaymentMessagesScreen.js
```

## Setup — from scratch

### Prerequisites
- Python 3.10+
- Node.js (18+) and either Android Studio (for `react-native run-android`)
  or a physical Android device with USB debugging enabled
- `git`, a terminal

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/docs` for interactive API docs. A SQLite file
(`vyaparplus.db`) is created automatically on first run, in `backend/`.

### 2. Frontend

```bash
cd frontend
npx react-native init VyaparPlusShell --version 0.74.0   # scaffolds android/ios folders
# then copy App.js and src/ from this project into the generated shell,
# and merge this package.json's dependencies into the generated one
npm install
npx react-native run-android
```

(The `android/`/`ios/` native project folders aren't included in this zip —
`react-native init` generates them fresh, since they're large, environment-
specific, and not meant to be hand-edited.)

Update `BASE_URL` in `src/api.js`:
- Android emulator → host machine: `http://10.0.2.2:8000`
- Physical device → your machine's LAN IP, e.g. `http://192.168.1.5:8000`

Add to `android/app/src/main/AndroidManifest.xml` if you're testing real SMS
reading (see limitations below):
```xml
<uses-permission android:name="android.permission.READ_SMS"/>
```

### Demoing the full flow without a device

The backend alone demonstrates everything end-to-end:

```bash
curl -X POST localhost:8000/transactions -H "Content-Type: application/json" \
  -d '{"item":"Samosa","quantity":2,"amount":50}'

curl -X POST localhost:8000/payments/mock/load   # loads 5 sample SMS, incl. a ₹50 CREDIT

curl -X POST localhost:8000/payments/match       # matches the ₹50 CREDIT to the Samosa transaction

curl localhost:8000/transactions                 # Samosa transaction is now PAID
curl localhost:8000/summary/today
```

**Verified**: this exact sequence was run against the actual backend during
this build. The ₹50 transaction correctly matched and flipped to `PAID`
with the SMS's reference number attached; a ₹20 transaction with no
matching SMS correctly stayed `PENDING`; the OTP and promotional mock
messages were correctly ignored (classified `UNKNOWN`, never considered for
matching); a ₹25 CREDIT message with no matching transaction correctly
produced a "no match" result instead of a false positive.

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/transactions` | Create a transaction manually. Starts `PENDING`. |
| GET | `/transactions` | List all transactions. Optional `?status=PENDING\|PAID`. |
| GET | `/transactions/pending` | List only pending transactions. |
| POST | `/payments` | Ingest one SMS (real or mock). Parses it, stores it, de-dupes by `sms_id`. |
| GET | `/payments` | List every ingested payment message, matched or not. |
| POST | `/payments/match` | Run matching now. Returns a result per attempted message. |
| POST | `/payments/mock/load` | Loads 5 sample SMS messages for testing. |
| GET | `/summary/today` | Today's totals: transactions, amount, paid/pending counts and amounts. |
| GET | `/health` | Liveness check. |

Full request/response schemas are in `backend/app/schemas.py` and the
auto-generated docs at `/docs`.

### Payment-matching rules (implemented in `matcher.py`)
- Only `CREDIT` messages are considered (never `DEBIT` or `UNKNOWN`).
- Only messages not already linked to a transaction are considered — this
  is what prevents one SMS from paying two transactions.
- A message matches the `PENDING` transaction with the same amount whose
  timestamp is closest to the SMS timestamp, within a 15-minute window
  (adjust `MATCH_WINDOW` in `matcher.py`).
- No match within the window → the transaction stays `PENDING`; nothing is
  guessed.

### SMS classification rules (implemented in `sms_parser.py`)
- OTP and promotional keywords are checked **first** and always win — a
  promotional message that happens to contain "credited" (e.g. a cashback
  offer) is still classified `UNKNOWN`, never `CREDIT`.
- `CREDIT`/`DEBIT` classification additionally requires a successfully
  extracted amount — a message with the right keyword but no parseable
  amount is stored as `UNKNOWN` for audit, not treated as a payment.

## Android SMS reading — real limitations

This matters before you plan how far this can go as a real product:

- **As of current Google Play policy, an app must be registered as the
  device's default SMS (or Assistant) handler before it is even permitted
  to request the `READ_SMS` permission.** This isn't a new rule you can
  design around — it applies to any app distributed through the Play
  Store. A small-business payment-tracking app realistically can't (and
  shouldn't) ask every merchant to make it their default texting app.
- This does **not** block local testing: the Android OS permission system
  itself has no such restriction — a sideloaded/dev-installed APK (`adb
  install`, or `react-native run-android` to a connected device) can
  request and use `READ_SMS` normally once the user grants it. That's
  exactly what `SmsReader.js` is built for here — it's genuinely useful
  for development, demos, and internal testing.
- **For an actual production release**, the realistic paths are: (a)
  integrate directly with the bank/UPI provider's payment webhook or API
  instead of reading SMS at all, or (b) have the merchant manually
  forward/paste the relevant SMS text into the app (still runs through the
  same `sms_parser.py`/`matcher.py` logic, just without automatic capture).
- iOS has no equivalent SMS-reading capability at all, by design — this
  feature is Android-only regardless of policy.

## Notes / open items

- This MVP doesn't include the voice-input piece from the earlier
  [[merchant-voice-agent]] work — "Allow manual transaction entry for
  testing" is the only transaction-creation path here, per this task's
  spec. Wiring voice input back in would mean adapting that Flutter-based
  module's logic into this React Native app (different framework), or
  running the two as separate modules behind the same backend.
- `react-native-get-sms-android` version in `package.json` was current at
  time of writing — check `npm info react-native-get-sms-android` before
  installing.
- The 15-minute match window and float amount tolerance in `matcher.py`
  are reasonable defaults, not tuned against real SMS-delay data — adjust
  once you see real-world timing between a sale and the bank's SMS.

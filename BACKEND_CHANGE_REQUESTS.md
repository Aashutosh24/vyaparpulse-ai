# Backend Change Requests

These are documented requirements for the teammate backend (smart_merchant_backend).
None of these changes are implemented — they are requests for the backend owner.

---

## Request 1 — Voice Provenance Persistence

**Endpoint:** `POST /transactions`
**HTTP method:** POST (existing endpoint, schema extension)
**Purpose:** Preserve voice recognition provenance so the frontend can display
the original spoken text and confidence score for auditing and review.

**Request changes:**
Add two optional fields to the `TransactionCreate` schema:
```python
raw_text: str | None = None    # The exact text the voice agent heard
confidence: float | None = None  # Voice recognition confidence (0.0–1.0)
```

**Response changes:**
Include both fields in `TransactionOut`.

**Frontend dependency:**
- `SaleReviewCard` already renders a dynamic confidence badge from this value.
- `canonicalTransaction.ts` already maps `voice.rawText` and `voice.confidence`
  but has nowhere to send them today.

**ML dependency:** None.

**Priority:** Medium — the frontend works without it, but voice provenance is
lost on persistence today. Important for the SIH demo narrative (traceability).

---

## Request 2 — Payment Match Candidates

**Endpoint:** `GET /payments/{payment_id}/candidates`
**HTTP method:** GET (new endpoint)
**Purpose:** Return nearby-amount/time PENDING transactions as candidate
matches with a computed distance/score, so the Payment Review screen can
show real alternatives instead of a binary auto-match-or-nothing.

**Request:**
```
GET /payments/{payment_id}/candidates?limit=5
```

**Response:**
```json
{
  "payment_id": "...",
  "candidates": [
    {
      "transaction_id": "...",
      "customer_name": "...",
      "amount": 150.0,
      "created_at": "2025-01-15T10:30:00",
      "distance_score": 0.15,
      "reason": "Amount matches within ₹10, created 5 minutes before payment"
    }
  ]
}
```

**Frontend dependency:**
- `PaymentReview.tsx` already renders `payment.candidates` (type `MatchCandidate[]`)
  but currently only shows mock candidates populated locally.
- `backendClient.ts` does NOT yet have a method for this endpoint — it would
  need a new `getPaymentCandidates(paymentId)` wrapper.

**ML dependency:** None (this is a proximity/heuristic match, not ML).

**Priority:** High — without this, Payment Review cannot show real candidate
alternatives, which is a key differentiator in the SIH demo.

---

## Request 3 — ML Forecast Endpoint

**Endpoint:** `POST /ml/forecast`
**HTTP method:** POST (new endpoint)
**Purpose:** Expose ML-2's XGBoost forecasting model (already in this repo
at `ml2/forecasting/predict.py`) through the backend API so the browser
frontend can consume real predictions.

**Request:**
```
POST /ml/forecast?merchant_id=default
```
Body: empty or `{ "merchant_id": "default" }`

**Response:**
```json
{
  "source": "live",
  "expectedRevenue7d": 42500.0,
  "low": 41263.0,
  "high": 43737.0,
  "confidenceLabel": "High",
  "modelVersion": "xgboost-v1",
  "asOfDate": "2025-01-15"
}
```

The `low`/`high` band should be `expected ± measured validation MAE` (1237,
from `ml2/PHASE_2_FORECASTING.md`).

**Frontend dependency:**
- `mlAdapter.ts` already has a `LiveMLAdapter` class that calls exactly
  `GET {backendBaseUrl}/ml/forecast` and expects this exact response shape.
- `AppContext.tsx` is not yet wired to call it — that wiring is a one-line
  change once this endpoint exists.

**ML dependency:**
- Imports `ml2.forecasting.predict` internally (Python-to-Python call).
- Needs the trained model artifact (`ml2/models/xgboost_model.json`) to be
  accessible from the backend's Python environment.

**Priority:** High — this is the only blocker for showing real ML predictions
in the SIH demo. Without it, the Forecast screen falls back to the
LearningState empty view.

# VyaparPulse — Antigravity Handoff

Packaged as a checkpoint. Real, verified work below — nothing in this doc
is asserted without either a passing test, a live command run, or an
explicit "not verified" flag.

## 1. Current architecture

Four systems, three now genuinely wired at the frontend integration layer:

```
Magic Patterns Frontend (React/Vite/TS)
   ├── voiceAgentClient.ts  → Voice Agent (FastAPI, Vosk+extraction) — WIRED, text path live-verified
   ├── backendClient.ts     → Teammate Backend (FastAPI+SQLAlchemy)  — WIRED, live-verified
   └── mlAdapter.ts         → ML-2 (Python: schemas/validation/aggregation/
                               features/forecasting)                 — NOT WIRED (see §9)
```

ML-2 has no live path to the frontend yet: it's Python, the frontend is
browser TS, and connecting them needs either the teammate backend
exposing an endpoint that internally calls ML-2, or some other bridge —
this task is not allowed to build a backend, so `mlAdapter.ts` is
currently a documented, honestly-labeled mock. See §9, §12.

## 2. Completed work

- **ML-2** (separate, earlier effort, fully self-contained): Phase 1
  (schemas/validation/aggregation/feature engine), Phase 1.5 (audit,
  2 real bugs found+fixed, 2 gaps documented+tested), Phase 2 (moving-
  average baseline + XGBoost, honest comparison, XGBoost wins on
  synthetic data — see `ml2/PHASE_2_FORECASTING.md`). 67/67 tests.
- **Voice agent verified live**: fixed a real packaging bug (`app/models/`
  missing from the zip — `.gitignore`'s bare `models/` rule also matched
  it), reconstructed locally from direct evidence only. 90/90 of its own
  tests pass; live `POST /api/voice/text` call confirmed the exact
  documented contract.
- **Teammate backend verified live**: started against its own real
  `merchant.db`, queried `/transactions`, `/transactions/insights` live.
  Read `schemas.py`/`models.py`/`matching.py`/routers directly — not just
  the README.
- **Canonical transaction contract** (`canonicalTransaction.ts`): exact
  field-by-field mapping across all four systems' real (not assumed)
  transaction shapes, with every genuine gap documented inline (see §4).
- **`voiceAgentClient.ts`**, **`backendClient.ts`**, **`mlAdapter.ts`**: real
  TypeScript clients against the real, read APIs.
- **AppContext.tsx**: added `mode: 'demo' | 'live'` (defaults to `'demo'`
  — zero behavior change for existing usage). In live mode: fetches real
  transactions from the backend on mount instead of mock data; `addSale`
  keeps its exact existing synchronous/optimistic UX but also persists to
  the backend in the background and reconciles the local card's id to the
  backend's authoritative `transaction_id`.
- **RecordSale.tsx**: real branch for live mode using `VoiceAgentClient`'s
  WebSocket path, wired into the *same* `phase`/`transcript` state the
  demo simulation already used. Demo mode's code is untouched.
- **6/6 real, live integration checks passed** (`integration_test.ts`,
  run against both real servers, not mocks) — see §10.
- **Production build: clean** (`npm run build` and `npx tsc --noEmit`,
  both re-run immediately before this handoff).

## 3. Partially completed work — honestly

- **SaleReviewCard's confidence badge is still hardcoded** to "High
  confidence" — `voiceConfidence` is now captured in RecordSale.tsx's
  state (from the real voice result) but not yet threaded into the card
  prop. Small, mechanical, not done.
- **Live microphone/WebSocket path is implemented but NOT run** — this
  sandbox has no browser and no microphone. The text path
  (`sendText` → `/api/voice/text`) is empirically verified end-to-end;
  the audio path is implemented exactly against the documented protocol
  but needs a real browser to confirm.
- **Payment matching is not wired into the frontend at all yet** — the
  backend's real matching engine and `PATCH /payments/{id}/match` exist
  and were verified to work, but no frontend code calls them yet.
  Payment Review UI still runs on `computePaymentEvents`-adjacent mock
  logic in `utils/metrics.ts`.
- **ML forecast is not live** — blocked on a backend change (§9, §12),
  not something achievable within this task's constraints.
- **Android packaging**: not started. React/Vite frontend has no
  Capacitor/Cordova/native wrapper yet.

## 4. Known limitations (real, found by inspection + running things)

- **Backend is single-item-per-transaction** (`item: str`, not an array).
  A multi-item manual-entry cart has no single-request backend
  equivalent — `mapCanonicalToBackendRequests()` deliberately sends one
  request per line item (verified in the integration test: a 2-item cart
  produced 2 separate `transaction_id`s). This is a real product
  question (should the backend gain a cart/line-items concept?), not
  silently papered over.
- **Backend stores no `raw_text` or `confidence`.** A voice sale posted
  via `POST /transactions` loses both today. See §12.
- **Backend's payment matcher returns a single winner or nothing** — no
  candidate list, no confidence, no explanation exposed via API. The
  frontend's existing `PaymentEvent.candidates`/`MatchCandidate` types
  cannot be honestly populated from real data right now. See §12.
- **Frontend's `ForecastSummary` type expects a low/high band and a
  7-point daily `series`; ML-2's actual model predicts one 7-day TOTAL,
  no band, no daily breakdown.** Do not fabricate either. If/when live,
  a defensible (not invented) band is `expected ± measured validation
  MAE` (1237, from `ml2/PHASE_2_FORECASTING.md`) — real measured error,
  not a guessed spread. There is no honest way to produce the daily
  `series` without either real per-day modeling (ML-2 enhancement, out
  of this task's scope) or an explicitly "illustrative only" UI label
  that doesn't currently exist.
- **Frontend's `'partial'` payment status has no backend equivalent** —
  backend is binary paid-in-full-or-not.
- **No frontend test framework exists** (checked: no `.test.`/`.spec.`
  files anywhere). The 6/6 verification used a dependency-free Node
  script (`node --experimental-strip-types`) against real running
  servers instead of introducing a new test framework mid-task (Rule 16:
  don't over-engineer).
- **Two stray, unused things found and left alone** (not blockers): a
  second `src/package.json` inside the frontend with dependencies
  nothing actually imports (verified via grep — safe to delete, not
  done here since it's not in scope), and the frontend's root
  `package.json` declares an unused `@emotion/react`.

## 5. Files modified or created (this integration pass only — ML-2 itself is unchanged, already-complete work)

**Created:**
- `frontend/src/services/canonicalTransaction.ts`
- `frontend/src/services/voiceAgentClient.ts`
- `frontend/src/services/backendClient.ts`
- `frontend/src/services/mlAdapter.ts`
- `frontend/integration_test.ts`

**Modified:**
- `frontend/src/contexts/AppContext.tsx` (added `mode`/`backendUrl` props,
  live-mode transaction sync, backend-persisting `addSale`)
- `frontend/src/pages/RecordSale.tsx` (added live-mode branch using the
  real voice client; demo path byte-for-byte preserved as
  `startListeningDemo`/`finishListeningDemo`)

**Not touched:** every other frontend file, the entire voice-agent
codebase (only a local, clearly-labeled `app/models/` reconstruction for
verification — see §7), the entire teammate backend.

## 6. Important existing files (for orientation)

- `frontend/src/contexts/AppContext.tsx` — the single state integration
  point; every screen reads from here, never from an adapter directly.
- `frontend/src/types/index.ts` — the approved frontend type contracts
  (`Transaction`, `ForecastSummary`, `BusinessHealth`, etc.) — do not
  fork these; adapters map onto them.
- `frontend/src/utils/metrics.ts` — where ALL current "intelligence"
  (health score, forecast, insights) is computed today, via plain
  heuristics on mock data. Not yet replaced by real ML-2/backend output
  — see §3, §9.
- `voice-agent/backend/README.md` — the exact, verified voice output
  contract.
- `teammate-backend/smart_merchant_backend/README.md` and `app/schemas.py`
  — the exact, verified backend contract (trust the code over the
  README; one discrepancy was already found — `/transactions/insights`
  exists in code but isn't in the README's endpoint table).

## 7. Voice integration

`VoiceCapture.tsx` (unmodified) exposes `onStart`/`onStop`/`phase`/
`transcript` — a plain hold-to-talk UI, no network code inside it, per
the original design. `RecordSale.tsx` now branches on `mode`:

- **demo**: unchanged, fakes a transcript reveal from a static sample.
- **live**: `onStart` → `VoiceAgentClient.startListening()` opens the
  mic + a WebSocket to `/ws/audio`, streams real PCM16 frames, and
  forwards `partial`/`heard`/`result` events into the same `transcript`/
  `phase` state. `onStop` → `stopListening()` sends the flush action.
  An unaccepted or cancelled result returns to `idle` with the reason
  shown — never fabricates a review card from an uncertain result.

  A confirmed result flows through `mapVoiceToCanonical()` →
  `SaleReviewCard` (unmodified UI) → merchant taps confirm → `addSale()`
  in `AppContext` → backend POST (see §8). This is the flow the
  integration test exercises end to end except for the literal browser
  microphone step (§3).

Voice agent's `app/models/` was reconstructed **locally, for
verification only** — not a claim about the teammate's real source.
Get the actual files from their real repository before this goes near
anything but a dev sandbox; the reconstruction is a plumbing fix for a
packaging accident (see `voice-agent/backend/app/models/*.py`
docstrings), not a redesign.

## 8. Backend integration

`backendClient.ts` wraps every endpoint confirmed live: `POST
/transactions`, `GET /transactions`, `GET /transactions/pending`, `GET
/transactions/pending/stale`, `GET /transactions/today`, `GET
/transactions/insights`, `GET /transactions/{id}`, `POST /payments`,
`POST /payments/raw`, `GET /payments`, and `PATCH /payments/{id}/match`
(found by reading `schemas.py`, not documented in the backend's own
README — flagged there as a real doc/code discrepancy).

`AppContext` calls `listTransactions()` on mount in live mode and
`createTransaction()` from `addSale`. Nothing else in the frontend calls
the backend directly yet — payment endpoints are wrapped in
`backendClient.ts` but not called from any component (§3).

## 9. ML integration

`mlAdapter.ts` defines the real interface (`MLAdapter.getForecast()`)
and two implementations: `MockMLAdapter` (returns an honestly-empty,
clearly `source: 'mock'`-labeled shape — no invented numbers) and
`LiveMLAdapter` (calls a `/ml/forecast` endpoint that does not exist
yet — see §12). Neither is currently instantiated/called from
`AppContext` or any page; wiring it in is a leftover next step once the
endpoint is real, not done here to avoid presenting mock output as if it
were connected.

What CAN be invoked today, offline: ML-2's own `feature_engine.generate()`
and `forecasting/predict.py` — fully working, 67/67 tests — just not
reachable from the browser without the backend change in §12.

## 10. Tests

Exact commands run, exact results, this session:

```
ml2:            python3 -m pytest -q          → 67 passed
voice-agent:    python3 -m pytest -q          → 90 passed (after the
                 local app/models/ reconstruction — see §7; 0 passed
                 before it, due to the missing-package ImportError)
frontend:       no test files exist (find confirmed none)
integration:    node --experimental-strip-types integration_test.ts
                 → 6/6 real checks passed against BOTH real servers
                 running simultaneously:
                   1. voice.sendText() → real Voice Agent
                   2. mapVoiceToCanonical() on the real response
                   3. backend.createTransaction() → real backend
                   4. backend.getTransaction() read-back
                   5. backend.getInsights() reflects the new row
                   6. multi-item cart → 2 separate backend transaction_ids
```

## 11. Build

```
npm install     → clean, 284 packages (root package.json alone is
                   sufficient -- verified by grepping every real import
                   in src/ against it)
npx tsc --noEmit → clean (excluding ~24 pre-existing, unrelated
                   TS6133 "unused React import" warnings across
                   Magic-Patterns-generated files this task didn't touch)
npm run build    → clean, dist/ produced, 6.84s
```
Both re-run immediately before this handoff, after the RecordSale.tsx
live-mode edit.

## 12. Backend change requests (documented, NOT implemented — teammate's call)

1. **Add `raw_text: str | None` and `confidence: float | None` columns**
   to the transaction model/`POST /transactions` schema, so voice
   provenance isn't discarded on persistence.
2. **Add a candidates endpoint for Payment Review**, e.g. `GET
   /payments/{payment_id}/candidates` → nearby-amount/time `PENDING`
   transactions with a computed distance/score, so the existing
   `MatchCandidate` UI can show real alternatives instead of a binary
   auto-match-or-nothing.
3. **Add an ML forecast endpoint**, e.g. `POST /ml/forecast?merchant_id=`
   that internally imports and calls ML-2's `forecasting/predict.py`
   (both are Python — this is the natural place for that call to live,
   not a new service) and returns `{expected_revenue_7d, model_version,
   as_of_date}`. `mlAdapter.ts`'s `LiveMLAdapter` already expects exactly
   this shape at `/ml/forecast`.

## 13. Recommended next steps, in order

1. Thread `voiceConfidence` into `SaleReviewCard`'s badge (small,
   mechanical, listed in §3).
2. Verify the live microphone/WebSocket path in an actual browser —
   the one piece this sandbox genuinely cannot test.
3. Wire Payment Review to the real `submitRawPayment`/
   `manualMatchPayment` backend calls already sitting unused in
   `backendClient.ts`.
4. Backend change requests #1–3 above (teammate's decision/timeline).
5. Once #4's endpoint 3 exists: instantiate `LiveMLAdapter` in
   `AppContext`, wire `Forecast.tsx`/`Insights.tsx` to it, and adapt
   `ForecastSummary`'s display to the honest `expected ± MAE` band (§4)
   instead of the currently-impossible daily series.
6. Android packaging audit (Capacitor is the standard fit for an
   existing Vite/React app needing offline-capable native packaging;
   not evaluated in depth this session — that's a distinct, sizeable
   piece of work).

## 14. Important warnings

- Do not modify the teammate backend or the voice agent without
  coordinating with their owners — both were only read and called here,
  never edited (the voice `app/models/` reconstruction is a local,
  clearly-labeled verification aid, not a submitted change).
- Do not rewrite ML-2's algorithms or duplicate XGBoost/forecasting
  logic anywhere else (JS included).
- Do not redesign the approved UI — every integration above was done by
  changing what feeds existing components, not the components' own
  markup/styling (`VoiceCapture.tsx`, `SaleReviewCard.tsx` untouched).
- Do not fabricate confidence, forecast ranges, payment-match candidates,
  or ML output where the real data isn't available yet — every mock in
  this codebase (`MockMLAdapter`, the empty-on-error live-mode ledger)
  is deliberately, visibly empty/labeled rather than plausible-looking.

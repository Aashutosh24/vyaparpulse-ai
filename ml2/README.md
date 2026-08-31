# VyaparPulse ML-2 — Phase 1

Merchant Business & Financial Intelligence workstream. This is **ML-2** —
Voice AI/speech is a separate teammate's workstream (out of scope here;
see architecture doc section 2).

## Status: Phase 1 complete, Phase 1.5 complete, Phase 2 (forecasting) built

Per architecture doc section 27/28, Phase 1 implements **only**:
validated transaction input → merchant-level aggregation → feature
engine → feature schema → tests → docs.

Phase 1.5 audited that work against itself (no application repo was
ever available), found and fixed 2 real bugs, documented 2 real
contract-ambiguity gaps with tests, and produced a full reconciliation
report — see `PHASE_1_5_RECONCILIATION.md`. **Phase 1.5 status was
BLOCKED** on the application repository.

**Phase 2 (forecasting, section 7/8) was built anyway, on explicit
instruction, despite that BLOCKED status.** This is on the record, not
glossed over: the payment schema, merchant_id, and outstanding-balance
semantics everything here is trained on are still unreconciled
assumptions from Phase 1.5, not confirmed backend facts. See
`PHASE_2_FORECASTING.md` for what was built, the honest baseline-vs-
XGBoost comparison (XGBoost wins on this data, with caveats), and what
that result does and doesn't prove.

**Not built yet, on purpose:** anomaly detection, Business Health Score,
Credit Intelligence, insights, what-if simulator, voice module. Those
are later phases.

## ⚠️ This was built without an existing repository

No VyaparPulse repository was provided when this phase was built. Section
28's task explicitly starts with "audit the actual repository" and
explicitly forbids inventing files/schemas that conflict with existing
models — there was nothing to audit or conflict with, so this is fresh
scaffolding built directly from this document's own section 4 structure,
not a real audit.

**If a real repository exists:** point Claude at it and ask for a
reconciliation pass. The most likely conflicts, in order of how much
they'd change:

1. **`merchant_id` on every transaction** — the doc's own section 24
   example doesn't include one. This build assumes a multi-merchant
   system (matches "MerchantFeatureEngine", "merchant-level isolation")
   and adds it as a required field. If the real app is single-merchant,
   or identifies merchants a different way, this needs to change.
2. **`payment.schema.json` and the whole payments side** — the doc gives
   an exact transaction example but no payment example, even though
   section 6's required features (collection rate, outstanding ratio,
   payment reliability) need one. This schema is a Phase 1 design
   decision, not a given contract. It will very likely need to be
   reconciled against however the real backend actually models
   payments/reconciliation (section 25 assigns reconciliation to the
   backend, not ML-2).
3. **Directory layout** — followed section 4 exactly, plus two files
   section 4 didn't explicitly name: `data/validation.py` and
   `data/aggregation.py` (Layer A/B code has to live somewhere; section
   4's `data/` only showed `raw/processed/demo` data subfolders).

## What's actually here

```
vyaparpulse-ai/
├── data/
│   ├── raw/  processed/  demo/        (data, not code)
│   ├── validation.py                  Layer A — schema validation, timestamp
│   │                                  normalization, duplicate detection
│   └── aggregation.py                 Layer B — merchant-level daily time series
├── schemas/
│   ├── transaction.schema.json        input contract (section 24 + merchant_id)
│   ├── payment.schema.json            input contract (Phase 1 design decision — see above)
│   └── feature.schema.json            output contract — the Phase 1 deliverable
├── features/
│   ├── revenue.py                     daily/weekly revenue, avg tx value, growth %
│   ├── payments.py                    collection rate, outstanding amount/ratio, reliability
│   ├── activity.py                    peak-hour revenue share
│   ├── products.py                    product demand (trailing 7d qty/product)
│   ├── stability.py                   revenue volatility (coefficient of variation)
│   └── feature_engine.py              orchestrator — the section 6 interface
├── tests/                             37 tests, all passing (see report)
└── README.md                          this file
```

## The section 6 interface

```python
from features import feature_engine

result = feature_engine.generate(transactions=transactions, payments=payments)

result.features            # pandas DataFrame, one row per (merchant, day)
result.to_records()        # same, as JSON-schema-validated dicts
result.transactions_valid / .transactions_rejected
result.payments_valid / .payments_rejected
result.rejected_samples    # up to 5 examples, with rejection reason
```

Every row in `result.features` is validated against
`schemas/feature.schema.json` before it's returned — if a value would
violate the output contract, `generate()` raises rather than returning
silently-wrong data (section 19: "report failures honestly").

## Design decisions worth knowing about

- **Continuous daily calendar, not just days with a transaction.** A
  no-sales day is a real row with `revenue=0`, not a missing row.
  Without this, a 7-day rolling window silently means "last 7 rows that
  happened to have data" instead of "last 7 calendar days" the moment
  any merchant has a quiet day. This was caught and fixed while writing
  tests — see `test_gap_day_is_filled_with_zero_not_skipped`.
- **Outstanding balance forward-fills across gap days**, it doesn't
  reset to zero just because there was no sale that day — debt persists
  until it's paid down. See `test_outstanding_balance_carries_forward_on_gap_day`.
- **`payment_collection_rate` is clipped to `[0, 1]`**, but
  **`outstanding_ratio` is not.** Collection rate reads as "% of what I
  billed this week did I collect this week" and should stay
  merchant-interpretable. Outstanding ratio exceeding 100% of a week's
  revenue is a genuine risk signal (accumulated debt) and clipping it
  would hide exactly the thing Business Health/Credit Intelligence will
  need to see in later phases.
- **A transaction's payment status is derived from total amount
  collected against it** (`paid` / `partial` / `pending`), not read
  directly off a single payment record's own `status` field — a
  transaction can have more than one partial payment.
- **`avg_transaction_value` and `payment_reliability` can legitimately
  be `null`** on a day with zero new transactions (e.g. a day where only
  an old payment landed). That's correct, not missing data — the field
  stays present in the schema (required-but-nullable) so downstream
  consumers always see a consistent set of keys.

## Demo data

`data/demo/generate_demo_data.py` produces **synthetic** data for two
fictional merchants (a steady tea stall, and a kirana store with a
simulated bad week) — fixed random seed, so it's reproducible offline
(sections 22, 23). It is not real merchant data and not public retail
data; do not treat its numbers as representative of real business
behavior. Regenerate with:

```
python3 data/demo/generate_demo_data.py
```

## Running it

```
pip install pandas jsonschema pytest
python3 -m pytest -v          # 43 tests
python3 -c "
import json
from features import feature_engine
tx = json.load(open('data/demo/demo_transactions.json'))
pay = json.load(open('data/demo/demo_payments.json'))
result = feature_engine.generate(transactions=tx, payments=pay)
print(result.features.tail())
"
```

## Explicitly not done in Phase 1 (see architecture doc for why)

- No XGBoost, no moving-average baseline — that's the next phase
  ("READY FOR FORECASTING" per section 27), not this one.
- No anomaly detection, Business Health, Credit Intelligence, insights,
  or what-if simulator.
- No real repository was audited — see the warning above. This is the
  single biggest limitation of this Phase 1 pass.
- Test coverage follows section 21's explicit list but isn't
  exhaustive — e.g. no property-based/fuzz testing, no explicit
  multi-merchant stress test at scale.
- `peak_hour_revenue_share` and `product_demand` compute per-merchant in
  a Python loop, not vectorized across all merchants at once. Fine at
  demo scale (2 merchants, 566 transactions); would want revisiting
  before a much larger merchant base.

# Phase 2 — Forecasting (baseline vs. XGBoost)

Built on explicit instruction to proceed despite Phase 1.5's **BLOCKED**
status — that status was not resolved, it was consciously overridden.
Everything below inherits every assumption/risk documented in
`PHASE_1_5_RECONCILIATION.md`: the payment schema, `merchant_id`, and
outstanding-balance semantics this forecaster trains on are still
unreconciled guesses, not confirmed backend facts.

## What was built (architecture doc section 7/8)

- `forecasting/baseline.py` — moving-average baseline: predicts next-7-day
  revenue = `weekly_revenue` as of the forecast date ("next week looks
  like last week").
- `forecasting/xgboost_model.py` — XGBoost Regressor over the doc's own
  named feature list, conservative hyperparameters (shallow trees,
  regularization) given the dataset, even extended, is still modest.
- `forecasting/dataset.py` — turns the Phase 1 feature table into a
  supervised problem: target = `sum(daily_revenue, day+1..day+7)`.
  Drops (never imputes) rows lacking full input-feature history or a
  full 7-day lookahead window.
- `forecasting/evaluate.py` — fits both models on identical data, scores
  both on the same held-out validation set, and decides a
  recommendation **from the numbers**, not asserted.
- `forecasting/train.py` / `predict.py`, root `train.py` / `predict.py` —
  orchestration + persistence + a predict CLI.
- `evaluation/metrics.py` — MAE, RMSE, MAPE (MAPE excludes near-zero
  actuals below a 50-unit floor, since a few-rupee miss on a tiny actual
  produces a meaningless triple-digit "percentage error").

## Why the demo data was extended (28 → 150 days)

The original Phase 1 demo dataset left ~15 usable rows per merchant
after 7-day warm-up and 7-day lookahead — nowhere near enough to
honestly compare two models, and it had zero day-of-week pattern, so
"day of week" (an explicit section-7 input) would've been pure noise.
Extended to 150 days, same fixed seed (42) for reproducibility, and
added: real weekly seasonality per merchant (different weekday patterns
for a commuter tea stall vs. a weekend-heavy kirana store), a mild
growth trend for M001, and recurring multi-week dip periods for M002 —
so the comparison has real signal to find (or genuinely fail to find),
rather than the answer being predetermined by data scarcity either way.

## Methodology

- **Target**: next-7-day revenue sum, computed only where the actual
  future 7 days of data exist — never estimated.
- **Split**: chronological per merchant (never shuffled, per section 8),
  80/20, with a 7-day **purge gap** at the boundary so a training row's
  target window can't overlap the validation period.
- **Leakage check**: `tests/forecasting/test_dataset.py` directly proves
  a row's target changes when *future* revenue (inside its own 7-day
  window) is perturbed, and does **not** change when *past* revenue is
  perturbed — checked by construction, not assumed.

## Results (real run, `python3 train.py`, 2026-04-08 – 2026-08-26)

| | MAE | RMSE | MAPE |
|---|---:|---:|---:|
| Baseline (moving avg) | 2,845 | 3,826 | 25.4% |
| XGBoost | 1,237 | 1,975 | 12.8% |

- Train: 221 rows (Apr 8 – Jul 28) · Validation: 43 rows (Aug 2 – Aug 26,
  after the purge gap) · 43 rows clears the (deliberately modest, not
  rigorously derived) 30-row floor this repo uses before trusting a
  margin either direction.
- **Holds up per merchant, not just pooled**: M001 MAE 490 vs 1,277;
  M002 MAE 1,949 vs 4,341 — XGBoost wins both individually.
- **Stable across random seeds** (1, 7, 123 all land within ~1,290–1,330
  MAE) — not a lucky single run.
- **Recommendation: XGBoost.** Per section 7, this is stated because the
  evaluation demonstrated it, not asserted first and justified after.

### A caveat worth being honest about

`avg_transaction_value` dominates XGBoost's feature importances (0.51 of
1.0). M001 and M002 have very different typical transaction sizes (a
~₹15–20 tea/samosa sale vs. a ~₹40–600 kirana purchase), and
`merchant_id` isn't itself a model input — so part of what looks like
forecasting skill may really be the model using transaction size as a
proxy for *which merchant, and therefore roughly what revenue scale* to
predict, rather than learning genuine temporal dynamics. `day_of_week`,
the feature that most directly tests whether the model learned the
seasonality this dataset was built to contain, has the lowest importance
of the seven (0.024) — plausibly because `weekly_revenue`'s 7-day
trailing sum already absorbs most of the weekly-pattern signal, but
that's an interpretation, not a proven mechanism.

## Bug found and fixed while actually running this (not caught by unit tests)

`predict.py` failed on **every** real run: it picked the literal last
feature row per merchant via `.iloc[-1]`, which is very often a "tail
day" with zero new transactions (a late payment landing after the last
real sale — legitimate Phase 1 behavior, not a bug) and therefore a null
`avg_transaction_value`. Unit tests used clean synthetic fixtures that
never hit this edge case; only running the actual CLI end-to-end
surfaced it. Fixed by searching backward for the most recent row with
complete features, with a regression test
(`tests/forecasting/test_predict_row_selection.py`) reproducing the
exact scenario.

## Tests: 43 → 67

24 new: 7 dataset/leakage/split tests, 6 metrics tests, 8 baseline/
XGBoost/compare_models tests (including the section-8 small-dataset-
defers-to-baseline rule, tested directly), 3 predict.py row-selection
tests.

## What this does and doesn't prove

**Does prove**: the pipeline and methodology are sound — honest
time-aware evaluation, real leakage checks, a documented decision rule
that would have deferred to the baseline if the numbers had called for
it (and was tested doing exactly that on a synthetic small-val-set
case).

**Does not prove**: that XGBoost will beat a moving average on *real*
merchant data. This result is on synthetic data with deliberately
engineered growth/seasonality/dip patterns — exactly the kind of
structure a gradient-boosted model is good at finding. Real merchant
behavior may be noisier, may not have such clean patterns, and the
input contract itself (payment schema above all) is still unreconciled
per Phase 1.5. Don't read "XGBoost won here" as "XGBoost is production-
ready" — per instruction, that claim needs the real backend, not just a
clean synthetic win.

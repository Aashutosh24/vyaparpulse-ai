# Phase 1.5 — Canonical Data Contract Reconciliation

Scope: audit the Phase 1 repo as it exists (this standalone `vyaparpulse-ai`
project — **not** the Flutter/backend application repo, which is still
separate and was not available), separate contract facts from invented
assumptions, and report — without changing schemas yet.

---

## A. CURRENT CONTRACT (as it actually exists today)

**`transaction.schema.json`** — required: `transaction_id, merchant_id,
timestamp, amount`. Optional: `customer, items, confidence`.
`additionalProperties: false`. `amount` must be `> 0`. `items[]` entries
require `product` + `quantity > 0`, `unit_price` optional. `timestamp`
must be a naive ISO-8601 string — **as of this audit, a timezone-aware
timestamp is explicitly rejected** (see Correctness Findings below; this
was a silent crash risk before today).

**`payment.schema.json`** — required: `payment_id, transaction_id,
merchant_id, timestamp, amount_paid, status`. Optional: `method`.
`additionalProperties: false`. `status` ∈ {paid, partial, pending}.

**`feature.schema.json`** — 13 required keys (all except `product_demand`
— see finding in section D). Required-but-nullable is the pattern for
anything that needs history to compute (`revenue_growth_pct`,
`payment_reliability`, etc.) — the key is always present, the value can
be `null`.

**Interface**: `feature_engine.generate(transactions, payments) ->
FeatureGenerationResult` with `.features` (DataFrame), `.to_records()`
(JSON-safe dicts), valid/rejected counts, `.rejected_samples`.

**Validation semantics**: jsonschema draft-07 + duplicate-ID rejection
(exact string match, single-call scope only — no cross-call memory) + the
new timezone rejection. **No FK check** between a payment's
`transaction_id` and an actual transaction. **No cross-check** between
`items[].quantity * unit_price` and `amount` — they can silently
disagree.

**Aggregation semantics**: continuous daily calendar computed
**independently per merchant** (each merchant's own min/max observed
date across transactions ∪ payments) — not one shared calendar across
all merchants. `outstanding_amount` is a single running
cumulative-revenue-minus-cumulative-collected balance per merchant,
clipped at 0, **not** tracked per individual transaction. A
transaction's payment status is **derived** from total amount collected
against it, not read from any payment record's own `status` field.

---

## B. ASSUMPTIONS — what came from the architecture doc vs. what I invented

| # | Item | Source | Detail |
|---|------|--------|--------|
| 1 | **merchant_id** | **Invented** | Not in the doc's §24 example at all. Added because "MerchantFeatureEngine" / "merchant-level isolation" (§5) only make sense multi-tenant. Real question: does a transaction actually carry a merchant identifier today, and under what name/type? |
| 2 | **payment schema** | **Invented, 100%** | The doc gives zero example. Built solely to satisfy §6's collection-rate/outstanding/reliability features. Real question: does the backend even model "payment" as a distinct entity, or is payment status a field on the transaction itself? |
| 3 | **transaction fields** | **Mostly given** | `transaction_id, timestamp, customer, items, amount, confidence` are §24's own example. Only `merchant_id` was added on top. Unconfirmed: does `confidence` ever appear on non-voice (manual) entries? |
| 4 | **payment status semantics** | **Invented** | I derive status from `amount_paid` totals and never trust the payment record's own `status` field downstream. Real question: is there an authoritative status field in the real system I should defer to instead? |
| 5 | **amount_received semantics** | **Invented** | Called `amount_paid`. No currency/precision handling — plain floats, no fixed-point decimal guard against rounding drift. |
| 6 | **outstanding balance semantics** | **Invented, and a real fork** | Netted running balance per merchant, not per-transaction aging. A merchant with one badly overdue sale and otherwise perfect payment history looks identical, in this balance, to one with lots of small, current partial payments. This matters a lot for Credit Intelligence later. |
| 7 | **timestamp semantics** | **Invented (now hardened)** | Assumed naive/local, no offset. Unconfirmed: which timezone does "naive" actually mean on a real device? Also unconfirmed: is the timestamp sale-time or entry-time? |
| 8 | **multi-merchant isolation** | **Assumed necessary** | Built throughout on the premise this is genuinely multi-tenant. If each app install only ever sees one merchant, the isolation machinery is unneeded overhead, not wrong, just unnecessary. |
| 9 | **item/product representation** | **Invented, 100%** | §24's own example ships `items: []`. No product schema exists in the doc at all. Unconfirmed: free-text (voice-transcribed) product names vs. a real catalog/SKU. "Chai" and "chai" and "cutting chai" would currently fragment into different `product_demand` keys. |

Meta-assumption worth naming on its own: **`additionalProperties: false`**
on both input schemas is a maximally strict Phase 1 default. It catches
drift early but will reject *any* real transaction carrying a field
nobody anticipated (a sync ID, app version, currency code, tax/discount
fields, location...).

---

## C. REQUIRED FIELDS (as currently enforced)

- **Transaction**: `transaction_id`, `merchant_id`, `timestamp`, `amount`
- **Payment**: `payment_id`, `transaction_id`, `merchant_id`, `timestamp`, `amount_paid`, `status`
- **Feature row**: all 13 fields listed in section A except `product_demand`

## D. OPTIONAL FIELDS

- **Transaction**: `customer`, `items`, `confidence`
- **Payment**: `method`
- **Feature row**: `product_demand` — **per the schema**. In practice the
  implementation *always* populates it (empty dict `{}` when there's no
  itemized data), so this is a real schema/implementation mismatch, not
  a meaningful optionality. Worth closing in the v1 contract (section G).

---

## E. AMBIGUITIES — can't be resolved without the real backend

1. Does `merchant_id` exist on real transactions today? What's it called, what's its type?
2. Does a real "payment" entity exist at all — what does it actually look like?
3. Should a payment's own `status` field be authoritative, or is deriving it from amounts (current behavior) right?
4. Are timestamps ever tz-aware in the real system? Which timezone does naive mean?
5. Genuinely multi-merchant per deployment, or one merchant per install?
6. Is `items` ever populated in practice, or is empty the norm? Free-text or catalog products?
7. Should items monetarily reconcile with `amount`, or are they independent/best-effort?
8. Can a customer legitimately be over-charged/refunded?
9. Should outstanding balance be tracked per-transaction, or is netted-per-merchant (current behavior) sufficient?
10. Should `additionalProperties: false` stay strict, or relax until the backend's real field set is known?

---

## F. RISKS (ranked by downstream impact if the assumption is wrong)

- **Highest — payment schema.** 100% invented. If wrong, `features/payments.py` and eventually all of Credit Intelligence need a real rewrite, not a schema tweak.
- **High — outstanding-balance semantics.** Netted-per-merchant can hide exactly the kind of single-bad-transaction risk Credit Intelligence exists to catch.
- **Medium — merchant_id provenance.** Mechanically cheap to fix once known (every schema/module already threads it through cleanly), but blocks every real integration until confirmed.
- **Medium — `additionalProperties: false`.** Could reject every real transaction on first contact with the actual backend. Not silent (rejections are counted and sampled with a reason), but a hard integration stop until relaxed.
- **Medium — product representation.** Free-text product names would need normalization (fuzzy matching / a real catalog) that doesn't exist yet, or `product_demand` fragments into noise.
- **Lower — timestamp timezone.** Only shifts results at the margins (hour-bucket features, midnight-boundary assignment), doesn't invalidate the pipeline.
- **Lower — over-collection / orphaned payments.** Likely rare edge cases in practice, but currently invisible if they do happen — worth a deliberate decision before they cause a confusing debugging session later.

---

## G. RECOMMENDED CANONICAL V1 CONTRACT (proposal only — not implemented)

**Transaction v1** — keep `transaction_id`, `timestamp`, `amount` required
(doc-given, safe). Keep `merchant_id` required *as a concept*, field
name/type still pending backend confirmation. Recommend relaxing
`additionalProperties` from `false` to permissive-with-logging until the
backend's actual field set is confirmed, then re-tightening —
day-one-rejects-everything is a worse failure mode than briefly ignoring
unknown fields.

**Payment v1** — keep the current shape as a **working placeholder
only**. This is the single highest-priority item to reconcile against
the real backend before trusting anything payment-derived.

**Feature output v1** — make `product_demand` required (closing the
section D mismatch); the implementation already always provides it.
Otherwise keep as-is — this is Phase 1's *own* output contract, not
dependent on the backend, so it's already the most stable part of the
system.

**Outstanding balance** — keep the netted running-balance as Phase 1's
feature for now (simple, tested, matches §30's "build the explainable
version first"), but flag explicitly that Credit Intelligence will very
likely need a *second*, per-transaction aging view alongside it, not a
replacement.

No schema files were changed to implement this proposal — per
instruction, this section is a recommendation for review, not an
applied change.

---

## Correctness findings independent of the missing repository

Two confirmed bugs, fixed with regression tests; two confirmed
behavioral gaps, left as-is (they're contract questions, not bugs with
an obvious right answer) and now covered by tests that document current
behavior instead of leaving it silently undiscovered:

1. **Fixed — crash on mixed timestamp formats.** A batch containing both
   a naive and a timezone-aware timestamp crashed `pd.to_datetime()`
   downstream (confirmed via direct reproduction). Silently coercing
   risked shifting the wall-clock hour used by `peak_hour_revenue_share`
   if the assumed offset were wrong, so tz-aware timestamps are now
   explicitly rejected with a distinct reason
   (`timestamp_has_timezone_not_yet_supported`) instead.
2. **Fixed — `transaction_count` dtype leak.** Any merchant with even
   one zero-activity reindexed day had its *entire* `transaction_count`
   column silently upcast to float64 (`1.0` instead of `1`) —
   `jsonschema`'s `"type": "integer"` check tolerates this, so all tests
   passed anyway, but a stricter downstream consumer (a typed DB column)
   would not. Now cast back to `int` explicitly before output.
3. **Documented, not fixed — orphaned payments.** A payment referencing
   a `transaction_id` that doesn't match any known transaction currently
   passes validation and gets folded into aggregates with no error.
   Whether that's correct depends entirely on backend guarantees this
   repo doesn't have visibility into.
4. **Documented, not fixed — over-collection.** Total payments exceeding
   a transaction's amount clip `outstanding_amount` to 0 with no signal
   that over-collection happened. Same reasoning — genuinely unclear
   whether this can happen in the real system.
5. **Verified, not a bug** — re-ran the demo generator twice and
   confirmed byte-identical output (the seed=42 reproducibility claim in
   the README was checked, not just trusted).

Test count: **37 → 43** (2 new timezone-rejection tests, 3 new
aggregation tests covering the crash fix + both documented gaps, 1 new
dtype-regression test).

---

## PHASE 1.5 STATUS: **BLOCKED**

Not blocked on anything left undone here — everything achievable without
the application repository was done: full audit, every checklist item
assessed, 2 real bugs found and fixed, 2 real gaps found and documented
with tests, 43/43 passing.

**Blocked on**: the same thing as Phase 1 — the actual application
repository, or at minimum, direct answers to the three highest-leverage
unknowns:

1. Does a transaction carry a merchant identifier today, and what is it called/typed?
2. Does a real payment/reconciliation model exist, and what does it look like?
3. Are timestamps ever timezone-aware anywhere in the real system?

**Why I'm not calling this "stable enough for Phase 2 without further
integration"**: I did consider this. The *feature output* contract
(`feature.schema.json`) genuinely doesn't depend on the backend — it's
what ML-2 produces, not consumes — and could be argued stable on its
own. But Phase 2 forecasting trains on the *values* in that contract,
not just its shape, and those values are only as trustworthy as the
input assumptions feeding them (payment schema above all). Starting
Phase 2 now would mean training against numbers built on invented
payment semantics. Per instruction 10, not proceeding to Phase 2
automatically.

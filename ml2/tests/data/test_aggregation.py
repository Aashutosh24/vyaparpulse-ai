from data.aggregation import daily_merchant_aggregates


def test_revenue_sums_per_day():
    tx = [
        {"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []},
        {"transaction_id": "t2", "merchant_id": "M1", "timestamp": "2026-08-01T15:00:00", "amount": 50, "items": []},
    ]
    daily = daily_merchant_aggregates(tx, [])
    row = daily.iloc[0]
    assert row["revenue"] == 150
    assert row["transaction_count"] == 2


def test_sale_is_not_assumed_paid():
    """Core rule from section 5: a transaction existing must not imply payment."""
    tx = [{"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []}]
    daily = daily_merchant_aggregates(tx, [])  # no payments at all
    row = daily.iloc[0]
    assert row["revenue"] == 100
    assert row["amount_collected"] == 0
    assert row["amount_owed_asof"] == 100  # fully outstanding


def test_partial_payment_leaves_partial_balance():
    tx = [{"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []}]
    pay = [{"payment_id": "p1", "transaction_id": "t1", "merchant_id": "M1",
             "timestamp": "2026-08-01T11:00:00", "amount_paid": 40, "status": "partial"}]
    daily = daily_merchant_aggregates(tx, pay)
    row = daily.iloc[0]
    assert row["amount_collected"] == 40
    assert row["amount_owed_asof"] == 60


def test_gap_day_is_filled_with_zero_not_skipped():
    """A no-sale day must still appear as a row with zero revenue, so a
    later 7-day rolling window is a true calendar window."""
    tx = [
        {"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []},
        {"transaction_id": "t2", "merchant_id": "M1", "timestamp": "2026-08-03T10:00:00", "amount": 50, "items": []},
    ]
    daily = daily_merchant_aggregates(tx, [])
    assert len(daily) == 3  # Aug 1, 2, 3
    middle_day = daily.iloc[1]
    assert middle_day["revenue"] == 0
    assert middle_day["transaction_count"] == 0


def test_outstanding_balance_carries_forward_on_gap_day():
    tx = [{"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []}]
    # payment arrives two days later, on a day with no new transaction
    pay = [{"payment_id": "p1", "transaction_id": "t1", "merchant_id": "M1",
             "timestamp": "2026-08-03T10:00:00", "amount_paid": 100, "status": "paid"}]
    daily = daily_merchant_aggregates(tx, pay)
    assert len(daily) == 3
    assert daily.iloc[0]["amount_owed_asof"] == 100  # Aug 1: unpaid yet
    assert daily.iloc[1]["amount_owed_asof"] == 100  # Aug 2: still unpaid (no txn that day, balance persists)
    assert daily.iloc[2]["amount_owed_asof"] == 0    # Aug 3: paid off


def test_merchants_stay_isolated():
    tx = [
        {"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []},
        {"transaction_id": "t2", "merchant_id": "M2", "timestamp": "2026-08-01T10:00:00", "amount": 999, "items": []},
    ]
    daily = daily_merchant_aggregates(tx, [])
    m1_row = daily[daily["merchant_id"] == "M1"].iloc[0]
    m2_row = daily[daily["merchant_id"] == "M2"].iloc[0]
    assert m1_row["revenue"] == 100
    assert m2_row["revenue"] == 999


def test_empty_input_returns_empty_frame_not_error():
    daily = daily_merchant_aggregates([], [])
    assert daily.empty
    assert list(daily.columns) == ["merchant_id", "date", "revenue", "transaction_count",
                                    "amount_collected", "amount_owed_asof"]


def test_mixed_naive_and_timezone_aware_batch_no_longer_crashes():
    """Phase 1.5 finding: this used to raise ValueError inside pd.to_datetime
    the moment a batch mixed a naive and a tz-aware timestamp. Validation now
    rejects the tz-aware one before it ever reaches aggregation (see
    test_validation.py::test_timezone_aware_timestamp_is_rejected_explicitly);
    this test proves the *aggregation* half of the fix — that a batch which
    already went through validation can no longer contain the crash-causing
    mix in the first place."""
    from data.validation import validate_transactions
    naive = {"transaction_id": "n1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 50, "items": []}
    tz_aware = {"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00+05:30", "amount": 50, "items": []}
    validated = validate_transactions([naive, tz_aware])
    assert validated.valid_count == 1  # tz-aware one was rejected upstream

    daily = daily_merchant_aggregates(validated.valid, [])  # must not raise
    assert daily.iloc[0]["revenue"] == 50


def test_orphaned_payment_is_not_checked_against_known_transactions():
    """CONFIRMED GAP, not fixed here (contract ambiguity, not a bug with an
    obvious correct answer — see reconciliation report section E/F). A
    payment whose transaction_id doesn't match any real transaction
    currently passes schema validation and gets folded straight into the
    merchant's aggregates. Whether that's correct depends on whether the
    real backend guarantees referential integrity before calling this
    pipeline, or whether payments can legitimately arrive for
    not-yet-synced transactions. This test locks in and documents today's
    actual behavior so a future change is a deliberate decision, not a
    silent regression."""
    tx = [{"transaction_id": "real_tx", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []}]
    orphan_pay = [{"payment_id": "p1", "transaction_id": "DOES_NOT_EXIST", "merchant_id": "M1",
                   "timestamp": "2026-08-01T11:00:00", "amount_paid": 9999, "status": "paid"}]
    daily = daily_merchant_aggregates(tx, orphan_pay)
    row = daily.iloc[0]
    assert row["amount_collected"] == 9999  # orphaned payment WAS counted -- no FK check exists
    assert row["revenue"] == 100            # but revenue is unaffected -- only the real transaction counts


def test_overcollection_is_silently_clipped_not_flagged():
    """CONFIRMED GAP, not fixed here (same reasoning as the orphaned-payment
    test above). When total payments exceed a transaction's amount,
    amount_owed_asof clips to 0 rather than going negative -- correct for
    'nothing is owed', but the excess amount isn't surfaced anywhere as an
    anomaly. Whether over-collection can legitimately happen (refunds,
    duplicate manual entries, etc.) is a question for the real payment
    model, not something to guess at here. This test documents today's
    clipping behavior so it stays a conscious choice."""
    tx = [{"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "amount": 100, "items": []}]
    pay = [{"payment_id": "p1", "transaction_id": "t1", "merchant_id": "M1",
             "timestamp": "2026-08-01T11:00:00", "amount_paid": 150, "status": "paid"}]
    daily = daily_merchant_aggregates(tx, pay)
    row = daily.iloc[0]
    assert row["amount_collected"] == 150   # the over-collection is visible here...
    assert row["amount_owed_asof"] == 0     # ...but invisible here (clipped, not negative, not flagged)

"""
Data-layer tests (architecture doc section 21, 'Data'):
  malformed transaction, missing amount, invalid timestamp,
  duplicate transaction, negative/impossible values.
"""
from data.validation import validate_transactions, validate_payments, isolate_by_merchant

VALID_TX = {
    "transaction_id": "tx_1",
    "merchant_id": "M001",
    "timestamp": "2026-08-01T10:00:00",
    "customer": "Rahul",
    "items": [],
    "amount": 70,
    "confidence": 0.94,
}


def test_valid_transaction_passes():
    result = validate_transactions([VALID_TX])
    assert result.valid_count == 1
    assert result.rejected_count == 0
    assert result.valid[0]["transaction_id"] == "tx_1"


def test_missing_amount_is_rejected():
    bad = {**VALID_TX, "transaction_id": "tx_2"}
    del bad["amount"]
    result = validate_transactions([bad])
    assert result.valid_count == 0
    assert result.rejected_count == 1
    assert "schema" in result.rejected[0]["reason"]


def test_missing_merchant_id_is_rejected():
    bad = {**VALID_TX, "transaction_id": "tx_3"}
    del bad["merchant_id"]
    result = validate_transactions([bad])
    assert result.rejected_count == 1


def test_negative_amount_is_impossible_value():
    bad = {**VALID_TX, "transaction_id": "tx_4", "amount": -50}
    result = validate_transactions([bad])
    assert result.rejected_count == 1
    assert "schema" in result.rejected[0]["reason"]


def test_zero_amount_is_impossible_value():
    bad = {**VALID_TX, "transaction_id": "tx_5", "amount": 0}
    result = validate_transactions([bad])
    assert result.rejected_count == 1


def test_invalid_timestamp_is_rejected():
    bad = {**VALID_TX, "transaction_id": "tx_6", "timestamp": "not-a-date"}
    result = validate_transactions([bad])
    assert result.rejected_count == 1
    assert result.rejected[0]["reason"] == "invalid_timestamp"


def test_malformed_record_missing_required_fields():
    bad = {"transaction_id": "tx_7"}  # missing everything else required
    result = validate_transactions([bad])
    assert result.rejected_count == 1


def test_duplicate_transaction_id_is_rejected():
    dup = {**VALID_TX, "transaction_id": "tx_8"}
    result = validate_transactions([dup, dup])
    assert result.valid_count == 1
    assert result.rejected_count == 1
    assert result.rejected[0]["reason"] == "duplicate_transaction_id"


def test_unknown_extra_field_is_rejected():
    bad = {**VALID_TX, "transaction_id": "tx_9", "totally_made_up_field": True}
    result = validate_transactions([bad])
    assert result.rejected_count == 1


def test_items_with_non_positive_quantity_is_rejected():
    bad = {
        **VALID_TX, "transaction_id": "tx_10",
        "items": [{"product": "chai", "quantity": 0}],
    }
    result = validate_transactions([bad])
    assert result.rejected_count == 1


def test_timezone_aware_timestamp_is_rejected_explicitly():
    """Phase 1.5 finding: a tz-aware timestamp used to be accepted by
    validation and then crash pd.to_datetime() downstream the moment it
    was mixed with naive timestamps in the same batch. Rather than guess
    at a timezone convention, it's now rejected with a distinct reason —
    see the reconciliation report, section E, for the open question this
    leaves for the real backend to answer."""
    bad = {**VALID_TX, "transaction_id": "tx_tz", "timestamp": "2026-08-01T10:00:00+05:30"}
    result = validate_transactions([bad])
    assert result.rejected_count == 1
    assert result.rejected[0]["reason"] == "timestamp_has_timezone_not_yet_supported"


def test_z_suffix_utc_timestamp_is_also_rejected_as_timezone_aware():
    """'Z' suffix (UTC) is timezone info too, not a naive timestamp."""
    bad = {**VALID_TX, "transaction_id": "tx_z", "timestamp": "2026-08-01T10:00:00Z"}
    result = validate_transactions([bad])
    assert result.rejected_count == 1
    assert result.rejected[0]["reason"] == "timestamp_has_timezone_not_yet_supported"


VALID_PAYMENT = {
    "payment_id": "pay_1",
    "transaction_id": "tx_1",
    "merchant_id": "M001",
    "timestamp": "2026-08-01T10:05:00",
    "amount_paid": 70,
    "method": "cash",
    "status": "paid",
}


def test_valid_payment_passes():
    result = validate_payments([VALID_PAYMENT])
    assert result.valid_count == 1


def test_payment_bad_status_is_rejected():
    bad = {**VALID_PAYMENT, "payment_id": "pay_2", "status": "refunded"}  # not in enum
    result = validate_payments([bad])
    assert result.rejected_count == 1


def test_duplicate_payment_id_is_rejected():
    dup = {**VALID_PAYMENT, "payment_id": "pay_3"}
    result = validate_payments([dup, dup])
    assert result.valid_count == 1
    assert result.rejected_count == 1


def test_isolate_by_merchant_splits_correctly():
    tx_a = {**VALID_TX, "transaction_id": "tx_a", "merchant_id": "M001"}
    tx_b = {**VALID_TX, "transaction_id": "tx_b", "merchant_id": "M002"}
    buckets = isolate_by_merchant([tx_a, tx_b])
    assert set(buckets.keys()) == {"M001", "M002"}
    assert buckets["M001"][0]["transaction_id"] == "tx_a"
    assert buckets["M002"][0]["transaction_id"] == "tx_b"

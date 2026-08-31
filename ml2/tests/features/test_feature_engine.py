import json
from pathlib import Path

from features import feature_engine


def test_generate_matches_section_6_interface():
    """features = merchant_feature_engine.generate(transactions=..., payments=...)"""
    transactions = [{
        "transaction_id": "tx_001", "merchant_id": "M001",
        "timestamp": "2026-08-28T18:42:15", "customer": "Rahul",
        "items": [], "amount": 70, "confidence": 0.94,
    }]
    result = feature_engine.generate(transactions=transactions, payments=[])
    assert not result.features.empty
    assert result.transactions_valid == 1
    assert result.transactions_rejected == 0


def test_output_matches_feature_schema():
    transactions = [
        {"transaction_id": f"tx_{i}", "merchant_id": "M001",
         "timestamp": f"2026-08-{(i % 28) + 1:02d}T10:00:00",
         "items": [], "amount": 50 + i}
        for i in range(10)
    ]
    result = feature_engine.generate(transactions=transactions, payments=[])
    # generate() already schema-validates internally (_validate_output);
    # this test additionally re-validates from the outside, independently,
    # against the same schema file the doc's own contract describes.
    schema_path = Path(__file__).resolve().parent.parent.parent / "schemas" / "feature.schema.json"
    schema = json.loads(schema_path.read_text())
    import jsonschema
    for record in result.to_records():
        clean = {k: (None if isinstance(v, float) and v != v else v) for k, v in record.items()}  # NaN -> null, keep key
        jsonschema.validate(instance=clean, schema=schema)


def test_invalid_transactions_are_excluded_but_reported():
    transactions = [
        {"transaction_id": "good", "merchant_id": "M001", "timestamp": "2026-08-01T10:00:00", "items": [], "amount": 50},
        {"transaction_id": "bad", "merchant_id": "M001", "timestamp": "2026-08-01T10:00:00", "items": [], "amount": -10},
    ]
    result = feature_engine.generate(transactions=transactions, payments=[])
    assert result.transactions_valid == 1
    assert result.transactions_rejected == 1
    assert len(result.rejected_samples) == 1


def test_empty_input_does_not_crash():
    result = feature_engine.generate(transactions=[], payments=[])
    assert result.features.empty
    assert result.transactions_valid == 0


def test_two_merchants_produce_independent_feature_rows():
    transactions = [
        {"transaction_id": "a1", "merchant_id": "M001", "timestamp": "2026-08-01T10:00:00", "items": [], "amount": 100},
        {"transaction_id": "b1", "merchant_id": "M002", "timestamp": "2026-08-01T10:00:00", "items": [], "amount": 500},
    ]
    result = feature_engine.generate(transactions=transactions, payments=[])
    by_merchant = {row["merchant_id"]: row for row in result.to_records()}
    assert by_merchant["M001"]["daily_revenue"] == 100
    assert by_merchant["M002"]["daily_revenue"] == 500


def test_transaction_count_stays_integer_after_gap_day_reindex():
    """Phase 1.5 finding: fillna(0.0) during gap-day reindexing used to
    upcast the WHOLE transaction_count column to float64 for any merchant
    with at least one no-sale day -- so a real day with 1 transaction would
    report transaction_count=1.0, not 1. jsonschema's 'type: integer' check
    tolerates 1.0, so this passed silently; a stricter downstream consumer
    (a typed DB column, a non-lenient client) would not. Now cast back
    explicitly before output."""
    transactions = [
        {"transaction_id": "t1", "merchant_id": "M1", "timestamp": "2026-08-01T10:00:00", "items": [], "amount": 100},
        {"transaction_id": "t2", "merchant_id": "M1", "timestamp": "2026-08-03T10:00:00", "items": [], "amount": 50},
    ]
    result = feature_engine.generate(transactions=transactions, payments=[])
    for record in result.to_records():
        assert isinstance(record["transaction_count"], int), (
            f"{record['date']}: transaction_count is {type(record['transaction_count']).__name__}, not int"
        )
    json.dumps(result.to_records())  # must not raise on any numpy scalar leakage

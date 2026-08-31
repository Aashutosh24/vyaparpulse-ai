import pytest

from data.aggregation import daily_merchant_aggregates
from features.revenue import add_revenue_features
from features.payments import add_payment_features
from features.stability import add_stability_features


def _tx(day, amount, tx_id=None, merchant="M1"):
    return {
        "transaction_id": tx_id or f"t_{day}_{amount}",
        "merchant_id": merchant,
        "timestamp": f"2026-08-{day:02d}T10:00:00",
        "amount": amount,
        "items": [],
    }


def _pay(day, tx_id, amount_paid, merchant="M1", status="paid"):
    return {
        "payment_id": f"p_{tx_id}",
        "transaction_id": tx_id,
        "merchant_id": merchant,
        "timestamp": f"2026-08-{day:02d}T11:00:00",
        "amount_paid": amount_paid,
        "status": status,
    }


def test_weekly_revenue_and_transaction_count():
    tx = [_tx(d, 100) for d in range(1, 8)]  # 7 days, 1 tx/day, 100 each
    daily = add_revenue_features(daily_merchant_aggregates(tx, []))
    last = daily.iloc[-1]
    assert last["revenue"] == 100  # not yet renamed to daily_revenue at this stage of the pipeline
    assert last["weekly_revenue"] == 700
    assert last["transaction_count"] == 1


def test_average_transaction_value():
    tx = [_tx(1, 100, "t1"), _tx(1, 50, "t2")]
    daily = add_revenue_features(daily_merchant_aggregates(tx, []))
    row = daily.iloc[0]
    assert row["transaction_count"] == 2
    assert row["avg_transaction_value"] == pytest.approx(75.0)


def test_avg_transaction_value_is_null_when_no_transactions():
    # gap day between two active days
    tx = [_tx(1, 100), _tx(3, 100)]
    daily = add_revenue_features(daily_merchant_aggregates(tx, []))
    gap_day = daily.iloc[1]
    assert gap_day["transaction_count"] == 0
    assert gap_day["avg_transaction_value"] != gap_day["avg_transaction_value"]  # NaN


def test_revenue_growth_pct_between_two_weeks():
    week1 = [_tx(d, 100, f"w1_{d}") for d in range(1, 8)]     # Aug 1-7, 100/day -> 700
    week2 = [_tx(d, 200, f"w2_{d}") for d in range(8, 15)]    # Aug 8-14, 200/day -> 1400
    daily = add_revenue_features(daily_merchant_aggregates(week1 + week2, []))
    last = daily.iloc[-1]  # Aug 14
    assert last["weekly_revenue"] == 1400
    assert last["revenue_growth_pct"] == pytest.approx(100.0)  # doubled


def test_collection_rate_full_payment():
    tx = [_tx(1, 100, "t1")]
    pay = [_pay(1, "t1", 100)]
    daily = add_revenue_features(daily_merchant_aggregates(tx, pay))
    daily = add_payment_features(daily, tx, pay)
    row = daily.iloc[0]
    assert row["payment_collection_rate"] == pytest.approx(1.0)
    assert row["outstanding_amount"] == 0


def test_collection_rate_no_payment_yet():
    tx = [_tx(1, 100, "t1")]
    daily = add_revenue_features(daily_merchant_aggregates(tx, []))
    daily = add_payment_features(daily, tx, [])
    row = daily.iloc[0]
    assert row["payment_collection_rate"] == pytest.approx(0.0)
    assert row["outstanding_amount"] == 100


def test_outstanding_ratio():
    tx = [_tx(1, 100, "t1"), _tx(1, 100, "t2")]
    pay = [_pay(1, "t1", 100)]  # only half collected
    daily = add_revenue_features(daily_merchant_aggregates(tx, pay))
    daily = add_payment_features(daily, tx, pay)
    row = daily.iloc[0]
    assert row["outstanding_amount"] == 100
    assert row["outstanding_ratio"] == pytest.approx(100 / 200)


def test_collection_rate_clipped_at_one_when_catching_up_old_debt():
    old_tx = [_tx(1, 100, "old")]  # unpaid for weeks
    recent_tx = [_tx(20, 10, "recent")]
    pay = [_pay(20, "old", 100), _pay(20, "recent", 10)]  # both paid on day 20
    daily = add_revenue_features(daily_merchant_aggregates(old_tx + recent_tx, pay))
    daily = add_payment_features(daily, old_tx + recent_tx, pay)
    row = daily[daily["date"] == daily["date"].max()].iloc[0]
    assert row["payment_collection_rate"] <= 1.0  # never reports >100%


def test_volatility_is_zero_for_constant_revenue():
    tx = [_tx(d, 100, f"c_{d}") for d in range(1, 8)]
    daily = add_stability_features(add_revenue_features(daily_merchant_aggregates(tx, [])))
    last = daily.iloc[-1]
    assert last["revenue_volatility_7d"] == pytest.approx(0.0, abs=1e-9)


def test_volatility_is_positive_for_varying_revenue():
    amounts = [50, 200, 40, 300, 60, 250, 45]
    tx = [_tx(d, amt, f"v_{d}") for d, amt in zip(range(1, 8), amounts)]
    daily = add_stability_features(add_revenue_features(daily_merchant_aggregates(tx, [])))
    last = daily.iloc[-1]
    assert last["revenue_volatility_7d"] > 0.3  # clearly volatile, not a tight tolerance


def test_volatility_is_null_with_less_than_two_days_history():
    tx = [_tx(1, 100)]
    daily = add_stability_features(add_revenue_features(daily_merchant_aggregates(tx, [])))
    row = daily.iloc[0]
    assert row["revenue_volatility_7d"] != row["revenue_volatility_7d"]  # NaN

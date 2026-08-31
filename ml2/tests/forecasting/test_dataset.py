from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from forecasting.dataset import build_forecast_dataset, chronological_split, FORECAST_FEATURE_COLUMNS


def _make_features_df(merchant_id: str, start: date, daily_revenue: list[float]) -> pd.DataFrame:
    """Minimal synthetic feature table -- just enough columns for dataset.py to use."""
    n = len(daily_revenue)
    dates = [start + timedelta(days=i) for i in range(n)]
    return pd.DataFrame({
        "merchant_id": [merchant_id] * n,
        "date": dates,
        "daily_revenue": daily_revenue,
        "weekly_revenue": [sum(daily_revenue[max(0, i - 6):i + 1]) for i in range(n)],
        "transaction_count": [1] * n,
        "avg_transaction_value": daily_revenue,
        "payment_collection_rate": [1.0] * n,
        "outstanding_amount": [0.0] * n,
        "revenue_growth_pct": [0.0] * n,
    })


def test_target_equals_sum_of_next_7_days_exactly():
    """Direct, exact check on a hand-built series: no off-by-one, no
    including the as_of day itself, no excluding day+7."""
    revenue = [100.0] * 20  # constant, so target math is trivially checkable
    df = _make_features_df("M1", date(2026, 1, 1), revenue)
    dataset = build_forecast_dataset(df)

    row = dataset[dataset["as_of_date"] == date(2026, 1, 8)].iloc[0]
    assert row["target_next_7d_revenue"] == pytest.approx(700.0)  # 7 * 100


def test_target_reacts_to_future_revenue_not_past_revenue():
    """The core leakage check: perturbing revenue BEFORE as_of_date must
    not change that row's target; perturbing revenue AFTER it must."""
    base = [100.0] * 20
    df_base = _make_features_df("M1", date(2026, 1, 1), base)
    as_of = date(2026, 1, 8)
    target_base = build_forecast_dataset(df_base).set_index("as_of_date").loc[as_of, "target_next_7d_revenue"]

    past_perturbed = list(base)
    past_perturbed[0] = 999999.0  # day 1 -- well before as_of_date, and before the target window
    df_past = _make_features_df("M1", date(2026, 1, 1), past_perturbed)
    target_past = build_forecast_dataset(df_past).set_index("as_of_date").loc[as_of, "target_next_7d_revenue"]
    assert target_past == target_base, "target changed when only PAST revenue was perturbed -- leakage direction is backwards"

    future_perturbed = list(base)
    future_perturbed[9] = 999999.0  # day 10 == as_of_date + 2, inside the target window
    df_future = _make_features_df("M1", date(2026, 1, 1), future_perturbed)
    target_future = build_forecast_dataset(df_future).set_index("as_of_date").loc[as_of, "target_next_7d_revenue"]
    assert target_future != target_base, "target did NOT change when future revenue in its own window was perturbed"


def test_rows_without_full_7day_lookahead_are_dropped():
    revenue = [100.0] * 10  # only 10 days total
    df = _make_features_df("M1", date(2026, 1, 1), revenue)
    dataset = build_forecast_dataset(df)
    # day 10 (the last day) would need days 11-17, which don't exist -- must be absent
    assert date(2026, 1, 10) not in set(dataset["as_of_date"])
    # day 3 needs days 4-10, which DO all exist -- must be present
    assert date(2026, 1, 3) in set(dataset["as_of_date"])


def test_rows_with_null_required_feature_are_dropped_not_imputed():
    revenue = [100.0] * 15
    df = _make_features_df("M1", date(2026, 1, 1), revenue)
    df.loc[df["date"] == date(2026, 1, 5), "revenue_growth_pct"] = np.nan
    dataset = build_forecast_dataset(df)
    assert date(2026, 1, 5) not in set(dataset["as_of_date"])


def test_chronological_split_never_reorders_and_purges_the_boundary():
    revenue = [100.0 + i for i in range(60)]  # trending, 60 days
    df = _make_features_df("M1", date(2026, 1, 1), revenue)
    dataset = build_forecast_dataset(df)

    train_df, val_df = chronological_split(dataset, val_fraction=0.2, purge_days=7)
    assert train_df["as_of_date"].max() < val_df["as_of_date"].min()

    gap = (val_df["as_of_date"].min() - train_df["as_of_date"].max()).days
    assert gap > 7, f"purge gap was only {gap} days, expected > 7"


def test_two_merchants_split_independently():
    df1 = _make_features_df("M1", date(2026, 1, 1), [100.0] * 80)
    df2 = _make_features_df("M2", date(2026, 1, 1), [500.0] * 80)
    dataset = build_forecast_dataset(pd.concat([df1, df2], ignore_index=True))

    train_df, val_df = chronological_split(dataset, val_fraction=0.2, purge_days=7)
    assert set(train_df["merchant_id"].unique()) == {"M1", "M2"}
    assert set(val_df["merchant_id"].unique()) == {"M1", "M2"}


def test_forecast_feature_columns_present_in_every_row():
    df = _make_features_df("M1", date(2026, 1, 1), [100.0] * 20)
    dataset = build_forecast_dataset(df)
    for col in FORECAST_FEATURE_COLUMNS:
        assert col in dataset.columns
        assert dataset[col].isna().sum() == 0


def test_small_dataset_can_purge_a_merchant_out_of_validation_entirely():
    """Documents a real edge case found while writing these tests: if a
    merchant's usable history is small enough, the purge_days gap can
    consume the entire validation candidate slice, silently leaving that
    merchant with zero validation rows (chronological_split doesn't
    raise -- it just contributes nothing for that merchant). The real
    demo dataset (150 days, ~140 usable rows/merchant) doesn't hit this,
    but a much shorter real history could. Not fixed here -- documented
    so it's a known, tested limitation rather than a silent surprise."""
    df = _make_features_df("M1", date(2026, 1, 1), [100.0] * 40)  # short history
    dataset = build_forecast_dataset(df)
    train_df, val_df = chronological_split(dataset, val_fraction=0.2, purge_days=7)
    assert not train_df.empty
    assert val_df.empty  # confirmed: this merchant got purged out entirely

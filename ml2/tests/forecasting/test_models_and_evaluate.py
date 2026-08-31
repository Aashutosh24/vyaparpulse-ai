from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from forecasting.baseline import MovingAverageBaseline
from forecasting.xgboost_model import XGBoostForecaster
from forecasting.dataset import FORECAST_FEATURE_COLUMNS
from forecasting.evaluate import compare_models, MIN_RELIABLE_VAL_ROWS


def _synthetic_dataset(n: int, merchant_id: str = "M1", seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = [date(2026, 1, 1) + timedelta(days=i) for i in range(n)]
    weekly_revenue = rng.uniform(1000, 2000, size=n)
    return pd.DataFrame({
        "merchant_id": [merchant_id] * n,
        "as_of_date": dates,
        "weekly_revenue": weekly_revenue,
        "transaction_count": rng.integers(5, 20, size=n),
        "avg_transaction_value": rng.uniform(50, 150, size=n),
        "payment_collection_rate": rng.uniform(0.6, 1.0, size=n),
        "outstanding_amount": rng.uniform(0, 500, size=n),
        "day_of_week": [d.weekday() for d in dates],
        "revenue_growth_pct": rng.uniform(-20, 20, size=n),
        # target loosely tracks weekly_revenue so a model CAN beat a naive baseline if it tries
        "target_next_7d_revenue": weekly_revenue * 1.05 + rng.normal(0, 50, size=n),
    })


def test_baseline_predicts_weekly_revenue_directly():
    X = pd.DataFrame({"weekly_revenue": [100.0, 200.0, 300.0]})
    baseline = MovingAverageBaseline().fit(X, pd.Series([0, 0, 0]))
    preds = baseline.predict(X)
    assert list(preds) == [100.0, 200.0, 300.0]


def test_baseline_requires_weekly_revenue_column():
    X = pd.DataFrame({"something_else": [1, 2, 3]})
    with pytest.raises(ValueError):
        MovingAverageBaseline().predict(X)


def test_xgboost_fit_predict_runs_and_returns_right_shape():
    train = _synthetic_dataset(60, seed=1)
    val = _synthetic_dataset(15, seed=2)
    model = XGBoostForecaster(n_estimators=20).fit(train, train["target_next_7d_revenue"])
    preds = model.predict(val)
    assert len(preds) == len(val)
    assert np.all(np.isfinite(preds))


def test_xgboost_feature_importances_cover_all_forecast_columns():
    train = _synthetic_dataset(60, seed=1)
    model = XGBoostForecaster(n_estimators=20).fit(train, train["target_next_7d_revenue"])
    importances = model.feature_importances()
    assert set(importances.keys()) == set(FORECAST_FEATURE_COLUMNS)
    assert abs(sum(importances.values()) - 1.0) < 1e-4  # importances sum to ~1


def test_compare_models_defers_to_baseline_when_validation_set_too_small():
    """Section 8: 'if the dataset is too small ... prefer the simpler
    baseline.' Tested directly by making the val set smaller than
    MIN_RELIABLE_VAL_ROWS, regardless of which model 'looks' better."""
    train = _synthetic_dataset(60, seed=1)
    tiny_val = _synthetic_dataset(MIN_RELIABLE_VAL_ROWS - 5, merchant_id="M1", seed=2)
    report = compare_models(train, tiny_val)
    assert report.n_val < MIN_RELIABLE_VAL_ROWS
    assert report.recommendation == "baseline"
    assert "too small" in report.dataset_adequacy_note or "below" in report.dataset_adequacy_note


def test_compare_models_report_has_all_section_8_required_fields():
    """Section 8: 'Record: training period, validation period, features
    used, metrics, model version.'"""
    train = _synthetic_dataset(80, seed=1)
    val = _synthetic_dataset(40, seed=2)
    report = compare_models(train, val)

    assert report.model_version
    assert report.training_period[0] <= report.training_period[1]
    assert report.validation_period[0] <= report.validation_period[1]
    assert report.features_used == FORECAST_FEATURE_COLUMNS
    assert report.baseline_metrics is not None
    assert report.xgboost_metrics is not None
    assert report.recommendation in {"baseline", "xgboost"}


def test_compare_models_rejects_empty_input():
    train = _synthetic_dataset(10, seed=1)
    empty = pd.DataFrame(columns=train.columns)
    with pytest.raises(ValueError):
        compare_models(train, empty)

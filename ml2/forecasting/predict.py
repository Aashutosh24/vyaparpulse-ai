"""
Loads the persisted Phase 2 model (whichever one training's evaluation
selected) and predicts next-7-day revenue from current feature rows.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import joblib
import pandas as pd

from forecasting.baseline import MovingAverageBaseline
from forecasting.dataset import FORECAST_FEATURE_COLUMNS
from forecasting.train import MODELS_DIR


def load_latest(model_version: str = "phase2-v1"):
    """Returns a fitted model matching whatever train.persist() saved."""
    xgb_path = MODELS_DIR / f"{model_version}_xgboost.joblib"
    baseline_path = MODELS_DIR / f"{model_version}_baseline.json"

    if xgb_path.exists():
        return joblib.load(xgb_path)
    if baseline_path.exists():
        return MovingAverageBaseline()  # stateless; nothing to load
    raise FileNotFoundError(
        f"No trained model found for version '{model_version}' in {MODELS_DIR}. "
        f"Run forecasting/train.py first."
    )


def predict_next_7_days(model, features_row: pd.Series) -> float:
    """
    `features_row` must be a single row from the Phase 1 feature table
    (result.features.iloc[i]) with a non-null value for every column in
    FORECAST_FEATURE_COLUMNS except day_of_week, which is derived here
    from the row's own date.
    """
    row = dict(features_row)
    as_of = row["date"]
    if isinstance(as_of, str):
        as_of = date.fromisoformat(as_of)

    X = pd.DataFrame([{
        "weekly_revenue": row["weekly_revenue"],
        "transaction_count": row["transaction_count"],
        "avg_transaction_value": row["avg_transaction_value"],
        "payment_collection_rate": row["payment_collection_rate"],
        "outstanding_amount": row["outstanding_amount"],
        "day_of_week": as_of.weekday(),
        "revenue_growth_pct": row["revenue_growth_pct"],
    }])
    missing = [c for c in FORECAST_FEATURE_COLUMNS if c != "day_of_week" and pd.isna(X.iloc[0][c])]
    if missing:
        raise ValueError(f"Cannot forecast: missing required feature(s) {missing} for this row")

    return float(model.predict(X)[0])

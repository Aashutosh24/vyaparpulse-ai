"""
Runs baseline vs XGBoost on the same train/val split and produces the
record architecture doc section 8 asks for: training period, validation
period, features used, metrics, model version.

Section 7: "The final implementation must compare XGBoost against the
baseline. Do not claim XGBoost is superior unless evaluation
demonstrates it." -- the recommendation field here is decided from the
actual val-set metrics, not asserted.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import pandas as pd

from evaluation.metrics import MetricResult, evaluate as evaluate_metrics
from forecasting.baseline import MovingAverageBaseline
from forecasting.dataset import FORECAST_FEATURE_COLUMNS, TARGET_COLUMN
from forecasting.xgboost_model import XGBoostForecaster

MODEL_VERSION = "phase2-v1"

# Below this row count per side, treat any apparent XGBoost win as noise,
# not signal -- matches section 8: "If the dataset is too small to
# support a reliable ML model, prefer the simpler baseline."
MIN_RELIABLE_VAL_ROWS = 30


@dataclass
class ForecastComparisonReport:
    model_version: str
    training_period: tuple[date, date]
    validation_period: tuple[date, date]
    features_used: list[str]
    n_train: int
    n_val: int
    baseline_metrics: MetricResult
    xgboost_metrics: MetricResult
    xgboost_feature_importances: dict
    recommendation: str            # "baseline" | "xgboost"
    reasoning: str
    dataset_adequacy_note: str


def compare_models(train_df: pd.DataFrame, val_df: pd.DataFrame) -> ForecastComparisonReport:
    if train_df.empty or val_df.empty:
        raise ValueError("compare_models requires non-empty train and validation sets")

    X_train, y_train = train_df[FORECAST_FEATURE_COLUMNS], train_df[TARGET_COLUMN]
    X_val, y_val = val_df[FORECAST_FEATURE_COLUMNS], val_df[TARGET_COLUMN]

    baseline = MovingAverageBaseline().fit(X_train, y_train)
    baseline_pred = baseline.predict(X_val)
    baseline_metrics = evaluate_metrics(y_val.to_numpy(), baseline_pred)

    xgb = XGBoostForecaster().fit(train_df, y_train)  # needs full df (uses column names)
    xgb_pred = xgb.predict(val_df)
    xgb_metrics = evaluate_metrics(y_val.to_numpy(), xgb_pred)

    n_val = len(val_df)
    adequacy_note = (
        f"{n_val} validation rows is below the {MIN_RELIABLE_VAL_ROWS}-row floor treated as "
        f"'enough to trust a comparison' here -- any apparent XGBoost win is not treated as real."
        if n_val < MIN_RELIABLE_VAL_ROWS else
        f"{n_val} validation rows clears the {MIN_RELIABLE_VAL_ROWS}-row floor used here as a "
        f"(deliberately modest, not rigorously derived) threshold for trusting the comparison."
    )

    if n_val < MIN_RELIABLE_VAL_ROWS:
        recommendation = "baseline"
        reasoning = (
            f"Validation set too small ({n_val} rows) to trust any margin between models, "
            f"win or lose. Defaulting to the baseline per section 8's explicit instruction: "
            f"'if the dataset is too small ... prefer the simpler baseline.'"
        )
    elif xgb_metrics.rmse < baseline_metrics.rmse and xgb_metrics.mae < baseline_metrics.mae:
        recommendation = "xgboost"
        reasoning = (
            f"XGBoost beat the baseline on both RMSE ({xgb_metrics.rmse:.1f} vs "
            f"{baseline_metrics.rmse:.1f}) and MAE ({xgb_metrics.mae:.1f} vs "
            f"{baseline_metrics.mae:.1f}) on held-out validation data."
        )
    else:
        recommendation = "baseline"
        reasoning = (
            f"XGBoost did not clearly beat the baseline on held-out validation data "
            f"(RMSE {xgb_metrics.rmse:.1f} vs {baseline_metrics.rmse:.1f}, "
            f"MAE {xgb_metrics.mae:.1f} vs {baseline_metrics.mae:.1f}). "
            f"Per section 7, not claiming XGBoost is superior without evaluation demonstrating it."
        )

    return ForecastComparisonReport(
        model_version=MODEL_VERSION,
        training_period=(train_df["as_of_date"].min(), train_df["as_of_date"].max()),
        validation_period=(val_df["as_of_date"].min(), val_df["as_of_date"].max()),
        features_used=list(FORECAST_FEATURE_COLUMNS),
        n_train=len(train_df),
        n_val=n_val,
        baseline_metrics=baseline_metrics,
        xgboost_metrics=xgb_metrics,
        xgboost_feature_importances=xgb.feature_importances(),
        recommendation=recommendation,
        reasoning=reasoning,
        dataset_adequacy_note=adequacy_note,
    )

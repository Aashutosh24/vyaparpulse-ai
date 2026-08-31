"""
End-to-end Phase 2 training orchestration: Phase 1 feature table ->
walk-forward dataset -> chronological split -> fit + compare both models
-> persist whichever one the held-out evaluation actually recommends.

Does not decide the winner itself -- that decision lives entirely in
forecasting/evaluate.py's compare_models(), driven by validation metrics.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

from forecasting.baseline import MovingAverageBaseline
from forecasting.dataset import build_forecast_dataset, chronological_split
from forecasting.evaluate import ForecastComparisonReport, compare_models
from forecasting.xgboost_model import XGBoostForecaster

MODELS_DIR = Path(__file__).resolve().parent.parent / "models" / "trained"


def train(features_df: pd.DataFrame, val_fraction: float = 0.2, purge_days: int = 7):
    """
    Returns (report, fitted_winning_model, train_df, val_df). Refits the
    recommended model on train+val combined before returning it, so the
    persisted model uses all available history, not just the training
    slice -- validation's job was to pick the approach, not to be
    withheld from the final model.
    """
    dataset = build_forecast_dataset(features_df)
    if dataset.empty:
        raise ValueError(
            "No usable rows: every merchant has either too little warm-up "
            "history or too little lookahead history for a 7-day-ahead target."
        )

    train_df, val_df = chronological_split(dataset, val_fraction=val_fraction, purge_days=purge_days)
    if train_df.empty or val_df.empty:
        raise ValueError(
            f"Chronological split produced an empty side (train={len(train_df)}, "
            f"val={len(val_df)}) -- not enough history per merchant for this "
            f"val_fraction/purge_days combination."
        )

    report = compare_models(train_df, val_df)

    full_X, full_y = dataset, dataset["target_next_7d_revenue"]
    winning_model = (
        XGBoostForecaster().fit(full_X, full_y)
        if report.recommendation == "xgboost"
        else MovingAverageBaseline().fit(full_X, full_y)
    )

    return report, winning_model, train_df, val_df


def persist(report: ForecastComparisonReport, model) -> Path:
    """Saves the winning model + a JSON report card to models/trained/."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    if report.recommendation == "xgboost":
        model_path = MODELS_DIR / f"{report.model_version}_xgboost.joblib"
        joblib.dump(model, model_path)
    else:
        # MovingAverageBaseline has no learned parameters to serialize --
        # persist a descriptor instead of pretending there's a model file.
        model_path = MODELS_DIR / f"{report.model_version}_baseline.json"
        model_path.write_text(json.dumps({
            "type": "MovingAverageBaseline",
            "description": "predict = weekly_revenue as of the forecast date",
        }, indent=2))

    report_path = MODELS_DIR / f"{report.model_version}_report.json"
    report_path.write_text(json.dumps({
        "model_version": report.model_version,
        "recommendation": report.recommendation,
        "reasoning": report.reasoning,
        "dataset_adequacy_note": report.dataset_adequacy_note,
        "training_period": [str(report.training_period[0]), str(report.training_period[1])],
        "validation_period": [str(report.validation_period[0]), str(report.validation_period[1])],
        "features_used": report.features_used,
        "n_train": report.n_train,
        "n_val": report.n_val,
        "baseline_metrics": vars(report.baseline_metrics),
        "xgboost_metrics": vars(report.xgboost_metrics),
        "xgboost_feature_importances": report.xgboost_feature_importances,
    }, indent=2))

    return model_path

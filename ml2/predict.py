#!/usr/bin/env python3
"""
CLI entrypoint: generate Phase 1 features for the demo dataset, load the
latest trained Phase 2 model, and print a next-7-day forecast for each
merchant's most recent day. Delegates all real logic to
features/feature_engine.py and forecasting/predict.py.

Usage: python3 predict.py
"""
from __future__ import annotations

import json

from features import feature_engine
from forecasting.dataset import FORECAST_FEATURE_COLUMNS
from forecasting.predict import load_latest, predict_next_7_days


def _most_recent_complete_row(features_for_merchant: pd.DataFrame) -> pd.Series | None:
    """The literal last row for a merchant is very often a tail day with
    zero new transactions (e.g. a late payment landed after the last
    real sale) -- avg_transaction_value is correctly null there (Phase 1
    behavior, not a bug), so it can't be forecast from. Search backward
    for the most recent row where every required feature is present."""
    required = [c for c in FORECAST_FEATURE_COLUMNS if c != "day_of_week"]
    g = features_for_merchant.sort_values("date")
    complete = g.dropna(subset=required)
    return complete.iloc[-1] if not complete.empty else None


def main():
    transactions = json.load(open("data/demo/demo_transactions.json"))
    payments = json.load(open("data/demo/demo_payments.json"))

    feature_result = feature_engine.generate(transactions=transactions, payments=payments)
    model = load_latest()

    for merchant_id, g in feature_result.features.groupby("merchant_id"):
        row = _most_recent_complete_row(g)
        if row is None:
            print(f"{merchant_id}: cannot forecast -- no row with complete features exists yet")
            continue
        try:
            forecast = predict_next_7_days(model, row)
            print(f"{merchant_id}: next-7-day revenue forecast as of {row['date']} = {forecast:.0f}")
        except ValueError as e:
            print(f"{merchant_id}: cannot forecast -- {e}")


if __name__ == "__main__":
    main()

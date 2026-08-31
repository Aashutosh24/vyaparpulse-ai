#!/usr/bin/env python3
"""
CLI entrypoint: run Phase 1 feature generation, then Phase 2 forecast
training + evaluation, on the demo dataset. Delegates all real logic to
features/feature_engine.py and forecasting/train.py.

Usage: python3 train.py
"""
from __future__ import annotations

import json

from features import feature_engine
from forecasting.train import persist, train


def main():
    transactions = json.load(open("data/demo/demo_transactions.json"))
    payments = json.load(open("data/demo/demo_payments.json"))

    print("Generating Phase 1 features...")
    feature_result = feature_engine.generate(transactions=transactions, payments=payments)
    print(f"  {len(feature_result.features)} feature rows across "
          f"{feature_result.features['merchant_id'].nunique()} merchants")

    print("Training + evaluating Phase 2 forecasters...")
    report, model, train_df, val_df = train(feature_result.features)
    model_path = persist(report, model)

    print(f"\nRecommendation: {report.recommendation.upper()}")
    print(f"Reason: {report.reasoning}")
    print(f"Saved: {model_path}")


if __name__ == "__main__":
    main()

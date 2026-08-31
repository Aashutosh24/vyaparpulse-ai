"""
Turns the Phase 1 feature table into a supervised learning problem for
next-7-day revenue forecasting (architecture doc section 7), and splits
it the way section 8 requires: time-aware, never randomly shuffled.

Two leakage risks this module exists specifically to avoid:

1. A feature computed "as of" some date must never use data from after
   that date. The Phase 1 feature engine already guarantees this (every
   feature is a trailing rolling window or same-day value) -- this
   module doesn't recompute anything, it just selects columns.
2. The target for a row at date d is sum(revenue, d+1..d+7) -- strictly
   after d, so a row's own features and its own target never overlap.
   The remaining risk is at the train/val *boundary*: a training row's
   7-day-ahead target window can extend into what would otherwise be the
   validation period. chronological_split() purges validation rows that
   start too soon after the last training date to guard against this.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

FORECAST_FEATURE_COLUMNS = [
    "weekly_revenue",            # "recent revenue"
    "transaction_count",
    "avg_transaction_value",
    "payment_collection_rate",   # "collection rate"
    "outstanding_amount",
    "day_of_week",               # derived here, not a Phase 1 feature-table column
    "revenue_growth_pct",        # "recent growth"
]
TARGET_COLUMN = "target_next_7d_revenue"


def build_forecast_dataset(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    One row per (merchant, as_of_date) where:
      - every required input feature is non-null (enough warm-up history), and
      - the next 7 calendar days of actual revenue exist (enough lookahead
        history) so a true target can be computed -- never a forecast
        used as its own label.

    Rows failing either condition are dropped, not imputed -- an invented
    target would defeat the entire point of an honest evaluation.
    """
    rows = []
    for merchant_id, g in features_df.groupby("merchant_id"):
        g = g.sort_values("date").reset_index(drop=True)
        revenue_by_date = dict(zip(g["date"], g["daily_revenue"]))

        for _, row in g.iterrows():
            as_of: date = row["date"]
            target_dates = [as_of + timedelta(days=k) for k in range(1, 8)]
            if not all(d in revenue_by_date for d in target_dates):
                continue  # not enough future history yet for this merchant

            feature_values = {
                "weekly_revenue": row["weekly_revenue"],
                "transaction_count": row["transaction_count"],
                "avg_transaction_value": row["avg_transaction_value"],
                "payment_collection_rate": row["payment_collection_rate"],
                "outstanding_amount": row["outstanding_amount"],
                "day_of_week": as_of.weekday(),
                "revenue_growth_pct": row["revenue_growth_pct"],
            }
            if any(
                (v is None or (isinstance(v, float) and np.isnan(v)))
                for k, v in feature_values.items() if k != "day_of_week"
            ):
                continue  # insufficient warm-up for this row's features

            rows.append({
                "merchant_id": merchant_id,
                "as_of_date": as_of,
                **feature_values,
                TARGET_COLUMN: sum(revenue_by_date[d] for d in target_dates),
            })

    return pd.DataFrame(rows)


def chronological_split(
    dataset: pd.DataFrame, val_fraction: float = 0.2, purge_days: int = 7
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Per merchant: the earliest (1 - val_fraction) of as_of_dates go to
    training, the rest are validation candidates -- EXCEPT any candidate
    within `purge_days` of the last training as_of_date is dropped
    entirely (neither train nor val), since its target window would
    otherwise overlap the training target windows right at the boundary.
    Never shuffles; order is preserved by construction.
    """
    train_parts, val_parts = [], []
    for merchant_id, g in dataset.groupby("merchant_id"):
        g = g.sort_values("as_of_date").reset_index(drop=True)
        split_idx = int(len(g) * (1 - val_fraction))
        if split_idx < 1 or split_idx >= len(g):
            train_parts.append(g)  # too few rows to split; keep all as train
            continue

        train_part = g.iloc[:split_idx]
        candidate = g.iloc[split_idx:]
        last_train_date = train_part["as_of_date"].max()
        purge_cutoff = last_train_date + timedelta(days=purge_days)
        val_part = candidate[candidate["as_of_date"] > purge_cutoff]

        train_parts.append(train_part)
        if not val_part.empty:
            val_parts.append(val_part)

    train_df = pd.concat(train_parts, ignore_index=True) if train_parts else pd.DataFrame(columns=dataset.columns)
    val_df = pd.concat(val_parts, ignore_index=True) if val_parts else pd.DataFrame(columns=dataset.columns)
    return train_df, val_df

"""
Revenue features (architecture doc section 6):
  - daily/weekly revenue
  - transaction count
  - average transaction value
  - revenue growth
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def add_revenue_features(daily: pd.DataFrame) -> pd.DataFrame:
    """
    `daily` is the continuous per-merchant daily panel from
    data/aggregation.py (daily_merchant_aggregates). Adds:

      weekly_revenue        -- trailing 7-calendar-day sum of revenue
      avg_transaction_value -- revenue / transaction_count (that day)
      revenue_growth_pct    -- % change of weekly_revenue vs the prior
                                non-overlapping 7-day window
    """
    df = daily.sort_values(["merchant_id", "date"]).copy()

    df["weekly_revenue"] = (
        df.groupby("merchant_id")["revenue"]
        .transform(lambda s: s.rolling(window=7, min_periods=1).sum())
    )

    df["avg_transaction_value"] = np.where(
        df["transaction_count"] > 0,
        df["revenue"] / df["transaction_count"].replace(0, np.nan),
        np.nan,
    )

    # Prior 7-day window = weekly_revenue shifted 7 days.
    prior_week = df.groupby("merchant_id")["weekly_revenue"].shift(7)
    growth = (df["weekly_revenue"] - prior_week) / prior_week.replace(0, np.nan) * 100
    df["revenue_growth_pct"] = growth

    return df

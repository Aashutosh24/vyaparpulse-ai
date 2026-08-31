"""
Activity features (architecture doc section 6):
  - peak-hour revenue share
"""
from __future__ import annotations

import pandas as pd

from data.aggregation import transactions_to_frame


def compute_peak_hour_revenue_share(transactions: list[dict], daily_dates: pd.DataFrame) -> pd.DataFrame:
    """
    For each (merchant_id, date) in `daily_dates`, compute what share of
    the trailing-7-calendar-day revenue was earned in that window's
    single busiest hour-of-day (0-23) bucket.

    `daily_dates` must have columns ['merchant_id', 'date'] covering the
    full continuous calendar range per merchant (i.e. the output of
    data/aggregation.daily_merchant_aggregates, or any frame with the
    same date coverage) — this function follows that same coverage
    rather than inventing its own, so results line up with the rest of
    the feature row for that date.
    """
    tx = transactions_to_frame(transactions)
    out_frames = []

    for merchant_id, dates in daily_dates.groupby("merchant_id")["date"]:
        merchant_tx = tx[tx["merchant_id"] == merchant_id]
        date_index = pd.Index(sorted(dates.unique()), name="date")

        if merchant_tx.empty:
            result = pd.DataFrame({"merchant_id": merchant_id, "date": date_index,
                                    "peak_hour_revenue_share": pd.NA})
            out_frames.append(result)
            continue

        # date x hour matrix of revenue, reindexed to the full continuous range
        hourly = (
            merchant_tx.groupby(["date", "hour"])["amount"].sum()
            .unstack(fill_value=0.0)
            .reindex(index=date_index, fill_value=0.0)
            .reindex(columns=range(24), fill_value=0.0)
            .sort_index()
        )

        trailing_7d = hourly.rolling(window=7, min_periods=1).sum()
        total = trailing_7d.sum(axis=1)
        peak = trailing_7d.max(axis=1)
        share = (peak / total.replace(0, pd.NA)).astype("Float64")

        result = pd.DataFrame({
            "merchant_id": merchant_id,
            "date": date_index,
            "peak_hour_revenue_share": share.values,
        })
        out_frames.append(result)

    return pd.concat(out_frames, ignore_index=True) if out_frames else pd.DataFrame(
        columns=["merchant_id", "date", "peak_hour_revenue_share"]
    )

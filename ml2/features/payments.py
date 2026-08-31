"""
Payment features (architecture doc section 6):
  - payment collection rate
  - outstanding amount / ratio
  - payment reliability
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from data.aggregation import transactions_to_frame, payments_to_frame


def _per_transaction_status(transactions: list[dict], payments: list[dict]) -> pd.DataFrame:
    """
    One row per transaction with a derived status, based on total amount
    collected against it (not the raw per-payment 'status' field, which
    may only reflect one of several partial payments):

      paid    -- total collected >= transaction amount
      partial -- 0 < total collected < transaction amount
      pending -- nothing collected yet
    """
    tx = transactions_to_frame(transactions)
    if tx.empty:
        return pd.DataFrame(columns=["transaction_id", "merchant_id", "date", "status"])

    pay = payments_to_frame(payments)
    if not pay.empty:
        collected = pay.groupby("transaction_id")["amount_paid"].sum().rename("total_collected")
        tx = tx.merge(collected, on="transaction_id", how="left")
    else:
        tx["total_collected"] = 0.0
    tx["total_collected"] = tx["total_collected"].fillna(0.0)

    conditions = [
        tx["total_collected"] >= tx["amount"],
        tx["total_collected"] > 0,
    ]
    choices = ["paid", "partial"]
    tx["status"] = np.select(conditions, choices, default="pending")

    return tx[["transaction_id", "merchant_id", "date", "status"]]


def add_payment_features(
    daily: pd.DataFrame, transactions: list[dict], payments: list[dict]
) -> pd.DataFrame:
    """
    `daily` must already have weekly_revenue (from add_revenue_features)
    and amount_owed_asof, amount_collected (from data/aggregation.py).
    Adds:

      payment_collection_rate -- trailing-7d amount_collected / trailing-7d
                                  revenue, clipped to [0, 1]. This reads as
                                  "% of what I billed this week did I
                                  collect this week" — catching up on older
                                  debt doesn't push it past 100%, by design,
                                  so it stays interpretable to a merchant.
      outstanding_amount       -- alias of amount_owed_asof
      outstanding_ratio        -- outstanding_amount / weekly_revenue
      payment_reliability      -- trailing-30d share of transactions that
                                   reached 'paid' status
    """
    df = daily.copy()
    df["outstanding_amount"] = df["amount_owed_asof"]

    trailing_collected_7d = (
        df.groupby("merchant_id")["amount_collected"]
        .transform(lambda s: s.rolling(window=7, min_periods=1).sum())
    )
    raw_rate = trailing_collected_7d / df["weekly_revenue"].replace(0, np.nan)
    df["payment_collection_rate"] = raw_rate.clip(upper=1.0)

    df["outstanding_ratio"] = df["outstanding_amount"] / df["weekly_revenue"].replace(0, np.nan)

    # --- payment reliability: trailing 30d share of transactions marked 'paid' ---
    status_df = _per_transaction_status(transactions, payments)
    if not status_df.empty:
        daily_status_counts = (
            status_df.groupby(["merchant_id", "date"])
            .agg(
                tx_total=("status", "count"),
                tx_paid=("status", lambda s: (s == "paid").sum()),
            )
            .reset_index()
        )
        # Reindex against df's own (merchant_id, date) pairs — the correct
        # full range — not status_df's own min/max, which can be shorter
        # (a late payment can push df's range past the last transaction date).
        full_index = df[["merchant_id", "date"]].drop_duplicates()
        daily_status_counts = full_index.merge(daily_status_counts, on=["merchant_id", "date"], how="left")
        daily_status_counts[["tx_total", "tx_paid"]] = daily_status_counts[["tx_total", "tx_paid"]].fillna(0.0)
        daily_status_counts = daily_status_counts.sort_values(["merchant_id", "date"])

        daily_status_counts["tx_total_30d"] = (
            daily_status_counts.groupby("merchant_id")["tx_total"]
            .transform(lambda s: s.rolling(window=30, min_periods=1).sum())
        )
        daily_status_counts["tx_paid_30d"] = (
            daily_status_counts.groupby("merchant_id")["tx_paid"]
            .transform(lambda s: s.rolling(window=30, min_periods=1).sum())
        )
        daily_status_counts["payment_reliability"] = np.where(
            daily_status_counts["tx_total_30d"] > 0,
            daily_status_counts["tx_paid_30d"] / daily_status_counts["tx_total_30d"],
            np.nan,
        )

        df = df.merge(
            daily_status_counts[["merchant_id", "date", "payment_reliability"]],
            on=["merchant_id", "date"], how="left",
        )
    else:
        df["payment_reliability"] = np.nan

    return df

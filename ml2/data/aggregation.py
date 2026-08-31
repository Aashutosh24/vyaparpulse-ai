"""
Layer B — Merchant Aggregation.

Transforms validated transaction-level records into merchant-level daily
time series (architecture doc section 5, Layer B).

Hard rule from the doc, enforced here: "Do not assume a sale is paid
merely because a transaction exists." A transaction's `amount` and a
payment's `amount_paid` are tracked as two separate columns and never
collapsed into one number.

Correctness note: output is reindexed to a *continuous* daily calendar
per merchant (not just days that happen to have a transaction). Without
this, a later 7-day rolling window would silently roll over "the last 7
rows present" instead of "the last 7 calendar days" — wrong the moment a
merchant has a day with zero sales.
"""
from __future__ import annotations

import pandas as pd

DAILY_COLUMNS = ["merchant_id", "date", "revenue", "transaction_count",
                  "amount_collected", "amount_owed_asof"]


def transactions_to_frame(transactions: list[dict]) -> pd.DataFrame:
    """Validated transaction dicts -> a typed DataFrame, one row per transaction."""
    if not transactions:
        return pd.DataFrame(columns=["transaction_id", "merchant_id", "timestamp", "amount", "items"])
    df = pd.DataFrame(transactions)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    df["hour"] = df["timestamp"].dt.hour
    return df


def payments_to_frame(payments: list[dict]) -> pd.DataFrame:
    """Validated payment dicts -> a typed DataFrame, one row per payment."""
    if not payments:
        return pd.DataFrame(columns=["payment_id", "transaction_id", "merchant_id", "timestamp", "amount_paid", "status"])
    df = pd.DataFrame(payments)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp"].dt.date
    return df


def reindex_continuous_daily(df: pd.DataFrame) -> pd.DataFrame:
    """Fill in missing calendar days per merchant with zero-activity rows."""
    if df.empty:
        return df
    frames = []
    for merchant_id, group in df.groupby("merchant_id"):
        full_range = pd.date_range(group["date"].min(), group["date"].max(), freq="D").date
        g = group.set_index("date").reindex(full_range)
        g["merchant_id"] = merchant_id
        for col in ["revenue", "transaction_count", "amount_collected"]:
            if col in g.columns:
                g[col] = pd.to_numeric(g[col], errors="coerce").fillna(0.0)
        g.index.name = "date"
        frames.append(g.reset_index())
    return pd.concat(frames, ignore_index=True)


def daily_merchant_aggregates(transactions: list[dict], payments: list[dict]) -> pd.DataFrame:
    """
    One row per (merchant_id, date), continuous — no gaps — with:

      revenue           -- sum of transaction amounts that day
      transaction_count -- count of transactions that day
      amount_collected  -- sum of payments received that day (a payment
                            may land on a later date than its sale, and
                            may occur on a day with no new transaction —
                            both are handled)
      amount_owed_asof  -- cumulative (revenue - amount_collected) up to
                            and including that date; the running
                            outstanding balance, never negative

    Ratios, growth rates and anything else that looks *backward* across
    multiple days belongs in the feature layer, not here.
    """
    tx = transactions_to_frame(transactions)
    pay = payments_to_frame(payments)

    if tx.empty and pay.empty:
        return pd.DataFrame(columns=DAILY_COLUMNS)

    daily_revenue = (
        tx.groupby(["merchant_id", "date"]).agg(
            revenue=("amount", "sum"), transaction_count=("transaction_id", "count")
        ).reset_index()
        if not tx.empty else pd.DataFrame(columns=["merchant_id", "date", "revenue", "transaction_count"])
    )
    daily_collected = (
        pay.groupby(["merchant_id", "date"]).agg(amount_collected=("amount_paid", "sum")).reset_index()
        if not pay.empty else pd.DataFrame(columns=["merchant_id", "date", "amount_collected"])
    )

    merged = daily_revenue.merge(daily_collected, on=["merchant_id", "date"], how="outer")
    for col in ["revenue", "transaction_count", "amount_collected"]:
        # Explicit numeric cast: an empty placeholder frame (e.g. no payments
        # at all) has no data to infer a dtype from and defaults to 'object',
        # which silently survives fillna() but breaks cumsum() downstream.
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(0.0)

    merged = reindex_continuous_daily(merged)
    merged = merged.sort_values(["merchant_id", "date"]).reset_index(drop=True)

    merged["cum_revenue"] = merged.groupby("merchant_id")["revenue"].cumsum()
    merged["cum_collected"] = merged.groupby("merchant_id")["amount_collected"].cumsum()
    merged["amount_owed_asof"] = (merged["cum_revenue"] - merged["cum_collected"]).clip(lower=0)

    return merged[DAILY_COLUMNS].reset_index(drop=True)

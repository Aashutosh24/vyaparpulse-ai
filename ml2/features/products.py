"""
Product features (architecture doc section 6):
  - product demand

Only meaningful when transactions are itemized. Voice-captured
transactions may arrive with `items: []` (see section 24's own example)
— those rows simply don't contribute to any product's demand, they
don't raise an error.
"""
from __future__ import annotations

import pandas as pd

from data.aggregation import transactions_to_frame


def compute_product_demand(transactions: list[dict], daily_dates: pd.DataFrame) -> pd.DataFrame:
    """
    For each (merchant_id, date) in `daily_dates`, compute trailing-7-day
    quantity sold per product as a dict, e.g. {"chai": 42, "samosa": 18}.
    Empty dict when there is no itemized data in that window.
    """
    tx = transactions_to_frame(transactions)
    rows = []
    for _, row in tx.iterrows():
        for item in row.get("items", []) or []:
            product = item.get("product")
            qty = item.get("quantity")
            if product is None or qty is None:
                continue
            rows.append({"merchant_id": row["merchant_id"], "date": row["date"],
                         "product": product, "quantity": qty})
    items_df = pd.DataFrame(rows, columns=["merchant_id", "date", "product", "quantity"])

    out_frames = []
    for merchant_id, dates in daily_dates.groupby("merchant_id")["date"]:
        date_index = pd.Index(sorted(dates.unique()), name="date")
        merchant_items = items_df[items_df["merchant_id"] == merchant_id]

        if merchant_items.empty:
            demand_by_date = {d: {} for d in date_index}
        else:
            daily_qty = (
                merchant_items.groupby(["date", "product"])["quantity"].sum()
                .unstack(fill_value=0.0)
                .reindex(index=date_index, fill_value=0.0)
                .sort_index()
            )
            trailing_7d = daily_qty.rolling(window=7, min_periods=1).sum()
            demand_by_date = {
                d: {p: qty for p, qty in row.items() if qty > 0}
                for d, row in trailing_7d.iterrows()
            }

        out_frames.append(pd.DataFrame({
            "merchant_id": merchant_id,
            "date": date_index,
            "product_demand": [demand_by_date[d] for d in date_index],
        }))

    return pd.concat(out_frames, ignore_index=True) if out_frames else pd.DataFrame(
        columns=["merchant_id", "date", "product_demand"]
    )

"""
MerchantFeatureEngine — the central dependency for downstream intelligence
(architecture doc section 6). This is the Phase 1 deliverable: everything
in Phase 2+ (forecasting, anomaly, health, credit) consumes its output,
not raw transactions.

Recommended interface (doc section 6), implemented here:

    features = merchant_feature_engine.generate(
        transactions=transactions,
        payments=payments,
    )
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import jsonschema
import pandas as pd

from data.validation import validate_transactions, validate_payments
from data.aggregation import daily_merchant_aggregates
from features.revenue import add_revenue_features
from features.payments import add_payment_features
from features.activity import compute_peak_hour_revenue_share
from features.products import compute_product_demand
from features.stability import add_stability_features

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schemas" / "feature.schema.json"
with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
    FEATURE_SCHEMA = json.load(f)

FEATURE_COLUMNS = [
    "merchant_id", "date",
    "daily_revenue", "weekly_revenue",
    "transaction_count", "avg_transaction_value",
    "revenue_growth_pct",
    "payment_collection_rate", "outstanding_amount", "outstanding_ratio",
    "payment_reliability",
    "peak_hour_revenue_share",
    "product_demand",
    "revenue_volatility_7d",
]


@dataclass
class FeatureGenerationResult:
    features: pd.DataFrame
    transactions_valid: int = 0
    transactions_rejected: int = 0
    payments_valid: int = 0
    payments_rejected: int = 0
    rejected_samples: list[dict] = field(default_factory=list)

    def to_records(self) -> list[dict]:
        """Feature rows as JSON-schema-validated dicts (date -> ISO string)."""
        records = self.features.copy()
        records["date"] = records["date"].astype(str)
        return records.to_dict(orient="records")


def generate(transactions: list[dict], payments: list[dict] | None = None) -> FeatureGenerationResult:
    """
    Full Phase 1 pipeline: validate -> aggregate -> feature-engineer.
    Every value in the returned frame is schema-validated against
    feature.schema.json before being handed back.
    """
    payments = payments or []

    tx_result = validate_transactions(transactions)
    pay_result = validate_payments(payments)

    daily = daily_merchant_aggregates(tx_result.valid, pay_result.valid)

    if daily.empty:
        empty = pd.DataFrame(columns=FEATURE_COLUMNS)
        return FeatureGenerationResult(
            features=empty,
            transactions_valid=tx_result.valid_count,
            transactions_rejected=tx_result.rejected_count,
            payments_valid=pay_result.valid_count,
            payments_rejected=pay_result.rejected_count,
            rejected_samples=(tx_result.rejected + pay_result.rejected)[:5],
        )

    daily = add_revenue_features(daily)
    daily = add_payment_features(daily, tx_result.valid, pay_result.valid)
    daily = add_stability_features(daily)

    date_keys = daily[["merchant_id", "date"]].drop_duplicates()
    peak_hour = compute_peak_hour_revenue_share(tx_result.valid, date_keys)
    product_demand = compute_product_demand(tx_result.valid, date_keys)

    daily = daily.merge(peak_hour, on=["merchant_id", "date"], how="left")
    daily = daily.merge(product_demand, on=["merchant_id", "date"], how="left")

    # transaction_count is float64 by this point for ANY merchant that had
    # even one reindexed gap-day (fillna(0.0) upcasts the whole column, not
    # just the filled cells) -- cast back before it leaves this module.
    daily["transaction_count"] = daily["transaction_count"].astype(int)

    daily = daily.rename(columns={"revenue": "daily_revenue"})
    features_df = daily[FEATURE_COLUMNS].sort_values(["merchant_id", "date"]).reset_index(drop=True)

    _validate_output(features_df)

    return FeatureGenerationResult(
        features=features_df,
        transactions_valid=tx_result.valid_count,
        transactions_rejected=tx_result.rejected_count,
        payments_valid=pay_result.valid_count,
        payments_rejected=pay_result.rejected_count,
        rejected_samples=(tx_result.rejected + pay_result.rejected)[:5],
    )


def _validate_output(features_df: pd.DataFrame) -> None:
    """Every feature row must satisfy feature.schema.json. Fail loudly if not —
    a silently-invalid feature dataset is worse than a crash (section 19:
    'report failures honestly')."""
    records = features_df.copy()
    records["date"] = records["date"].astype(str)
    for record in records.to_dict(orient="records"):
        # Required fields must stay present even when their value is
        # unknown yet (e.g. revenue_growth_pct on day 1) — schema allows
        # null for exactly this reason. Drop the key ONLY for the one
        # genuinely-optional field (product_demand has a default of {}
        # so it should never be NaN, but guard anyway).
        clean = {k: (None if (isinstance(v, float) and pd.isna(v)) else v) for k, v in record.items()}
        jsonschema.validate(instance=clean, schema=FEATURE_SCHEMA)

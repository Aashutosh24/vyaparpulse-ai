"""
Stability features (architecture doc section 6):
  - revenue volatility / cash-flow stability
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def add_stability_features(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Adds revenue_volatility_7d = coefficient of variation (std / mean) of
    daily revenue over the trailing 7 calendar days. Null when fewer than
    2 days of history exist yet (std is undefined for a single point).

    Lower = steadier cash flow. This is a plain statistical measure, not
    a model — matches section 30's principle of building the simple,
    explainable version first.
    """
    df = daily.sort_values(["merchant_id", "date"]).copy()

    rolling_std = df.groupby("merchant_id")["revenue"].transform(
        lambda s: s.rolling(window=7, min_periods=2).std()
    )
    rolling_mean = df.groupby("merchant_id")["revenue"].transform(
        lambda s: s.rolling(window=7, min_periods=2).mean()
    )

    df["revenue_volatility_7d"] = np.where(
        rolling_mean > 0, rolling_std / rolling_mean, np.nan
    )
    return df

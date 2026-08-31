"""
Moving-average baseline (architecture doc section 7):
  "Build a simple moving-average baseline first."
  Purpose: establish a reference, validate the data pipeline, prevent
  unjustified claims about model performance.

Prediction = weekly_revenue as of the forecast date, i.e. "the next 7
days will look like the last 7 days." weekly_revenue is already a
trailing 7-day sum (features/revenue.py) so no extra computation is
needed -- this genuinely is the simplest defensible baseline, not a
placeholder for a fancier one.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


class MovingAverageBaseline:
    """Stateless persistence baseline. fit() exists only so this class
    has the same .fit()/.predict() shape as XGBoostForecaster."""

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "MovingAverageBaseline":
        return self  # nothing to learn

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if "weekly_revenue" not in X.columns:
            raise ValueError("MovingAverageBaseline requires a 'weekly_revenue' column")
        return X["weekly_revenue"].to_numpy(dtype=float)

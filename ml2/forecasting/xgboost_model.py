"""
XGBoost forecaster (architecture doc section 7): "Use an XGBoost
Regressor as the primary forecasting model," with the doc's own named
input feature list (forecasting/dataset.py::FORECAST_FEATURE_COLUMNS
maps directly onto it).

Hyperparameters are deliberately conservative (shallow trees, explicit
regularization, no exhaustive tuning) given the dataset is still modest
in absolute ML terms even after extending the demo data -- tuning
aggressively against a small validation set would risk exactly the kind
of "unjustified claims about model performance" section 7 warns against.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from forecasting.dataset import FORECAST_FEATURE_COLUMNS


class XGBoostForecaster:
    def __init__(self, **overrides):
        params = dict(
            n_estimators=200,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
        )
        params.update(overrides)
        self.model = XGBRegressor(**params)
        self._fitted = False

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "XGBoostForecaster":
        self.model.fit(X[FORECAST_FEATURE_COLUMNS], y)
        self._fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("call .fit() before .predict()")
        return self.model.predict(X[FORECAST_FEATURE_COLUMNS])

    def feature_importances(self) -> dict:
        if not self._fitted:
            raise RuntimeError("call .fit() before .feature_importances()")
        return dict(zip(FORECAST_FEATURE_COLUMNS, self.model.feature_importances_.tolist()))

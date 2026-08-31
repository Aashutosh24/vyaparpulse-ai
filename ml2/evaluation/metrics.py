"""
Forecast evaluation metrics (architecture doc section 8): MAE, RMSE, and
MAPE "where mathematically appropriate" -- MAPE is undefined/explosive
when the actual value is at or near zero, which is a real possibility
here (a quiet week for a micro-merchant can have very low revenue), so
it is computed only over rows where the actual exceeds a floor, and the
excluded fraction is reported rather than silently dropped.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class MetricResult:
    mae: float
    rmse: float
    mape: float | None          # None if no rows cleared the floor
    mape_rows_used: int
    mape_rows_excluded: int
    n: int


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)))


def mape(y_true: np.ndarray, y_pred: np.ndarray, floor: float = 50.0) -> tuple[float | None, int, int]:
    """
    Mean absolute percentage error, computed only where |y_true| > floor
    (default: 50 currency units -- below that, a forecast miss of even a
    few rupees produces a triple-digit "percentage error" that doesn't
    mean anything). Returns (mape_or_None, rows_used, rows_excluded).
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = np.abs(y_true) > floor
    excluded = int((~mask).sum())
    if mask.sum() == 0:
        return None, 0, excluded
    pct_err = np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])
    return float(np.mean(pct_err) * 100), int(mask.sum()), excluded


def evaluate(y_true: np.ndarray, y_pred: np.ndarray, mape_floor: float = 50.0) -> MetricResult:
    mape_val, used, excl = mape(y_true, y_pred, floor=mape_floor)
    return MetricResult(
        mae=mae(y_true, y_pred),
        rmse=rmse(y_true, y_pred),
        mape=mape_val,
        mape_rows_used=used,
        mape_rows_excluded=excl,
        n=len(y_true),
    )

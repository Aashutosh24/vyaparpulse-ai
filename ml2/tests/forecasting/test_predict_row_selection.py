from datetime import date

import numpy as np
import pandas as pd

from predict import _most_recent_complete_row


def _row(d, **overrides):
    base = {
        "date": d, "merchant_id": "M1",
        "weekly_revenue": 1000.0, "transaction_count": 5,
        "avg_transaction_value": 200.0, "payment_collection_rate": 0.9,
        "outstanding_amount": 100.0, "revenue_growth_pct": 5.0,
    }
    base.update(overrides)
    return base


def test_skips_trailing_tail_day_with_null_avg_transaction_value():
    """Reproduces the exact bug found running predict.py against real
    demo output: the literal last row is a payment-only tail day (zero
    new transactions -> avg_transaction_value is correctly null, per
    Phase 1's own documented behavior), so it must be skipped in favor
    of the most recent COMPLETE row, not treated as unforecastable."""
    df = pd.DataFrame([
        _row(date(2026, 8, 26)),
        _row(date(2026, 8, 27)),
        _row(date(2026, 8, 28), avg_transaction_value=np.nan, transaction_count=0),  # tail day
    ])
    picked = _most_recent_complete_row(df)
    assert picked["date"] == date(2026, 8, 27)


def test_returns_none_when_no_row_is_complete():
    df = pd.DataFrame([_row(date(2026, 8, 26), avg_transaction_value=np.nan)])
    assert _most_recent_complete_row(df) is None


def test_picks_the_true_last_row_when_it_is_actually_complete():
    df = pd.DataFrame([_row(date(2026, 8, 26)), _row(date(2026, 8, 27))])
    picked = _most_recent_complete_row(df)
    assert picked["date"] == date(2026, 8, 27)

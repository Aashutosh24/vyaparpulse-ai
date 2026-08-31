import numpy as np
import pytest

from evaluation.metrics import mae, rmse, mape, evaluate


def test_mae_known_value():
    assert mae([100, 200, 300], [110, 190, 320]) == pytest.approx((10 + 10 + 20) / 3)


def test_rmse_known_value():
    # errors: 10, -10, 20 -> squared: 100,100,400 -> mean 200 -> sqrt ~14.142
    assert rmse([100, 200, 300], [110, 190, 320]) == pytest.approx(np.sqrt(200), rel=1e-6)


def test_mae_zero_for_perfect_prediction():
    assert mae([1, 2, 3], [1, 2, 3]) == 0
    assert rmse([1, 2, 3], [1, 2, 3]) == 0


def test_mape_excludes_near_zero_actuals():
    y_true = [1000, 2000, 5]     # last value is near-zero
    y_pred = [1100, 1900, 500]   # huge % error on the near-zero one
    value, used, excluded = mape(y_true, y_pred, floor=50.0)
    assert used == 2
    assert excluded == 1
    # only the first two rows should factor in: |100/1000| and |100/2000|
    assert value == pytest.approx((0.10 + 0.05) / 2 * 100)


def test_mape_returns_none_when_everything_is_below_floor():
    value, used, excluded = mape([1, 2, 3], [1, 2, 3], floor=50.0)
    assert value is None
    assert used == 0
    assert excluded == 3


def test_evaluate_returns_all_fields():
    result = evaluate([100, 200, 300], [110, 190, 320])
    assert result.n == 3
    assert result.mae > 0
    assert result.rmse > 0
    assert result.mape is not None

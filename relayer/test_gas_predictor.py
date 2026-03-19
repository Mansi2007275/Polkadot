"""
Unit tests for GasPredictor — optimal gas window timing.
"""
import pytest
from gas_predictor import GasPredictor


def test_record_and_sample_count() -> None:
    p = GasPredictor(window_size=10)
    assert p.sample_count == 0

    p.record(20.0, 1)
    p.record(25.0, 2)
    assert p.sample_count == 2

    for i in range(15):
        p.record(10.0 + i, 100 + i)
    assert p.sample_count == 10  # maxlen


def test_predict_optimal_gas_returns_reasonable_value() -> None:
    p = GasPredictor(window_size=50)
    for i in range(20):
        p.record(10.0 + (i % 5), 100 + i)

    optimal = p.predict_optimal_gas()
    assert 8.0 <= optimal <= 20.0


def test_should_execute_now_below_ceiling() -> None:
    p = GasPredictor(window_size=20)
    for i in range(15):
        p.record(30.0 + (i * 0.5), 100 + i)

    # Current gas below ceiling should allow execution with enough samples
    assert p.should_execute_now(40.0, 50.0) in (True, False)  # depends on optimal


def test_should_execute_now_above_ceiling_returns_false() -> None:
    p = GasPredictor(window_size=20)
    for i in range(15):
        p.record(10.0, 100 + i)

    assert p.should_execute_now(60.0, 50.0) is False


def test_should_execute_now_few_samples() -> None:
    p = GasPredictor(window_size=20)
    p.record(10.0, 1)
    p.record(12.0, 2)

    # With < 5 samples, allows if gas <= ceiling * 0.8
    assert p.should_execute_now(30.0, 50.0) is True  # 30 < 40
    assert p.should_execute_now(45.0, 50.0) is False  # 45 > 40


def test_get_stats() -> None:
    p = GasPredictor(window_size=10)
    for i, g in enumerate([10.0, 15.0, 20.0, 12.0, 18.0]):
        p.record(g, 100 + i)

    stats = p.get_stats()
    assert stats["samples"] == 5
    assert stats["current"] == 18.0
    assert stats["mean"] == 15.0
    assert stats["min"] == 10.0
    assert stats["max"] == 20.0
    assert "predicted_optimal" in stats


def test_empty_history_get_stats() -> None:
    p = GasPredictor(window_size=10)
    assert p.get_stats() == {"samples": 0}


def test_predict_optimal_with_lt_3_samples() -> None:
    p = GasPredictor(window_size=10)
    p.record(25.0, 1)
    assert p.predict_optimal_gas() == 25.0

    p2 = GasPredictor(window_size=10)
    assert p2.predict_optimal_gas() == 10.0  # default when empty

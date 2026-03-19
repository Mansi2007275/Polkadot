"""
Gas Price Predictor — Lightweight heuristic model for optimal transaction timing.

Uses a sliding window of recent gas prices and applies exponential weighting
to predict when gas will be cheapest. On Paseo this is more relevant for
demonstrating the concept; on mainnet it would use actual fee volatility.
"""

import time
from collections import deque
from dataclasses import dataclass, field

import numpy as np


@dataclass
class GasSample:
    timestamp: float
    gas_price_gwei: float
    block_number: int


class GasPredictor:
    """Predicts optimal gas windows using exponentially-weighted moving statistics."""

    def __init__(self, window_size: int = 50, target_percentile: float = 0.25):
        self._window_size = window_size
        self._target_percentile = target_percentile
        self._history: deque[GasSample] = deque(maxlen=window_size)
        self._last_prediction: float | None = None

    def record(self, gas_price_gwei: float, block_number: int) -> None:
        self._history.append(
            GasSample(
                timestamp=time.time(),
                gas_price_gwei=gas_price_gwei,
                block_number=block_number,
            )
        )

    @property
    def sample_count(self) -> int:
        return len(self._history)

    def predict_optimal_gas(self) -> float:
        """
        Returns the predicted optimal gas price (gwei) based on recent history.
        Uses the target percentile of recent prices with exponential decay
        weighting (more recent = higher weight).
        """
        if len(self._history) < 3:
            return self._history[-1].gas_price_gwei if self._history else 10.0

        prices = np.array([s.gas_price_gwei for s in self._history])
        n = len(prices)

        # Exponential weights: recent samples weighted more
        decay = 0.95
        weights = np.array([decay ** (n - 1 - i) for i in range(n)])
        weights /= weights.sum()

        sorted_indices = np.argsort(prices)
        sorted_prices = prices[sorted_indices]
        sorted_weights = weights[sorted_indices]

        cum_weight = np.cumsum(sorted_weights)
        idx = np.searchsorted(cum_weight, self._target_percentile)
        idx = min(idx, n - 1)

        self._last_prediction = float(sorted_prices[idx])
        return self._last_prediction

    def should_execute_now(self, current_gas_gwei: float, ceiling_gwei: float) -> bool:
        """
        Decision function: should we submit the subsidized withdrawal now?

        Returns True if:
        1. Current gas is at or below the predicted optimal, OR
        2. Current gas is below the ceiling and we have very few samples, OR
        3. We haven't transacted in the last 5 minutes and gas is reasonable.
        """
        if current_gas_gwei > ceiling_gwei:
            return False

        if self.sample_count < 5:
            return current_gas_gwei <= ceiling_gwei * 0.8

        optimal = self.predict_optimal_gas()
        margin = 1.15  # 15% tolerance above optimal
        return current_gas_gwei <= optimal * margin

    def get_stats(self) -> dict:
        if not self._history:
            return {"samples": 0}

        prices = [s.gas_price_gwei for s in self._history]
        return {
            "samples": len(prices),
            "current": prices[-1],
            "mean": float(np.mean(prices)),
            "median": float(np.median(prices)),
            "p25": float(np.percentile(prices, 25)),
            "p75": float(np.percentile(prices, 75)),
            "min": float(np.min(prices)),
            "max": float(np.max(prices)),
            "predicted_optimal": self._last_prediction,
        }

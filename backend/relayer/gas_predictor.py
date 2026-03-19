
import time
import statistics
import logging

class GasPredictor:
    """
    Predicts optimal gas fee windows for subsidised transactions.
    Uses a simple moving average of recent blocks on Paseo Net.
    """
    def __init__(self, window_size=20):
        self.window_size = window_size
        self.history = []
        self.logger = logging.getLogger("GasPredictor")

    def add_data_point(self, base_fee):
        self.history.append(base_fee)
        if len(self.history) > self.window_size:
            self.history.pop(0)

    def is_optimal_window(self, current_fee) -> bool:
        """
        Logic: If current fee is below the median of recent history, it's a good window.
        """
        if len(self.history) < self.window_size // 2:
            return True # Not enough data, proceed to build history
            
        median_fee = statistics.median(self.history)
        # Threshold: 10% above median is still acceptable for hackathon UX
        is_optimal = current_fee <= (median_fee * 1.1)
        
        self.logger.info(f"Predictor Check: Current={current_fee}, Median={median_fee}, Optimal={is_optimal}")
        return is_optimal

    def get_stats(self):
        if not self.history:
            return {"median": 0, "current": 0, "status": "initializing"}
        return {
            "median": statistics.median(self.history),
            "mean": statistics.mean(self.history),
            "history_size": len(self.history)
        }

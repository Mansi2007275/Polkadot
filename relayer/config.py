import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    RPC_URL: str = os.getenv("RPC_URL", "https://paseo.rpc.polkadot.com")
    PRIVATE_KEY: str = os.getenv("PRIVATE_KEY", "")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "420420421"))

    SUBSIDY_POOL_ADDRESS: str = os.getenv("SUBSIDY_POOL_ADDRESS", "")
    STREAM_ADDRESS: str = os.getenv("STREAM_ADDRESS", "")
    BRIDGE_ADDRESS: str = os.getenv("BRIDGE_ADDRESS", "")

    GAS_PRICE_CEILING_GWEI: float = float(os.getenv("GAS_PRICE_CEILING_GWEI", "50"))
    MIN_STREAM_BALANCE_USDT: float = float(os.getenv("MIN_STREAM_BALANCE_USDT", "0.01"))
    POLL_INTERVAL_SECONDS: int = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))
    SYNC_YIELD_INTERVAL_SECONDS: int = int(os.getenv("SYNC_YIELD_INTERVAL_SECONDS", "3600"))

    # Staking sync: trigger when pending rewards exceed this (wei)
    MIN_REWARDS_TO_SYNC_WEI: int = int(os.getenv("MIN_REWARDS_TO_SYNC_WEI", "1000000000000000"))  # 0.001 DOT

    # Batch withdrawal: only execute if total stream value > GAS_COST_MULTIPLIER * estimated gas cost
    VALUE_PER_GAS_MULTIPLIER: float = float(os.getenv("VALUE_PER_GAS_MULTIPLIER", "5"))

    # Gas prediction model parameters
    GAS_HISTORY_WINDOW: int = 50
    GAS_PREDICTION_PERCENTILE: float = 0.25  # Target the 25th percentile for optimal timing

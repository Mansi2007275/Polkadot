"""
Agentic Relayer — Monitors MicropaymentStream events and triggers subsidised
withdrawals at optimal gas windows on Paseo.

Architecture:
  1. Poll for active streams with claimable balances
  2. Use GasPredictor to find optimal execution windows
  3. get_optimal_batch() filters by value-per-gas (Total Stream Value > 5x Gas Cost)
  4. Call SubsidyPool.subsidisedWithdraw() to claim on behalf of recipients
  5. Call syncRealTimeYield() when pendingRewards exceeds threshold OR on interval
"""

import asyncio
import logging
import time
from dataclasses import dataclass

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import Config
from abis import SUBSIDY_POOL_ABI, STREAM_ABI, BRIDGE_ABI
from gas_predictor import GasPredictor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("relayer")


@dataclass
class PendingWithdrawal:
    stream_id: int
    recipient: str
    balance: int
    rate_per_second: int
    discovered_at: float


class AgenticRelayer:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.w3 = Web3(Web3.HTTPProvider(cfg.RPC_URL))
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self.account = self.w3.eth.account.from_key(cfg.PRIVATE_KEY)
        self.address = self.account.address
        log.info(f"Relayer address: {self.address}")

        self.subsidy = self.w3.eth.contract(
            address=Web3.to_checksum_address(cfg.SUBSIDY_POOL_ADDRESS),
            abi=SUBSIDY_POOL_ABI,
        )
        self.stream = self.w3.eth.contract(
            address=Web3.to_checksum_address(cfg.STREAM_ADDRESS),
            abi=STREAM_ABI,
        )
        self.bridge = self.w3.eth.contract(
            address=Web3.to_checksum_address(cfg.BRIDGE_ADDRESS),
            abi=BRIDGE_ABI,
        )

        self.gas_predictor = GasPredictor(
            window_size=cfg.GAS_HISTORY_WINDOW,
            target_percentile=cfg.GAS_PREDICTION_PERCENTILE,
        )
        self.pending: dict[int, PendingWithdrawal] = {}
        self.stats = {
            "total_withdrawals": 0,
            "total_gas_saved": 0,
            "yield_syncs": 0,
            "errors": 0,
        }
        self._last_yield_sync = 0.0
        self._nonce = self.w3.eth.get_transaction_count(self.address)

    def _check_authorization(self) -> bool:
        try:
            is_relayer = self.subsidy.functions.authorisedRelayers(self.address).call()
            log.info(f"Authorization check: {'AUTHORIZED' if is_relayer else 'NOT AUTHORIZED'}")
            return is_relayer
        except Exception as e:
            log.error(f"Authorization check failed: {e}")
            return False

    def _sample_gas(self) -> float:
        try:
            gas_price = self.w3.eth.gas_price
            gas_gwei = float(Web3.from_wei(gas_price, "gwei"))
            block = self.w3.eth.block_number
            self.gas_predictor.record(gas_gwei, block)
            return gas_gwei
        except Exception as e:
            log.error(f"Gas sampling failed: {e}")
            return 999.0

    def _scan_active_streams(self) -> list[PendingWithdrawal]:
        """Scan for streams with claimable balances."""
        pending = []
        try:
            next_id = self.stream.functions.nextStreamId().call()
            min_balance = int(self.cfg.MIN_STREAM_BALANCE_USDT * 1e6)

            for sid in range(1, next_id):
                try:
                    balance = self.stream.functions.balanceOf(sid).call()
                    if balance >= min_balance:
                        stream_data = self.stream.functions.getStream(sid).call()
                        if stream_data[8] == 0:  # status == Active
                            pw = PendingWithdrawal(
                                stream_id=sid,
                                recipient=stream_data[1],
                                balance=balance,
                                rate_per_second=stream_data[4],
                                discovered_at=time.time(),
                            )
                            pending.append(pw)
                            log.info(
                                f"Stream #{sid}: {balance / 1e6:.6f} USDT claimable "
                                f"(rate: {stream_data[4]} per sec)"
                            )
                except Exception:
                    continue

        except Exception as e:
            log.error(f"Stream scan failed: {e}")
            self.stats["errors"] += 1

        return pending

    def get_optimal_batch(
        self,
        pending_streams: list[PendingWithdrawal],
        gas_gwei: float,
    ) -> list[PendingWithdrawal]:
        """
        Filter pending streams by value-per-gas.
        Only execute if (Total Stream Value > VALUE_PER_GAS_MULTIPLIER * Gas Cost).
        Waits for 'deep' gas troughs when value is marginal.
        """
        if not pending_streams:
            return []

        # Estimate gas cost for one withdrawal (wei)
        gas_per_tx = 300_000
        gas_price_wei = int(gas_gwei * 1e9)
        gas_cost_wei = gas_per_tx * gas_price_wei

        # USDT 6 decimals: balance is in smallest units
        total_value_usdt = sum(p.balance for p in pending_streams)
        # Rough: 1 USDT = 1e6 units; assume 1 USDT ≈ 1e18 wei for DOT equiv (simplified)
        total_value_wei = total_value_usdt * 10**12  # 1 USDT ≈ 1e12 wei (rough)

        multiplier = self.cfg.VALUE_PER_GAS_MULTIPLIER
        min_value_required = gas_cost_wei * multiplier * len(pending_streams)

        if total_value_wei < min_value_required:
            log.info(
                f"Batch rejected: value {total_value_usdt / 1e6:.2f} USDT < "
                f"{multiplier}x gas cost. Waiting for deeper trough."
            )
            return []

        # Sort by balance descending: maximize value per gas
        sorted_pending = sorted(pending_streams, key=lambda p: p.balance, reverse=True)
        return sorted_pending

    def _should_sync_yield(self, gas_gwei: float) -> bool:
        """Sync when: pendingRewards > threshold OR (interval elapsed AND gas is good)."""
        try:
            stats = self.bridge.functions.getStakingStats().call()
            pending_rewards = stats[0]
        except Exception:
            return False

        if pending_rewards >= self.cfg.MIN_REWARDS_TO_SYNC_WEI:
            return self.gas_predictor.should_execute_now(
                gas_gwei, self.cfg.GAS_PRICE_CEILING_GWEI
            )

        elapsed = time.time() - self._last_yield_sync
        if elapsed >= self.cfg.SYNC_YIELD_INTERVAL_SECONDS:
            return self.gas_predictor.should_execute_now(
                gas_gwei, self.cfg.GAS_PRICE_CEILING_GWEI
            )

        return False

    def _execute_withdrawal(self, pw: PendingWithdrawal) -> bool:
        """Execute a subsidised withdrawal for a stream."""
        try:
            current_balance = self.stream.functions.balanceOf(pw.stream_id).call()
            if current_balance == 0:
                log.info(f"Stream #{pw.stream_id}: already fully claimed, skipping")
                return False

            tx = self.subsidy.functions.subsidisedWithdraw(
                pw.stream_id, current_balance
            ).build_transaction(
                {
                    "from": self.address,
                    "nonce": self._nonce,
                    "chainId": self.cfg.CHAIN_ID,
                    "gas": 300_000,
                    "gasPrice": self.w3.eth.gas_price,
                }
            )

            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            self._nonce += 1
            gas_used = receipt["gasUsed"]

            if receipt["status"] == 1:
                log.info(
                    f"Subsidised withdrawal for stream #{pw.stream_id}: "
                    f"{current_balance / 1e6:.6f} USDT, gas={gas_used}, "
                    f"tx={tx_hash.hex()}"
                )
                self.stats["total_withdrawals"] += 1
                self.stats["total_gas_saved"] += gas_used
                return True
            else:
                log.warning(f"TX reverted for stream #{pw.stream_id}: {tx_hash.hex()}")
                self.stats["errors"] += 1
                return False

        except Exception as e:
            log.error(f"Withdrawal failed for stream #{pw.stream_id}: {e}")
            self.stats["errors"] += 1
            return False

    def _sync_yield(self) -> bool:
        """Call syncRealTimeYield on the bridge to sweep staking rewards."""
        try:
            stats = self.bridge.functions.getStakingStats().call()
            pending_rewards = stats[0]

            if pending_rewards == 0:
                log.info("No pending staking rewards to sync")
                return False

            log.info(f"Pending staking rewards: {Web3.from_wei(pending_rewards, 'ether'):.6f} DOT")

            tx = self.bridge.functions.syncRealTimeYield().build_transaction(
                {
                    "from": self.address,
                    "nonce": self._nonce,
                    "chainId": self.cfg.CHAIN_ID,
                    "gas": 200_000,
                    "gasPrice": self.w3.eth.gas_price,
                }
            )

            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            self._nonce += 1

            if receipt["status"] == 1:
                log.info(f"Yield synced successfully: tx={tx_hash.hex()}")
                self.stats["yield_syncs"] += 1
                self._last_yield_sync = time.time()
                return True
            else:
                log.warning(f"Yield sync reverted: {tx_hash.hex()}")
                self.stats["errors"] += 1
                return False

        except Exception as e:
            log.error(f"Yield sync failed: {e}")
            self.stats["errors"] += 1
            return False

    async def run_loop(self):
        """Main event loop: sample gas, scan streams, execute optimal batch withdrawals."""
        log.info("=" * 60)
        log.info("Agentic Relayer starting...")
        log.info(f"RPC: {self.cfg.RPC_URL}")
        log.info(f"Chain ID: {self.cfg.CHAIN_ID}")
        log.info(f"Poll interval: {self.cfg.POLL_INTERVAL_SECONDS}s")
        log.info(f"Gas ceiling: {self.cfg.GAS_PRICE_CEILING_GWEI} gwei")
        log.info(f"Value-per-gas multiplier: {self.cfg.VALUE_PER_GAS_MULTIPLIER}x")
        log.info("=" * 60)

        if not self._check_authorization():
            log.warning("Relayer is NOT authorized on SubsidyPool — withdrawals will fail")

        while True:
            try:
                gas_gwei = self._sample_gas()
                log.info(f"Gas: {gas_gwei:.2f} gwei | Samples: {self.gas_predictor.sample_count}")

                # Staking sync: trigger when pendingRewards exceeds threshold OR interval
                if self._should_sync_yield(gas_gwei):
                    self._sync_yield()

                # Scan for claimable streams
                pending_list = self._scan_active_streams()

                if pending_list and self.gas_predictor.should_execute_now(
                    gas_gwei, self.cfg.GAS_PRICE_CEILING_GWEI
                ):
                    optimal_batch = self.get_optimal_batch(pending_list, gas_gwei)

                    if optimal_batch:
                        gas_stats = self.gas_predictor.get_stats()
                        log.info(
                            f"Optimal batch — executing {len(optimal_batch)} withdrawals "
                            f"(predicted: {gas_stats.get('predicted_optimal', 'N/A')} gwei)"
                        )

                        for pw in optimal_batch:
                            self._execute_withdrawal(pw)
                            await asyncio.sleep(1)
                    elif pending_list:
                        log.info(
                            f"Batch deferred: value < {self.cfg.VALUE_PER_GAS_MULTIPLIER}x gas. "
                            f"Waiting for deeper trough."
                        )
                elif pending_list:
                    log.info(
                        f"Found {len(pending_list)} claimable streams, "
                        f"waiting for better gas window (current: {gas_gwei:.2f} gwei)"
                    )

                log.info(f"Stats: {self.stats}")

            except Exception as e:
                log.error(f"Loop error: {e}")
                self.stats["errors"] += 1

            await asyncio.sleep(self.cfg.POLL_INTERVAL_SECONDS)


def create_relayer() -> AgenticRelayer:
    return AgenticRelayer(Config())


import os
import json
import time
import logging
from web3 import Web3
from eth_account import Account
from .gas_predictor import GasPredictor

class PolkadotRelayer:
    """
    Automates subsidised withdrawals from MicropaymentStream via SubsidyPool.
    Uses GasPredictor to minimize protocol costs.
    """
    def __init__(self, rpc_url, private_key, pool_address, stream_address):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.account = Account.from_key(private_key)
        self.pool_address = pool_address
        self.stream_address = stream_address
        
        # Load ABIs
        with open("relayer/subsidy_pool_abi.json", "r") as f:
            pool_abi = json.load(f)
        with open("relayer/stream_abi.json", "r") as f:
            stream_abi = json.load(f)
            
        self.pool_contract = self.w3.eth.contract(address=pool_address, abi=pool_abi)
        self.stream_contract = self.w3.eth.contract(address=stream_address, abi=stream_abi)
        
        self.predictor = GasPredictor()
        self.logger = logging.getLogger("Relayer")

    def sync_gas_history(self):
        """Poll latest blocks to build gas history."""
        try:
            latest_block = self.w3.eth.get_block('latest')
            base_fee = latest_block.get('baseFeePerGas', 10**9) # Default 1 gwei if not EIP-1559
            self.predictor.add_data_point(base_fee)
        except Exception as e:
            self.logger.error(f"Failed to sync gas: {e}")

    def execute_subsidised_withdraw(self, stream_id, amount):
        """
        Main execution logic.
        1. Checks if current gas is optimal.
        2. Sends txn to SubsidyPool.
        """
        current_gas = self.w3.eth.gas_price
        self.sync_gas_history()
        
        if not self.predictor.is_optimal_window(current_gas):
            return {"status": "queued", "reason": "high_fees", "current_gas": current_gas}

        nonce = self.w3.eth.get_transaction_count(self.account.address)
        
        txn = self.pool_contract.functions.subsidisedWithdraw(
            int(stream_id), 
            int(amount)
        ).build_transaction({
            'from': self.account.address,
            'gas': 500000,
            'gasPrice': current_gas,
            'nonce': nonce,
            'chainId': self.w3.eth.chain_id
        })

        signed_txn = self.w3.eth.account.sign_transaction(txn, private_key=self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        self.logger.info(f"Relayed withdrawal for stream {stream_id}. Hash: {tx_hash.hex()}")
        return {"status": "success", "tx_hash": tx_hash.hex(), "gas_used": current_gas}


import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from .relayer import PolkadotRelayer

load_dotenv()

app = FastAPI(title="Zero-Fee Relayer Service")

# Configuration
RPC_URL = os.getenv("PASEO_RPC_URL", "https://paseo.rpc.polkadot.com")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
POOL_ADDRESS = os.getenv("POOL_ADDRESS")
STREAM_ADDRESS = os.getenv("STREAM_ADDRESS")

if not PRIVATE_KEY or not POOL_ADDRESS or not STREAM_ADDRESS:
    # Fail gracefully for hackathon setup
    print("Warning: Relayer environment variables not fully set.")

relayer = PolkadotRelayer(RPC_URL, PRIVATE_KEY, POOL_ADDRESS, STREAM_ADDRESS)

class WithdrawalRequest(BaseModel):
    stream_id: int
    amount: str # Using string for large numbers

@app.get("/")
def read_root():
    return {"status": "Relayer Active", "network": "Paseo Net"}

@app.get("/stats")
def get_stats():
    return {
        "relayer_address": relayer.account.address,
        "gas_stats": relayer.predictor.get_stats()
    }

@app.post("/relay/withdraw")
async def relay_withdrawal(request: WithdrawalRequest):
    try:
        result = relayer.execute_subsidised_withdraw(request.stream_id, request.amount)
        if result["status"] == "queued":
            return {"message": "Gas fees high. Request queued in AI window.", "details": result}
        return {"message": "Success", "tx_hash": result["tx_hash"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""
Agentic Relayer — FastAPI service for automated subsidised withdrawals.

Endpoints:
  GET  /health          — Service health check
  GET  /stats           — Relayer statistics (withdrawals, gas saved, yield syncs)
  GET  /gas             — Gas prediction model stats
  POST /trigger         — Manually trigger a scan + execute cycle
  POST /sync-yield      — Manually trigger a yield sync from staking precompile
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from relayer import create_relayer, AgenticRelayer
from config import Config

relayer_instance: AgenticRelayer | None = None
background_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global relayer_instance, background_task

    cfg = Config()
    if cfg.PRIVATE_KEY and cfg.SUBSIDY_POOL_ADDRESS:
        relayer_instance = create_relayer()
        background_task = asyncio.create_task(relayer_instance.run_loop())

    yield

    if background_task:
        background_task.cancel()
        try:
            await background_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Zero-Fee Micropayments — Agentic Relayer",
    description="AI-powered relayer that monitors streams and executes subsidised withdrawals at optimal gas windows.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "running" if relayer_instance else "not_configured",
        "service": "agentic-relayer",
        "chain_id": Config.CHAIN_ID,
        "rpc": Config.RPC_URL,
    }


@app.get("/stats")
async def stats():
    if not relayer_instance:
        raise HTTPException(503, "Relayer not configured")
    return {
        **relayer_instance.stats,
        "gas_predictor": relayer_instance.gas_predictor.get_stats(),
    }


@app.get("/gas")
async def gas_stats():
    if not relayer_instance:
        raise HTTPException(503, "Relayer not configured")
    return relayer_instance.gas_predictor.get_stats()


@app.post("/trigger")
async def trigger_scan():
    if not relayer_instance:
        raise HTTPException(503, "Relayer not configured")

    gas_gwei = relayer_instance._sample_gas()
    pending = relayer_instance._scan_active_streams()

    results = []
    for pw in pending:
        ok = relayer_instance._execute_withdrawal(pw)
        results.append({
            "stream_id": pw.stream_id,
            "balance": pw.balance,
            "executed": ok,
        })

    return {
        "gas_gwei": gas_gwei,
        "streams_found": len(pending),
        "results": results,
    }


@app.post("/sync-yield")
async def sync_yield():
    if not relayer_instance:
        raise HTTPException(503, "Relayer not configured")

    success = relayer_instance._sync_yield()
    return {"synced": success}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8081, reload=True)

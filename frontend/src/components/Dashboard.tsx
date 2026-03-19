import React, { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Activity, ArrowUpRight, Clock, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import {
  useStreamData,
  useStreamBalance,
  useWithdrawFromStream,
  useCancelStream,
  useNextStreamId,
  useRelayerWithdraw,
  formatUSDT,
  formatRate,
  progressPercent,
  streamStatusLabel,
  streamStatusColor,
  type StreamData,
  type StreamStatus,
} from "../hooks/useStream";

export default function Dashboard() {
  const { address } = useAccount();
  const { data: nextId } = useNextStreamId();

  const [streamId, setStreamId] = useState<string>("1");
  const [viewId, setViewId] = useState<bigint | undefined>(undefined);

  const handleLookup = () => {
    const n = parseInt(streamId, 10);
    if (!isNaN(n) && n > 0) setViewId(BigInt(n));
  };

  return (
    <div className="terminal-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-pink" />
            Active Streams
          </h2>
          <p className="text-[10px] font-mono text-[#666] mt-1">
            Next ID: <span className="text-neon-blue">#{nextId?.toString() ?? "—"}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-[#444]" />
          </div>
          <input
            type="number"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="Stream ID..."
            min="1"
            className="w-full pl-9 pr-3 py-3 bg-black/50 border border-[#222] text-white text-[11px] font-mono placeholder-[#444] focus:border-neon-pink focus:outline-none"
          />
        </div>
        <button
          onClick={handleLookup}
          className="px-5 py-3 bg-neon-pink/10 border border-neon-pink text-neon-pink text-[11px] font-mono font-semibold uppercase tracking-wider hover:bg-neon-pink/20 transition-colors"
        >
          Inspect
        </button>
      </div>

      {viewId !== undefined && <StreamCard streamId={viewId} connectedAddress={address} />}

      {!viewId && (
        <div className="py-16 text-center border border-dashed border-[#222]">
          <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
            Enter stream ID
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StreamCard({
  streamId,
  connectedAddress,
}: {
  streamId: bigint;
  connectedAddress: `0x${string}` | undefined;
}) {
  const { data: stream, isLoading, error } = useStreamData(streamId);
  const { data: claimable } = useStreamBalance(streamId);
  const { withdraw, isPending: withdrawPending } = useWithdrawFromStream();
  const { cancel, isPending: cancelPending } = useCancelStream();
  const { relayWithdraw, isRelaying, relayerResult } = useRelayerWithdraw();

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border border-[#222] border-t-neon-pink animate-spin" />
        <p className="text-[10px] font-mono text-[#666] uppercase">Querying</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="p-4 border border-red-500/30 bg-red-500/5">
        <p className="text-[11px] font-mono text-red-400">Stream not found</p>
      </div>
    );
  }

  const s = stream as unknown as StreamData;
  const progress = progressPercent(s);
  const isRecipient = connectedAddress?.toLowerCase() === s.recipient.toLowerCase();
  const isSender = connectedAddress?.toLowerCase() === s.sender.toLowerCase();
  const status = s.status as StreamStatus;
  const statusLabel = streamStatusLabel(status);
  const statusColor = streamStatusColor(status);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {status === 0 && (
        <StreamVisualizer rate={s.ratePerSecond} progress={progress} />
      )}

      <div className="terminal-card p-5 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 border border-neon-pink text-[10px] font-mono text-neon-pink">
              #{streamId.toString()}
            </span>
            <span className={`text-[10px] font-mono uppercase ${statusColor}`}>{statusLabel}</span>
          </div>
          <span className="text-[10px] font-mono text-[#666]">{formatRate(s.ratePerSecond)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-black/50 border border-[#222]">
            <p className="text-[9px] font-mono text-[#666] uppercase mb-1">Sender</p>
            <p className="text-[10px] font-mono text-white break-all">
              {s.sender.slice(0, 10)}…{s.sender.slice(-8)}
              {isSender && <span className="ml-1 text-neon-pink">·YOU</span>}
            </p>
          </div>
          <div className="p-3 bg-black/50 border border-[#222]">
            <p className="text-[9px] font-mono text-[#666] uppercase mb-1">Recipient</p>
            <p className="text-[10px] font-mono text-white break-all">
              {s.recipient.slice(0, 10)}…{s.recipient.slice(-8)}
              {isRecipient && <span className="ml-1 text-neon-blue">·YOU</span>}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono text-[#666] mb-1">
            <span>Flow</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-black/50 border border-[#222] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-neon-pink to-neon-blue"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Deposit" value={formatUSDT(s.deposit)} />
          <Stat label="Flowed" value={formatUSDT(s.withdrawn)} />
          <Stat label="Claimable" value={formatUSDT(claimable ?? 0n)} active />
        </div>

        {isRecipient && (
          <div className="p-3 border border-neon-blue/30 bg-neon-blue/5 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-neon-blue" />
            <p className="text-[10px] font-mono text-[#888]">Gas covered via 0x801 yield</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {isRecipient && status === 0 && (claimable ?? 0n) > 0n && (
              <>
                <button
                  onClick={() => withdraw(streamId, claimable!)}
                  disabled={withdrawPending || isRelaying}
                  className="flex-1 py-3 border border-[#333] text-[11px] font-mono text-[#888] hover:border-[#444] hover:text-white transition-colors disabled:opacity-50"
                >
                  {withdrawPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Direct
                    </span>
                  ) : (
                    "Direct Claim"
                  )}
                </button>
                <button
                  onClick={() => relayWithdraw(Number(streamId), formatUSDT(claimable!))}
                  disabled={withdrawPending || isRelaying}
                  className="flex-[2] py-3 bg-neon-pink/20 border border-neon-pink text-neon-pink text-[11px] font-mono font-semibold hover:bg-neon-pink/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRelaying ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI…</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Gas-less Claim</>
                  )}
                </button>
              </>
            )}
            {isSender && status === 0 && (
              <button
                onClick={() => cancel(streamId)}
                disabled={cancelPending}
                className="flex-1 py-3 border border-[#333] text-[11px] font-mono text-[#666] hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {cancelPending ? "…" : "Cancel"}
              </button>
            )}
          </div>

          <AnimatePresence>
            {relayerResult && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 border flex items-center gap-2 text-[10px] font-mono ${
                  relayerResult.status === "success" || relayerResult.status === "queued"
                    ? "border-neon-green/30 text-neon-green"
                    : "border-red-500/30 text-red-400"
                }`}
              >
                {relayerResult.status === "success" || relayerResult.status === "queued" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {relayerResult.message}
                {relayerResult.tx_hash && (
                  <span className="text-[9px] opacity-60 truncate">{relayerResult.tx_hash.slice(0, 18)}…</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Visualizer — SVG flow (continuous value)
// ─────────────────────────────────────────────────────────────────────────────

function StreamVisualizer({ rate, progress }: { rate: bigint; progress: number }) {
  const rateFormatted = formatUnits(rate, 6);
  // Scale animation speed with ratePerSecond: higher rate = faster flow
  const rateNum = Number(rate) / 1e6;
  const duration = Math.max(0.4, Math.min(3, 2.5 / (1 + rateNum)));

  return (
    <div className="relative h-24 w-full bg-black/60 border border-[#222] overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 96" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E6007A" />
            <stop offset="100%" stopColor="#0070F3" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 0 48 Q 100 12 200 48 T 400 48"
          fill="transparent"
          stroke="url(#flowGradient)"
          strokeWidth="2"
          strokeDasharray="10 5"
          initial={{ strokeDashoffset: 20 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ repeat: Infinity, duration, ease: "linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-mono text-[#555] uppercase">
          Vesting: {rateFormatted} USDT/sec · speed ×{(1 / duration).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`p-2 border ${active ? "border-neon-pink/40 bg-neon-pink/5" : "border-[#222] bg-black/30"}`}>
      <p className="text-[9px] font-mono text-[#666] uppercase mb-0.5">{label}</p>
      <p className={`text-sm font-mono tabular-nums ${active ? "text-white" : "text-[#888]"}`}>{value}</p>
    </div>
  );
}

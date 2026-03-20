import React, { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
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
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Active Streams</h2>
      <p className="text-sm text-gray-500 mb-6">Next ID: <span className="font-mono text-indigo-600">#{nextId?.toString() ?? "—"}</span></p>

      <div className="flex gap-3 mb-6">
        <input
          type="number"
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          placeholder="Stream ID"
          min="1"
          className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <button
          onClick={handleLookup}
          className="px-5 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Inspect
        </button>
      </div>

      {viewId !== undefined && <StreamCard streamId={viewId} connectedAddress={address} />}

      {!viewId && (
        <div className="py-16 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">Enter a stream ID to inspect</p>
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
        <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
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
          <span className="text-[10px] font-mono text-gray-500">{formatRate(s.ratePerSecond)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-100 border border-gray-200">
            <p className="text-[9px] font-mono text-gray-500 uppercase mb-1">Sender</p>
            <p className="text-[10px] font-mono text-gray-900 break-all">
              {s.sender.slice(0, 10)}…{s.sender.slice(-8)}
              {isSender && <span className="ml-1 text-indigo-600 font-medium">·YOU</span>}
            </p>
          </div>
          <div className="p-3 bg-gray-100 border border-gray-200">
            <p className="text-[9px] font-mono text-gray-500 uppercase mb-1">Recipient</p>
            <p className="text-[10px] font-mono text-gray-900 break-all">
              {s.recipient.slice(0, 10)}…{s.recipient.slice(-8)}
              {isRecipient && <span className="ml-1 text-indigo-600 font-medium">·YOU</span>}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
            <span>Flow</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 border border-gray-200 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Deposit" value={formatUSDT(s.deposit)} />
          <Stat label="Flowed" value={formatUSDT(s.withdrawn)} />
          <Stat label="Claimable" value={formatUSDT(claimable ?? 0n)} active />
        </div>

        {isRecipient && (
          <div className="p-3 border border-indigo-200 bg-indigo-50 rounded-lg flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <p className="text-sm text-gray-700">Gas covered via 0x801 yield</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {isRecipient && status === 0 && (claimable ?? 0n) > 0n && (
              <>
                <button
                  onClick={() => withdraw(streamId, claimable!)}
                  disabled={withdrawPending || isRelaying}
                  className="flex-1 py-3 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
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
                  className="flex-[2] py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                className="flex-1 py-3 border border-gray-200 text-sm text-gray-500 rounded-lg hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
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
                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
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
    <div className="relative h-24 w-full bg-gray-50 border border-gray-200 overflow-hidden">
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
        <span className="text-sm text-gray-500">
          Vesting: {rateFormatted} USDT/sec
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${active ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-[9px] font-mono text-gray-500 uppercase mb-0.5">{label}</p>
      <p className={`text-sm font-mono tabular-nums ${active ? "text-gray-900" : "text-gray-600"}`}>{value}</p>
    </div>
  );
}

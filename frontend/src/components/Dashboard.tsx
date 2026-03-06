import React, { useState } from "react";
import { useAccount } from "wagmi";
import {
  useStreamData,
  useStreamBalance,
  useWithdrawFromStream,
  useCancelStream,
  useNextStreamId,
  formatUSDT,
  formatRate,
  progressPercent,
  streamStatusLabel,
  streamStatusColor,
  type StreamData,
  type StreamStatus,
} from "../hooks/useStream";

/**
 * Dashboard – shows all streams the connected user is involved in.
 * Because the Paseo testnet doesn't index events locally, we let the user
 * enter a stream ID to look it up. In production this would be replaced by
 * an event-indexed subgraph or on-chain enumeration.
 */
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
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Stream Dashboard</h2>
          <p className="text-sm text-[#888]">
            Next stream ID: <span className="text-white font-mono">#{nextId?.toString() ?? "…"}</span>
          </p>
        </div>
      </div>

      {/* Stream Lookup */}
      <div className="flex gap-2 mb-6">
        <input
          type="number"
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          placeholder="Stream ID"
          min="1"
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors"
        />
        <button
          onClick={handleLookup}
          className="px-5 py-2.5 rounded-xl bg-[#E6007A] text-white text-sm font-medium hover:bg-[#CC006A] transition-colors"
        >
          Load
        </button>
      </div>

      {/* Stream Card */}
      {viewId !== undefined && <StreamCard streamId={viewId} connectedAddress={address} />}

      {!viewId && (
        <div className="text-center py-10 text-[#555]">
          <div className="text-4xl mb-3">💫</div>
          <p className="text-sm">Enter a stream ID to view its details</p>
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
  const { cancel,   isPending: cancelPending  } = useCancelStream();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#E6007A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="px-4 py-3 rounded-xl bg-[#1A0A0A] border border-[#3A1A1A]">
        <p className="text-red-400 text-sm">Stream not found or error loading data.</p>
      </div>
    );
  }

  const s = stream as unknown as StreamData;
  const progress = progressPercent(s);
  const isRecipient = connectedAddress?.toLowerCase() === s.recipient.toLowerCase();
  const isSender    = connectedAddress?.toLowerCase() === s.sender.toLowerCase();
  const status      = s.status as StreamStatus;
  const statusLabel = streamStatusLabel(status);
  const statusColor = streamStatusColor(status);

  return (
    <div className="border border-[#2A2A2A] rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-[#888]">#{streamId.toString()}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-[#1A1A1A] ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <span className="text-xs text-[#555]">
          {formatRate(s.ratePerSecond)}
        </span>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="px-3 py-2 rounded-lg bg-[#1A1A1A]">
          <p className="text-[#555] mb-1">Sender</p>
          <p className="font-mono text-[#CCC] truncate">
            {s.sender.slice(0, 6)}…{s.sender.slice(-4)}
            {isSender && <span className="ml-1 text-[#E6007A]">(you)</span>}
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-[#1A1A1A]">
          <p className="text-[#555] mb-1">Recipient</p>
          <p className="font-mono text-[#CCC] truncate">
            {s.recipient.slice(0, 6)}…{s.recipient.slice(-4)}
            {isRecipient && <span className="ml-1 text-[#E6007A]">(you)</span>}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-[#666] mb-1.5">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#1A1A1A] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#E6007A] to-[#FF6B6B] transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat label="Total Deposit" value={`${formatUSDT(s.deposit)} USDT`} />
        <Stat label="Withdrawn"     value={`${formatUSDT(s.withdrawn)} USDT`} />
        <Stat label="Claimable"     value={`${formatUSDT(claimable ?? 0n)} USDT`} highlight />
      </div>

      {/* Subsidy badge */}
      {isRecipient && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A1A0A] border border-[#1A3A1A]">
          <span className="text-xs">⛽</span>
          <span className="text-xs text-[#6A9F6A]">Fee covered by yield pool</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isRecipient && status === 0 && (claimable ?? 0n) > 0n && (
          <button
            onClick={() => withdraw(streamId, claimable!)}
            disabled={withdrawPending}
            className="flex-1 py-2 rounded-lg bg-[#E6007A] text-white text-sm font-medium hover:bg-[#CC006A] transition-colors disabled:opacity-50"
          >
            {withdrawPending ? "Withdrawing…" : `Claim ${formatUSDT(claimable)} USDT`}
          </button>
        )}
        {isSender && status === 0 && (
          <button
            onClick={() => cancel(streamId)}
            disabled={cancelPending}
            className="flex-1 py-2 rounded-lg border border-[#3A1A1A] text-red-400 text-sm hover:bg-[#1A0A0A] transition-colors disabled:opacity-50"
          >
            {cancelPending ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-[#1A1A1A] text-center">
      <p className="text-[#555] text-xs mb-1">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-[#E6007A]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

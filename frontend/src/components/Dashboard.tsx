import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Search, Activity, ArrowUpRight, Clock, ShieldCheck } from "lucide-react";
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
    <div className="glass p-8 rounded-[32px] border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold font-space flex items-center gap-3">
             <Activity className="w-6 h-6 text-primary-pink" />
             Active Stream Dashboard
          </h2>
          <p className="text-sm text-white/40 mt-1 font-inter">
            Next stream on-chain ID: <span className="text-primary-blue font-mono font-bold">#{nextId?.toString() ?? "…"}</span>
          </p>
        </div>
      </div>

      {/* Stream Lookup */}
      <div className="flex gap-3 mb-10">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-white/20 group-focus-within:text-primary-pink transition-colors" />
          </div>
          <input
            type="number"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="Search Stream ID..."
            min="1"
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/20 focus:border-primary-pink/50 focus:bg-white/[0.05] focus:outline-none transition-all"
          />
        </div>
        <button
          onClick={handleLookup}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-pink to-primary-purple text-white text-sm font-bold font-space hover:shadow-glow-pink transition-all active:scale-95"
        >
          Inspect
        </button>
      </div>

      {/* Stream Card */}
      {viewId !== undefined && <StreamCard streamId={viewId} connectedAddress={address} />}

      {!viewId && (
        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-3xl">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="text-5xl mb-6 opacity-20 inline-block"
          >
            🌀
          </motion.div>
          <p className="text-white/40 font-medium uppercase tracking-widest text-xs">Enter a stream ID to view realtime data</p>
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
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-10 h-10 border-4 border-white/5 border-t-primary-pink rounded-full animate-spin shadow-glow-pink" />
        <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Querying Layer...</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
        <p className="text-red-400 text-sm font-bold">Stream resolution failed. Ensure ID exists on Paseo.</p>
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 rounded-[24px] bg-white/[0.02] border border-white/10 space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-white/5 text-sm font-mono font-bold text-primary-pink border border-white/10">#{streamId.toString()}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${statusColor} border border-white/5 shadow-sm`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/40">
           <Clock className="w-3.5 h-3.5" />
           <span className="text-xs font-mono">{formatRate(s.ratePerSecond)}</span>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-3">Sender Node</p>
          <p className="font-mono text-white text-sm break-all flex items-center justify-between">
            {s.sender.slice(0, 12)}…{s.sender.slice(-10)}
            {isSender && <span className="text-[10px] bg-primary-pink text-white px-1.5 py-0.5 rounded ml-2">YOU</span>}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-3">Recipient Node</p>
          <p className="font-mono text-white text-sm break-all flex items-center justify-between">
            {s.recipient.slice(0, 12)}…{s.recipient.slice(-10)}
            {isRecipient && <span className="text-[10px] bg-primary-blue text-white px-1.5 py-0.5 rounded ml-2">YOU</span>}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
             <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Flow Status</p>
             <p className="text-2xl font-bold font-space gradient-text">{progress}%</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-white/20" />
        </div>
        <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full bg-gradient-to-r from-primary-pink via-primary-purple to-primary-blue shadow-glow-pink"
          />
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Initial Deposit" value={formatUSDT(s.deposit)} unit="USDT" />
        <Stat label="Total Flowed"     value={formatUSDT(s.withdrawn)} unit="USDT" />
        <Stat label="Liquid Balance"   value={formatUSDT(claimable ?? 0n)} unit="USDT" active />
      </div>

      {/* Gas Subsidy UI */}
      {isRecipient && (
        <div className="p-4 rounded-2xl bg-primary-blue/5 border border-primary-blue/20 flex items-center gap-4">
           <div className="w-10 h-10 rounded-full bg-primary-blue/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary-blue" />
           </div>
           <div>
              <p className="text-xs font-bold text-white uppercase tracking-tight">Fee Exemption Active</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5 font-medium">Claim costs covered by protocol staking yield</p>
           </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {isRecipient && status === 0 && (claimable ?? 0n) > 0n && (
          <button
            onClick={() => withdraw(streamId, claimable!)}
            disabled={withdrawPending}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-primary-pink to-primary-purple text-white text-lg font-bold font-space hover:shadow-glow-pink transition-all active:scale-95 disabled:opacity-50"
          >
            {withdrawPending ? "Authorizing..." : `Claim ${formatUSDT(claimable)} USDT`}
          </button>
        )}
        {isSender && status === 0 && (
          <button
            onClick={() => cancel(streamId)}
            disabled={cancelPending}
            className="flex-1 py-4 rounded-2xl border border-white/10 text-white/60 text-lg font-bold font-space hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
          >
            {cancelPending ? "Terminating..." : "Cancel Flow"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  unit,
  active,
}: {
  label: string;
  value: string;
  unit?: string;
  active?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border transition-all ${active ? 'bg-primary-pink/5 border-primary-pink/30 shadow-glow-pink' : 'bg-white/5 border-white/5'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-xl font-bold font-space ${active ? 'text-white' : 'text-white/80'}`}>{value}</p>
        <span className="text-[10px] font-mono text-white/20 uppercase">{unit}</span>
      </div>
    </div>
  );
}

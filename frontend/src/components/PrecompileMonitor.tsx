import React from "react";
import { motion } from "framer-motion";

export type PrecompileTarget = "0x800" | "0x801" | "0x802";

export interface PrecompileLog {
  id: string;
  method: string;
  target: PrecompileTarget;
  payload: string;
  timestamp: number;
}

interface PrecompileMonitorProps {
  logs: PrecompileLog[];
  maxLogs?: number;
}

const TARGET_LABELS: Record<PrecompileTarget, string> = {
  "0x800": "XCM",
  "0x801": "Staking",
  "0x802": "Assets",
};

export function PrecompileMonitor({ logs, maxLogs = 12 }: PrecompileMonitorProps) {
  const displayLogs = logs.slice(-maxLogs).reverse();

  return (
    <div className="terminal-card p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-3 border-b border-[#222] pb-2">
        <span className="text-[10px] font-mono font-semibold text-neon-pink uppercase tracking-widest">
          Precompile Feed
        </span>
        <span className="text-[9px] font-mono text-[#666]">
          PVM · SCALE-encoded
        </span>
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-none">
        {displayLogs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
              No precompile calls yet
            </p>
            <p className="text-[9px] font-mono text-[#333] mt-1">
              Bridge or stream activity will appear here
            </p>
          </div>
        ) : (
          displayLogs.map((log) => (
            <PrecompileLogRow key={log.id} log={log} />
          ))
        )}
      </div>
    </div>
  );
}

function PrecompileLogRow({ log }: { log: PrecompileLog }) {
  const targetLabel = TARGET_LABELS[log.target];
  const borderColor =
    log.target === "0x800"
      ? "border-l-neon-blue"
      : log.target === "0x801"
        ? "border-l-neon-pink"
        : "border-l-neon-green";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`bg-black/50 p-3 border-l-2 ${borderColor} font-mono text-[10px]`}
    >
      <div className="flex justify-between text-neon-pink mb-1.5">
        <span>EXECUTE: {log.method}</span>
        <span>TARGET: {log.target}</span>
      </div>
      <div className="text-[#888] break-all leading-relaxed">
        {log.payload}
      </div>
    </motion.div>
  );
}

/** Simulate SCALE encoding for display (mirrors bridge helpers) */
export function mockScalePayload(
  method: "createStream" | "bridgeToParachain" | "transfer" | "xcmSend",
  params: Record<string, unknown>
): string {
  const base = "0x03"; // V3
  const parts: string[] = [base];
  if (method === "createStream") {
    parts.push("04", "01", "01", "00"); // compact, interior
    parts.push(
      (params.recipient as string)?.slice(2, 10) ?? "00000000",
      "…",
      (params.deposit as string) ?? "0"
    );
  } else if (method === "bridgeToParachain") {
    parts.push("01", "01", "00", (params.destParaId as number)?.toString(16).padStart(2, "0") ?? "00");
    parts.push("04", "32", "05"); // GeneralIndex, compact
  } else if (method === "transfer") {
    parts.push("01", "01", "05"); // GeneralIndex
    parts.push((params.assetId as number)?.toString(16) ?? "7c0"); // 1984
  } else {
    parts.push("01", "01", "00", "…");
  }
  return parts.join("") + JSON.stringify(params).slice(0, 24) + "…";
}

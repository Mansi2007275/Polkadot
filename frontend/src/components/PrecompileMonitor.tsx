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
    <div className="p-5 rounded-2xl border-4 border-black bg-white shadow-xl ring-2 ring-pink-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Precompile Feed</h3>
        <span className="text-xs text-gray-500">PVM</span>
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {displayLogs.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">No precompile calls yet</p>
            <p className="text-xs text-gray-400 mt-1">Bridge or stream activity will appear here</p>
          </div>
        ) : (
          displayLogs.map((log) => <PrecompileLogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}

function PrecompileLogRow({ log }: { log: PrecompileLog }) {
  const borderColor =
    log.target === "0x800" ? "border-l-indigo-500" :
    log.target === "0x801" ? "border-l-violet-500" :
    "border-l-emerald-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`bg-gray-50 p-3 rounded-r border-l-2 ${borderColor} text-sm`}
    >
      <div className="flex justify-between text-gray-700 font-medium mb-1">
        <span>{log.method}</span>
        <span className="font-mono text-xs">{log.target}</span>
      </div>
      <div className="font-mono text-xs text-gray-600 break-all">{log.payload}</div>
    </motion.div>
  );
}

export function mockScalePayload(
  method: "createStream" | "bridgeToParachain" | "transfer" | "xcmSend",
  params: Record<string, unknown>
): string {
  const base = "0x03";
  const parts: string[] = [base];
  if (method === "createStream") {
    parts.push("04", "01", "01", "00");
    parts.push(
      (params.recipient as string)?.slice(2, 10) ?? "00000000",
      "…",
      (params.deposit as string) ?? "0"
    );
  } else if (method === "bridgeToParachain") {
    parts.push("01", "01", "00", (params.destParaId as number)?.toString(16).padStart(2, "0") ?? "00");
    parts.push("04", "32", "05");
  } else if (method === "transfer") {
    parts.push("01", "01", "05");
    parts.push((params.assetId as number)?.toString(16) ?? "7c0");
  } else {
    parts.push("01", "01", "00", "…");
  }
  return parts.join("") + JSON.stringify(params).slice(0, 24) + "…";
}

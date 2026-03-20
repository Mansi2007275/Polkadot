import React, { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, parseAbiItem } from "viem";
import { CONTRACT_ADDRESSES, STREAM_ABI } from "../config/contracts";
import { paseo } from "../config/wagmi";
import { formatUSDT } from "../hooks/useStream";
import { motion } from "framer-motion";
import {
  FileText,
  PlusCircle,
  ArrowDownCircle,
  XCircle,
  History,
  ExternalLink,
  ShieldCheck,
  Cpu,
  AlertCircle
} from "lucide-react";

type TxRecord = {
  hash: `0x${string}`;
  type: "StreamCreated" | "StreamWithdrawn" | "StreamCancelled" | "BridgeOut";
  streamId?: bigint;
  amount?: bigint;
  gasSubsidised?: boolean;
  blockNumber: bigint;
  timestamp?: number;
};

export default function TransactionHistory() {
  const { address } = useAccount();
  const chainId     = useChainId();
  const networkKey  = chainId === 420420421 ? "paseo" : "hardhat";
  const streamAddress = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;
  const bridgeAddress = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;

  const { data: events, isLoading, error } = useQuery({
    queryKey: ["txHistory", address, networkKey],
    enabled: !!address && !!(streamAddress && bridgeAddress),
    staleTime: 30_000,
    queryFn: async (): Promise<TxRecord[]> => {
      const client = createPublicClient({
        chain: networkKey === "paseo" ? paseo : undefined,
        transport: http(
          networkKey === "paseo"
            ? (import.meta.env.VITE_PASEO_RPC_URL || "https://paseo.rpc.polkadot.com")
            : (import.meta.env.VITE_HARDHAT_RPC_URL || "http://127.0.0.1:8545")
        ),
      });

      const latest = await client.getBlockNumber();
      const fromBlock = latest > 10000n ? latest - 10000n : 0n;

      const [created, withdrawn, cancelled, bridgeOut] = await Promise.all([
        client.getLogs({
          address: streamAddress!,
          event: parseAbiItem(
            "event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, address token, uint256 deposit, uint256 startTime, uint256 stopTime, uint256 ratePerSecond)"
          ),
          args: { sender: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
        client.getLogs({
          address: streamAddress!,
          event: parseAbiItem(
            "event StreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount, bool gasSubsidised)"
          ),
          args: { recipient: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
        client.getLogs({
          address: streamAddress!,
          event: parseAbiItem(
            "event StreamCancelled(uint256 indexed streamId, address indexed sender, uint256 senderRefund, uint256 recipientAmount)"
          ),
          args: { sender: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
        client.getLogs({
          address: bridgeAddress!,
          event: parseAbiItem(
            "event BridgeOutInitiated(address indexed token, address indexed sender, uint32 destParaId, bytes32 beneficiary, uint256 amount)"
          ),
          args: { sender: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
      ]);

      const records: TxRecord[] = [];

      for (const log of created) {
        records.push({
          hash: log.transactionHash!,
          type: "StreamCreated",
          streamId: (log.args as any).streamId,
          amount: (log.args as any).deposit,
          blockNumber: log.blockNumber!,
        });
      }

      for (const log of withdrawn) {
        records.push({
          hash: log.transactionHash!,
          type: "StreamWithdrawn",
          streamId: (log.args as any).streamId,
          amount: (log.args as any).amount,
          gasSubsidised: (log.args as any).gasSubsidised,
          blockNumber: log.blockNumber!,
        });
      }

      for (const log of cancelled) {
        records.push({
          hash: log.transactionHash!,
          type: "StreamCancelled",
          streamId: (log.args as any).streamId,
          amount: (log.args as any).senderRefund,
          blockNumber: log.blockNumber!,
        });
      }

      for (const log of bridgeOut) {
        records.push({
          hash: log.transactionHash!,
          type: "BridgeOut",
          amount: (log.args as any).amount,
          blockNumber: log.blockNumber!,
        });
      }

      return records.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
    },
  });

  if (!address) return null;

  return (
    <div className="terminal-card p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
           <History className="w-5 h-5 text-indigo-600" />
           Protocol Activity
        </h2>
        <p className="text-sm text-gray-500 mt-1">On-chain events from Paseo</p>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      )}

      {error && (
        <div className="p-6  bg-red-500/5 border border-red-500/20 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 text-sm font-semibold">Sync failed</p>
          <p className="text-gray-600 text-sm mt-1">{(error as Error).message}</p>
        </div>
      )}

      {events && events.length === 0 && !isLoading && (
        <div className="text-center py-20 bg-gray-100 border border-dashed border-gray-200 ">
          <FileText className="w-12 h-12 text-gray-900/10 mx-auto mb-4" />
          <p className="text-sm text-gray-500">No activity yet</p>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="space-y-4">
          {events.map((tx, i) => (
            <TxRow key={`${tx.hash}-${i}`} tx={tx} chainId={chainId} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TxRow({ tx, chainId, index }: { tx: TxRecord; chainId: number; index: number }) {
  const explorerBase =
    chainId === 420420421
      ? "https://blockscout.paseo.polkadot.com/tx"
      : "#";

  const typeConfig = {
    StreamCreated:   { icon: <PlusCircle className="w-5 h-5" />, label: "Flow Initialized",   color: "text-blue-400", bg: "bg-blue-400/10"  },
    StreamWithdrawn: { icon: <ArrowDownCircle className="w-5 h-5" />, label: "Value Extracted",   color: "text-green-400", bg: "bg-green-400/10" },
    StreamCancelled: { icon: <XCircle className="w-5 h-5" />, label: "Flow Terminated", color: "text-red-400", bg: "bg-red-400/10"   },
    BridgeOut:       { icon: <Cpu className="w-5 h-5" />, label: "Cross-Chain Sync", color: "text-purple-400", bg: "bg-purple-400/10"},
  }[tx.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all"
    >
      <div className={`w-12 h-12 rounded-xl ${typeConfig.bg} flex items-center justify-center ${typeConfig.color} shadow-sm transition-transform group-hover:scale-110`}>
        {typeConfig.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span className={`text-sm font-bold font-space uppercase tracking-tight ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {tx.streamId !== undefined && (
            <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-600">
              STREAM-ID: {tx.streamId.toString()}
            </span>
          )}
          {tx.type === "StreamWithdrawn" && tx.gasSubsidised && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 text-xs font-medium text-indigo-700">
              <ShieldCheck className="w-3 h-3" />
              Gas Substituted
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Block: {tx.blockNumber.toString()}</span>
          <span className="opacity-50">·</span>
          <span className="hover:text-gray-600 transition-colors cursor-help">{tx.hash.slice(0, 14)}…{tx.hash.slice(-10)}</span>
        </div>
      </div>

      <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 flex-shrink-0">
        {tx.amount !== undefined && (
          <p className="text-base font-semibold text-gray-900">
            {formatUSDT(tx.amount)} <span className="text-xs text-gray-500 font-normal">USDT</span>
          </p>
        )}
        <a
          href={`${explorerBase}/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
        >
          Signature
          <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
        </a>
      </div>
    </motion.div>
  );
}

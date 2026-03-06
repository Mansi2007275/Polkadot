import React, { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, parseAbiItem } from "viem";
import { CONTRACT_ADDRESSES, STREAM_ABI } from "../config/contracts";
import { paseo } from "../config/wagmi";
import { formatUSDT } from "../hooks/useStream";

type TxRecord = {
  hash: `0x${string}`;
  type: "StreamCreated" | "StreamWithdrawn" | "StreamCancelled" | "BridgeOut";
  streamId?: bigint;
  amount?: bigint;
  gasSubsidised?: boolean;
  blockNumber: bigint;
  timestamp?: number;
};

/**
 * TransactionHistory – fetches and renders a user's recent stream events
 * directly from the chain using viem's getLogs API.
 * Shows a "Fee covered by yield pool" badge on subsidised withdrawals.
 */
export default function TransactionHistory() {
  const { address } = useAccount();
  const chainId     = useChainId();
  const networkKey  = chainId === 420420421 ? "paseo" : "hardhat";
  const streamAddress = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const { data: events, isLoading, error } = useQuery({
    queryKey: ["txHistory", address, networkKey],
    enabled: !!address && !!streamAddress,
    staleTime: 30_000,
    queryFn: async (): Promise<TxRecord[]> => {
      const client = createPublicClient({
        chain: paseo,
        transport: http(),
      });

      const latest = await client.getBlockNumber();
      const fromBlock = latest > 10000n ? latest - 10000n : 0n;

      // Fetch all three event types in parallel
      const [created, withdrawn, cancelled] = await Promise.all([
        client.getLogs({
          address: streamAddress,
          event: parseAbiItem(
            "event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, address token, uint256 deposit, uint256 startTime, uint256 stopTime, uint256 ratePerSecond)"
          ),
          args: { sender: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
        client.getLogs({
          address: streamAddress,
          event: parseAbiItem(
            "event StreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount, bool gasSubsidised)"
          ),
          args: { recipient: address },
          fromBlock,
          toBlock: "latest",
        }).catch(() => []),
        client.getLogs({
          address: streamAddress,
          event: parseAbiItem(
            "event StreamCancelled(uint256 indexed streamId, address indexed sender, uint256 senderRefund, uint256 recipientAmount)"
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

      // Sort descending by block number
      return records.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
    },
  });

  if (!address) return null;

  return (
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-1">Transaction History</h2>
      <p className="text-sm text-[#888] mb-6">
        Your recent stream activity. Subsidised transactions are marked{" "}
        <span className="text-green-400">⛽ Fee covered by yield pool</span>.
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#E6007A] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-[#1A0A0A] border border-[#3A1A1A]">
          <p className="text-red-400 text-sm">
            Could not fetch events: {(error as Error).message}
          </p>
        </div>
      )}

      {events && events.length === 0 && !isLoading && (
        <div className="text-center py-12 text-[#555]">
          <div className="text-4xl mb-3">📜</div>
          <p className="text-sm">No transactions found in the last 10,000 blocks</p>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="space-y-3">
          {events.map((tx, i) => (
            <TxRow key={`${tx.hash}-${i}`} tx={tx} chainId={chainId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TxRow({ tx, chainId }: { tx: TxRecord; chainId: number }) {
  const explorerBase =
    chainId === 420420421
      ? "https://blockscout.paseo.polkadot.com/tx"
      : "#";

  const typeConfig = {
    StreamCreated:   { icon: "💫", label: "Stream Created",   color: "text-blue-400"  },
    StreamWithdrawn: { icon: "💸", label: "Withdrawn",        color: "text-green-400" },
    StreamCancelled: { icon: "❌", label: "Stream Cancelled", color: "text-red-400"   },
    BridgeOut:       { icon: "🌉", label: "Bridge Out",       color: "text-purple-400"},
  }[tx.type];

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors">
      <div className="text-2xl">{typeConfig.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {tx.streamId !== undefined && (
            <span className="text-xs text-[#555] font-mono">
              #{tx.streamId.toString()}
            </span>
          )}
          {tx.type === "StreamWithdrawn" && tx.gasSubsidised && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
              ⛽ Fee covered by yield pool
            </span>
          )}
        </div>
        <p className="text-xs text-[#555] font-mono mt-0.5">
          Block #{tx.blockNumber.toString()} ·{" "}
          {tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        {tx.amount !== undefined && (
          <p className="text-sm font-medium text-white">
            {formatUSDT(tx.amount)} USDT
          </p>
        )}
        <a
          href={`${explorerBase}/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#555] hover:text-[#E6007A] transition-colors"
        >
          View →
        </a>
      </div>
    </div>
  );
}

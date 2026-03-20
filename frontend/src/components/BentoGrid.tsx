import React from "react";
import { useReadContract, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, BRIDGE_ABI, STREAM_ABI } from "../config/contracts";
import { useLiveBlockNumber } from "../hooks/useBlockNumber";
import { YieldFlowSvg } from "./YieldFlowSvg";

export function BentoGrid() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";

  const subsidyAddr = CONTRACT_ADDRESSES[networkKey]?.SubsidyPool;
  const bridgeAddr = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;
  const streamAddr = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const { data: currentApyBps } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "currentApyBps",
    query: { refetchInterval: 15_000 },
  });

  const { data: stakingStats } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "getStakingStats",
    query: { refetchInterval: 15_000 },
  });

  const { data: nextStreamId } = useReadContract({
    address: streamAddr,
    abi: STREAM_ABI,
    functionName: "nextStreamId",
    query: { refetchInterval: 10_000 },
  });

  const { data: totalBridgedOut } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "totalBridgedOut",
    args: [CONTRACT_ADDRESSES[networkKey]?.USDT ?? "0x0"],
    query: { refetchInterval: 15_000 },
  });

  const apy = currentApyBps ? Number(currentApyBps) / 100 : 5;
  const stats = stakingStats as [bigint, bigint, bigint, bigint] | undefined;
  const stakedDot = stats ? formatUnits(stats[1], 18) : "0";
  const activeStreams = nextStreamId ? Number(nextStreamId) - 1 : 0;
  const bridgedUsdt = totalBridgedOut ? (Number(totalBridgedOut) / 1e6).toFixed(2) : "0";
  const blockNumber = useLiveBlockNumber();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="terminal-card p-6">
        <p className="text-xs font-medium text-gray-500 mb-1">Staking (0x801)</p>
        <p className="text-2xl font-semibold text-gray-900">{apy.toFixed(2)}% APY</p>
        <p className="text-sm text-gray-500 mt-1">Bonded: {Number(stakedDot).toFixed(4)} DOT</p>
        <YieldFlowSvg className="mt-4" />
      </div>

      <div className="terminal-card p-6">
        <p className="text-xs font-medium text-gray-500 mb-1">Micropayment Streams</p>
        <p className="text-2xl font-semibold text-gray-900">{activeStreams} active</p>
        <p className="text-sm text-gray-500 mt-1">Sablier-variant · REVM</p>
      </div>

      <div className="terminal-card p-6">
        <p className="text-xs font-medium text-gray-500 mb-1">XCM Bridge (0x800)</p>
        <p className="text-2xl font-semibold text-gray-900">{bridgedUsdt} USDT</p>
        <p className="text-sm text-gray-500 mt-1">Total bridged out</p>
      </div>

      <div className="md:col-span-3 terminal-card px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">Paseo Block</p>
        <p className="text-base font-mono font-medium text-gray-900 tabular-nums">
          {blockNumber?.toLocaleString() ?? "—"}
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { useReadContract, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, BRIDGE_ABI, STREAM_ABI } from "../config/contracts";
import { useLiveBlockNumber } from "../hooks/useBlockNumber";
import { YieldFlowSvg } from "./YieldFlowSvg";

/** Bento grid: Live network stats visible with or without wallet */
export function BentoGrid() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const blockNumber = useLiveBlockNumber();

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
      {/* Col 1: Live Staking Yield (0x801) */}
      <div className="terminal-card p-5">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
            Staking 0x801
          </span>
          <span className="text-[9px] font-mono text-neon-green">LIVE</span>
        </div>
        <p className="text-2xl font-mono font-semibold text-white mb-1">
          {apy.toFixed(2)}% <span className="text-[10px] text-[#666]">APY</span>
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          Bonded: {Number(stakedDot).toFixed(4)} DOT
        </p>
        <YieldFlowSvg className="mt-4" />
      </div>

      {/* Col 2: Active Streams */}
      <div className="terminal-card p-5">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
            Micropayment Streams
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-white mb-1">
          {activeStreams} <span className="text-[10px] text-[#666]">active</span>
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          Sablier-variant · REVM
        </p>
      </div>

      {/* Col 3: XCM Bridge Throughput */}
      <div className="terminal-card p-5">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
            XCM 0x800
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-white mb-1">
          {bridgedUsdt} <span className="text-[10px] text-[#666]">USDT</span>
        </p>
        <p className="text-[10px] font-mono text-[#666]">
          Total bridged out
        </p>
      </div>

      {/* Block height bar */}
      <div className="md:col-span-3 terminal-card px-5 py-3 flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
          Paseo · Block
        </span>
        <span className="text-sm font-mono text-white tabular-nums">
          {blockNumber?.toLocaleString() ?? "—"}
        </span>
      </div>
    </div>
  );
}

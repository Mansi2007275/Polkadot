import React from "react";
import { useReadContract, useChainId } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, BRIDGE_ABI, STREAM_ABI } from "../config/contracts";
import { DEMO_DATA, DEMO_STREAM_ID } from "../config/demoData";
import { useLiveBlockNumber } from "../hooks/useBlockNumber";
import { YieldFlowSvg } from "./YieldFlowSvg";

const getDemoMode = () => (window as any).__DEMO_MODE__ === true;

export function BentoGrid() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";

  const subsidyAddr = CONTRACT_ADDRESSES[networkKey]?.SubsidyPool;
  const bridgeAddr = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;
  const streamAddr = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const { data: currentApyBpsRaw } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "currentApyBps",
    query: { refetchInterval: 15_000 },
  });
  const currentApyBps = getDemoMode() ? DEMO_DATA.pool.currentApyBps : currentApyBpsRaw;

  const { data: stakingStatsRaw } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "getStakingStats",
    query: { refetchInterval: 15_000 },
  });
  const stakingStats = getDemoMode() ? DEMO_DATA.staking : stakingStatsRaw;

  const { data: nextStreamIdRaw } = useReadContract({
    address: streamAddr,
    abi: STREAM_ABI,
    functionName: "nextStreamId",
    query: { refetchInterval: 10_000 },
  });
  const nextStreamId = getDemoMode() ? (DEMO_STREAM_ID + 1n) : nextStreamIdRaw;

  const { data: totalBridgedOutRaw } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "totalBridgedOut",
    args: [CONTRACT_ADDRESSES[networkKey]?.USDT ?? "0x0"],
    query: { refetchInterval: 15_000 },
  });
  const totalBridgedOut = getDemoMode() ? parseUnits("12500", 6) : totalBridgedOutRaw;

  const apy = currentApyBps ? Number(currentApyBps) / 100 : 5;
  const stats = stakingStats as [bigint, bigint, bigint, bigint] | undefined;
  const stakedDot = stats ? formatUnits(stats[1], 18) : "0";
  const activeStreams = nextStreamId ? Number(nextStreamId) - 1 : 0;
  const bridgedUsdt = totalBridgedOut ? (Number(totalBridgedOut) / 1e6).toFixed(2) : "0";
  const blockNumber = useLiveBlockNumber();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-6 rounded-2xl border-4 border-black bg-white shadow-xl">
        <p className="text-xs font-bold text-black mb-1">Staking (0x801)</p>
        <p className="text-2xl font-extrabold text-black">{apy.toFixed(2)}% APY</p>
        <p className="text-sm text-pink-400 mt-1">Bonded: {Number(stakedDot).toFixed(4)} DOT</p>
        <YieldFlowSvg className="mt-4" />
      </div>

      <div className="p-6 rounded-2xl border-4 border-black bg-white shadow-xl">
        <p className="text-xs font-bold text-pink-500 mb-1">Micropayment Streams</p>
        <p className="text-2xl font-extrabold text-black">{activeStreams} active</p>
        <p className="text-sm text-pink-400 mt-1">Sablier-variant · REVM</p>
      </div>

      <div className="p-6 rounded-2xl border-4 border-black bg-white shadow-xl">
        <p className="text-xs font-bold text-pink-500 mb-1">XCM Bridge (0x800)</p>
        <p className="text-2xl font-extrabold text-black">{bridgedUsdt} USDT</p>
        <p className="text-sm text-pink-400 mt-1">Total bridged out</p>
      </div>

      <div className="md:col-span-3 px-6 py-4 flex items-center justify-between rounded-2xl border-4 border-black bg-white shadow-xl mt-2">
        <p className="text-sm font-bold text-pink-500">Paseo Block</p>
        <p className="text-base font-mono font-extrabold text-pink-600 tabular-nums">
          {blockNumber?.toLocaleString() ?? "—"}
        </p>
      </div>
    </div>
  );
}

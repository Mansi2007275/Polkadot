import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import { useCallback, useState } from "react";
import { CONTRACT_ADDRESSES, STREAM_ABI, ERC20_ABI } from "../config/contracts";
import { DEMO_DATA, DEMO_STREAM_ID } from "../config/demoData";

const getDemoMode = () => (window as any).__DEMO_MODE__ === true;


// ─── Types ───────────────────────────────────────────────────────────────────

export type StreamStatus = 0 | 1 | 2 | 3; // Active, Paused, Cancelled, Exhausted

export interface StreamData {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
  deposit: bigint;
  ratePerSecond: bigint;
  startTime: bigint;
  stopTime: bigint;
  withdrawn: bigint;
  status: StreamStatus;
}

// ─── Hook: useStreamBalance ───────────────────────────────────────────────

export function useStreamBalance(streamId: bigint | undefined) {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const result = useReadContract({
    address,
    abi: STREAM_ABI,
    functionName: "balanceOf",
    args: streamId !== undefined ? [streamId] : undefined,
    query: {
      enabled: streamId !== undefined,
      refetchInterval: 5_000, 
    },
  });

  if (getDemoMode() && streamId === DEMO_STREAM_ID) {
    // Return a slightly fluctuating balance for the demo stream
    const elapsed = BigInt(Math.floor(Date.now() / 1000) - Number(DEMO_DATA.stream.startTime));
    const balance = elapsed * DEMO_DATA.stream.ratePerSecond;
    return { ...result, data: balance, isLoading: false, isError: false, status: "success" };
  }

  return result;
}

// ─── Hook: useStreamData ─────────────────────────────────────────────────

export function useStreamData(streamId: bigint | undefined) {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const result = useReadContract({
    address,
    abi: STREAM_ABI,
    functionName: "getStream",
    args: streamId !== undefined ? [streamId] : undefined,
    query: { enabled: streamId !== undefined },
  });

  if (getDemoMode() && (streamId === DEMO_STREAM_ID || streamId === 1n)) {
    return { ...result, data: DEMO_DATA.stream, isLoading: false, isError: false, status: "success" };
  }

  return result;
}

// ─── Hook: useNextStreamId ────────────────────────────────────────────────

export function useNextStreamId() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const result = useReadContract({
    address,
    abi: STREAM_ABI,
    functionName: "nextStreamId",
    query: { refetchInterval: 10_000 },
  });

  if (getDemoMode()) {
    return { ...result, data: DEMO_STREAM_ID + 1n, isLoading: false, isError: false, status: "success" };
  }

  return result;
}

// ─── Hook: useCreateStream ────────────────────────────────────────────────

export function useCreateStream() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const streamAddress = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;
  const usdtAddress   = CONTRACT_ADDRESSES[networkKey]?.USDT;

  const { writeContract: approveWrite, data: approveTxHash } = useWriteContract();
  const { writeContract: createWrite,  data: createTxHash  } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isCreating  } = useWaitForTransactionReceipt({ hash: createTxHash  });

  const createStream = useCallback(
    async (params: {
      recipient: `0x${string}`;
      depositUsdt: string;   // human-readable USDT amount (6 decimals)
      durationSeconds: bigint;
    }) => {
      const deposit = parseUnits(params.depositUsdt, 6);
      const now = BigInt(Math.floor(Date.now() / 1000));
      const startTime = now + 30n;          // 30-second buffer
      const stopTime  = startTime + params.durationSeconds;

      // 1. Approve USDT spend
      approveWrite({
        address: usdtAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [streamAddress, deposit],
      });
    },
    [approveWrite, streamAddress, usdtAddress]
  );

  const submitCreate = useCallback(
    (params: {
      recipient: `0x${string}`;
      depositUsdt: string;
      durationSeconds: bigint;
    }) => {
      const deposit = parseUnits(params.depositUsdt, 6);
      const now = BigInt(Math.floor(Date.now() / 1000));
      const startTime = now + 30n;
      const stopTime  = startTime + params.durationSeconds;

      createWrite({
        address: streamAddress,
        abi: STREAM_ABI,
        functionName: "createStream",
        args: [params.recipient, deposit, usdtAddress, startTime, stopTime],
      });
    },
    [createWrite, streamAddress, usdtAddress]
  );

  return {
    approve: createStream,
    createStream: submitCreate,
    approveTxHash,
    createTxHash,
    isApproving,
    isCreating,
  };
}

// ─── Hook: useWithdrawFromStream ──────────────────────────────────────────

export function useWithdrawFromStream() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const withdraw = useCallback(
    (streamId: bigint, amount: bigint) => {
      writeContract({
        address,
        abi: STREAM_ABI,
        functionName: "withdrawFromStream",
        args: [streamId, amount],
      });
    },
    [writeContract, address]
  );

  return { withdraw, txHash, isPending, isConfirming };
}

// ─── Hook: useRelayerWithdraw (AI Agentic Relayer) ─────────────────────────

export function useRelayerWithdraw() {
  const [isRelaying, setIsRelaying] = useState(false);
  const [relayerResult, setRelayerResult] = useState<any>(null);

  const relayWithdraw = useCallback(async (streamId: bigint | number, amount: string) => {
    setIsRelaying(true);
    setRelayerResult(null);
    try {
      const response = await fetch("http://localhost:8000/relay/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: Number(streamId),
          amount,
        }),
      });
      const data = await response.json();
      setRelayerResult({
        status: data.status,
        message: data.message || (data.status === 'success' ? 'Relay transaction successful' : 'Relay request processed'),
        tx_hash: data.tx_hash
      });
    } catch (err) {
      console.error("Relayer error:", err);
      setRelayerResult({ 
        status: 'error', 
        message: "Relayer connection failed. The AI Agent is currently unreachable. Direct claim is still active." 
      });
    } finally {
      setIsRelaying(false);
    }
  }, []);

  return { relayWithdraw, isRelaying, relayerResult };
}

// ─── Hook: useCancelStream ────────────────────────────────────────────────

export function useCancelStream() {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.MicropaymentStream;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const cancel = useCallback(
    (streamId: bigint) => {
      writeContract({
        address,
        abi: STREAM_ABI,
        functionName: "cancelStream",
        args: [streamId],
      });
    },
    [writeContract, address]
  );

  return { cancel, txHash, isPending, isConfirming };
}

// ─── Hook: useUSDTBalance ─────────────────────────────────────────────────

export function useUSDTBalance(account: `0x${string}` | undefined) {
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";
  const address = CONTRACT_ADDRESSES[networkKey]?.USDT;

  return useReadContract({
    address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: {
      enabled: !!account,
      refetchInterval: 15_000,
    },
  });
}

// ─── Utility: format live streaming balance ───────────────────────────────

export function formatUSDT(value: bigint | undefined): string {
  if (value === undefined) return "0.000000";
  const str = value.toString().padStart(7, "0");
  const int = str.slice(0, -6) || "0";
  const dec = str.slice(-6);
  return `${int}.${dec}`;
}

export function formatRate(ratePerSecond: bigint): string {
  // Convert tokens-per-second into tokens-per-day for display
  const perDay = ratePerSecond * 86400n;
  return formatUSDT(perDay) + " USDT/day";
}

export function streamStatusLabel(status: StreamStatus): string {
  const labels = ["Active", "Paused", "Cancelled", "Exhausted"];
  return labels[status] ?? "Unknown";
}

export function streamStatusColor(status: StreamStatus): string {
  const colors = [
    "text-green-400",
    "text-yellow-400",
    "text-red-400",
    "text-gray-400",
  ];
  return colors[status] ?? "text-gray-400";
}

export function progressPercent(stream: StreamData): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now <= stream.startTime) return 0;
  if (now >= stream.stopTime) return 100;
  const elapsed  = now - stream.startTime;
  const duration = stream.stopTime - stream.startTime;
  return Number((elapsed * 100n) / duration);
}

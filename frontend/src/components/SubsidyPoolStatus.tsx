import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, ERC20_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";

/**
 * SubsidyPoolStatus – displays pool metrics and lets users deposit / withdraw
 * to earn a share of protocol yield.
 */
export default function SubsidyPoolStatus() {
  const { address } = useAccount();
  const chainId     = useChainId();
  const networkKey  = chainId === 420420421 ? "paseo" : "hardhat";

  const subsidyAddr = CONTRACT_ADDRESSES[networkKey]?.SubsidyPool;
  const usdtAddr    = CONTRACT_ADDRESSES[networkKey]?.USDT;

  const [depositAmt, setDepositAmt]   = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  // ── Read ──────────────────────────────────────────────────────────────────

  const { data: poolBalance } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "poolBalance",
    query: { refetchInterval: 10_000 },
  });

  const { data: totalSubsidised } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "totalSubsidisedTxns",
    query: { refetchInterval: 10_000 },
  });

  const { data: totalGas } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "totalGasCovered",
    query: { refetchInterval: 10_000 },
  });

  const { data: totalDeposited } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "totalDeposited",
    query: { refetchInterval: 10_000 },
  });

  const { data: yieldBps } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "BASE_YIELD_BPS",
  });

  const { data: myDeposit } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "depositors",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: pendingYield } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "pendingYield",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: shareBps } = useReadContract({
    address: subsidyAddr,
    abi: SUBSIDY_ABI,
    functionName: "depositorShareBps",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  // ── Write ─────────────────────────────────────────────────────────────────

  const { writeContract: approveWrite, data: approveTx } = useWriteContract();
  const { writeContract: depositWrite, data: depositTx  } = useWriteContract();
  const { writeContract: withdrawWrite, data: withdrawTx } = useWriteContract();
  const { writeContract: claimWrite,   data: claimTx    } = useWriteContract();

  const { isLoading: approving  } = useWaitForTransactionReceipt({ hash: approveTx  });
  const { isLoading: depositing } = useWaitForTransactionReceipt({ hash: depositTx  });
  const { isLoading: withdrawing} = useWaitForTransactionReceipt({ hash: withdrawTx });
  const { isLoading: claiming   } = useWaitForTransactionReceipt({ hash: claimTx    });

  const handleDeposit = () => {
    if (!depositAmt) return;
    const amount = parseUnits(depositAmt, 6);
    approveWrite({ address: usdtAddr, abi: ERC20_ABI, functionName: "approve", args: [subsidyAddr, amount] });
    // Note: in a full app, deposit would be triggered after approval is confirmed
    depositWrite({ address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "deposit", args: [amount] });
  };

  const handleWithdraw = () => {
    if (!withdrawAmt || !myDeposit) return;
    const shares = parseUnits(withdrawAmt, 6);
    withdrawWrite({ address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "withdraw", args: [shares] });
  };

  const handleClaimYield = () => {
    claimWrite({ address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "claimYield", args: [] });
  };

  const apy = yieldBps ? Number(yieldBps) / 100 : 5;

  return (
    <div className="space-y-6">
      {/* ── Pool Stats ── */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-1">Subsidy Pool</h2>
        <p className="text-sm text-[#888] mb-6">
          Earn {apy}% APY from protocol yield, staking rewards & ad revenue.
          Your deposit covers gas for all stream withdrawals.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <PoolStat
            label="Pool Balance"
            value={`${formatUSDT(poolBalance as bigint | undefined)} USDT`}
          />
          <PoolStat
            label="Total Deposited"
            value={`${formatUSDT(totalDeposited as bigint | undefined)} USDT`}
          />
          <PoolStat
            label="Txns Subsidised"
            value={(totalSubsidised as bigint | undefined)?.toString() ?? "0"}
            highlight
          />
          <PoolStat
            label="Base APY"
            value={`${apy}%`}
            highlight
          />
        </div>

        {/* Gas covered metric */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0A1A0A] border border-[#1A3A1A]">
          <span className="text-2xl">⛽</span>
          <div>
            <p className="text-sm font-medium text-green-400">
              {(totalSubsidised as bigint | undefined)?.toString() ?? "0"} transactions gas-free
            </p>
            <p className="text-xs text-[#555]">
              ~{(Number(totalGas ?? 0n) / 1e6).toFixed(2)}M gas units covered by pool yield
            </p>
          </div>
        </div>
      </div>

      {/* ── My Position ── */}
      {address && (
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
          <h3 className="text-base font-semibold mb-5">My Position</h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <PoolStat
              label="My Deposit"
              value={`${formatUSDT((myDeposit as any)?.[0])} USDT`}
            />
            <PoolStat
              label="My Share"
              value={`${((Number(shareBps ?? 0n)) / 100).toFixed(2)}%`}
            />
            <PoolStat
              label="Pending Yield"
              value={`${formatUSDT(pendingYield as bigint | undefined)} USDT`}
              highlight
            />
          </div>

          {/* Deposit form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Deposit USDT</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                  placeholder="100"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm focus:border-[#E6007A] focus:outline-none transition-colors"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositing || approving}
                  className="px-4 py-2 rounded-lg bg-[#E6007A] text-white text-sm font-medium hover:bg-[#CC006A] disabled:opacity-50 transition-colors"
                >
                  {depositing ? "…" : "Deposit"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#888] mb-1.5">Withdraw (shares)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  placeholder="Shares amount"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm focus:border-[#E6007A] focus:outline-none transition-colors"
                />
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="px-4 py-2 rounded-lg border border-[#2A2A2A] text-[#888] text-sm hover:text-white hover:border-[#444] disabled:opacity-50 transition-colors"
                >
                  {withdrawing ? "…" : "Withdraw"}
                </button>
              </div>
            </div>
          </div>

          {/* Claim yield */}
          {pendingYield != null && (pendingYield as bigint) > 0n && (
            <button
              onClick={handleClaimYield}
              disabled={claiming}
              className="w-full py-2.5 rounded-xl border border-[#E6007A]/30 text-[#E6007A] text-sm font-medium hover:bg-[#E6007A]/10 disabled:opacity-50 transition-colors"
            >
              {claiming
                ? "Claiming…"
                : `Claim ${formatUSDT(pendingYield as bigint)} USDT yield`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PoolStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
      <p className="text-xs text-[#555] mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-[#E6007A]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

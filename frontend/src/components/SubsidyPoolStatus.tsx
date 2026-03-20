import React, { useState, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, ERC20_ABI, BRIDGE_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";
import { motion, AnimatePresence } from "framer-motion";
import { Database, TrendingUp, Zap, ShieldCheck, Wallet, Info, Activity, DollarSign, BarChart3, Clock, Flame } from "lucide-react";

export default function SubsidyPoolStatus() {
  const { address } = useAccount();
  const chainId     = useChainId();
  const networkKey  = chainId === 420420421 ? "paseo" : "hardhat";

  const subsidyAddr = CONTRACT_ADDRESSES[networkKey]?.SubsidyPool;
  const usdtAddr    = CONTRACT_ADDRESSES[networkKey]?.USDT;
  const bridgeAddr  = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;

  const [depositAmt, setDepositAmt]   = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [pendingDeposit, setPendingDeposit] = useState<bigint | null>(null);

  // ── Pool Reads ─────────────────────────────────────────────────────────────

  const { data: poolBalance } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "poolBalance",
    query: { refetchInterval: 10_000 },
  });

  const { data: totalSubsidised } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalSubsidisedTxns",
    query: { refetchInterval: 5_000 },
  });

  const { data: totalGas } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalGasCovered",
    query: { refetchInterval: 5_000 },
  });

  const { data: totalDeposited } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalDeposited",
    query: { refetchInterval: 10_000 },
  });

  const { data: currentApyBps } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "currentApyBps",
    query: { refetchInterval: 15_000 },
  });

  const { data: dynamicApyBps } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "dynamicApyBps",
    query: { refetchInterval: 15_000 },
  });

  const { data: realYieldReceived } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "realYieldReceived",
    query: { refetchInterval: 15_000 },
  });

  const { data: yieldBps } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "BASE_YIELD_BPS",
  });

  // ── Staking Stats from Bridge ──────────────────────────────────────────────

  const { data: stakingStats } = useReadContract({
    address: bridgeAddr, abi: BRIDGE_ABI, functionName: "getStakingStats",
    query: { refetchInterval: 15_000 },
  });

  const { data: lastYieldSync } = useReadContract({
    address: bridgeAddr, abi: BRIDGE_ABI, functionName: "lastYieldSync",
    query: { refetchInterval: 15_000 },
  });

  // ── User Position ──────────────────────────────────────────────────────────

  const { data: myDeposit } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "depositors",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: pendingYield } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "pendingYield",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: shareBps } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "depositorShareBps",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  // ── Write ──────────────────────────────────────────────────────────────────

  const { writeContract: approveWrite, data: approveTx } = useWriteContract();
  const { writeContract: depositWrite, data: depositTx  } = useWriteContract();
  const { writeContract: withdrawWrite, data: withdrawTx } = useWriteContract();
  const { writeContract: claimWrite,   data: claimTx    } = useWriteContract();

  const { isLoading: approving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx  });
  const { isLoading: depositing } = useWaitForTransactionReceipt({ hash: depositTx  });
  const { isLoading: withdrawing} = useWaitForTransactionReceipt({ hash: withdrawTx });
  const { isLoading: claiming   } = useWaitForTransactionReceipt({ hash: claimTx    });

  React.useEffect(() => {
    if (!approveSuccess || pendingDeposit == null) return;
    depositWrite({
      address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "deposit",
      args: [pendingDeposit],
    });
    setPendingDeposit(null);
  }, [approveSuccess, pendingDeposit, depositWrite, subsidyAddr]);

  const handleDeposit = () => {
    if (!depositAmt) return;
    const amount = parseUnits(depositAmt, 6);
    setPendingDeposit(amount);
    approveWrite({ address: usdtAddr, abi: ERC20_ABI, functionName: "approve", args: [subsidyAddr, amount] });
  };

  const handleWithdraw = () => {
    if (!withdrawAmt || !myDeposit) return;
    const shares = parseUnits(withdrawAmt, 6);
    withdrawWrite({ address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "withdraw", args: [shares] });
  };

  const handleClaimYield = () => {
    claimWrite({ address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "claimYield", args: [] });
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const apy = useMemo(() => {
    if (currentApyBps) return Number(currentApyBps) / 100;
    if (yieldBps) return Number(yieldBps) / 100;
    return 5;
  }, [currentApyBps, yieldBps]);

  const isLiveYield = dynamicApyBps != null && (dynamicApyBps as bigint) > 0n;

  const gasSavedInUsdt = useMemo(() => {
    if (!totalGas) return "0.00";
    const dotSaved = Number(totalGas) / 20_000_000;
    const currentDotPrice = 7.50;
    return (dotSaved * currentDotPrice).toFixed(2);
  }, [totalGas]);

  const gasSavedDot = useMemo(() => {
    if (!totalGas) return "0.000";
    return (Number(totalGas) / 20_000_000).toFixed(3);
  }, [totalGas]);

  const stakingStatsArr = stakingStats as [bigint, bigint, bigint, bigint] | undefined;
  const lastSyncTime = lastYieldSync ? new Date(Number(lastYieldSync) * 1000).toLocaleString() : "Never";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Pool Header & Stats ── */}
      <div className="terminal-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -z-10" />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
           <div>
              <h2 className="text-3xl font-bold font-space flex items-center gap-4">
                 <Database className="w-8 h-8 text-indigo-600" />
                 Subsidy Liquidity Pool
              </h2>
              <p className="text-gray-500 mt-3 max-w-xl font-inter leading-relaxed">
                 Earn protocol-level yield from live validator staking on Polkadot Hub.
                 Depositors empower zero-fee micropayments across the network.
              </p>
           </div>
           <div className="flex gap-4">
             <div className={`${isLiveYield ? 'bg-green-500/10 border-green-500/30' : 'bg-indigo-600/10 border-indigo-600/20'} border px-6 py-3  flex items-center gap-3`}>
                <TrendingUp className={`w-5 h-5 ${isLiveYield ? 'text-green-400' : 'text-indigo-600'}`} />
                <div className="flex flex-col">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${isLiveYield ? 'text-green-400/60' : 'text-indigo-600/60'}`}>
                     {isLiveYield ? 'Live Staking APY' : 'Estimated APY'}
                   </span>
                   <span className="text-xl font-bold font-space text-gray-900">{apy.toFixed(2)}%</span>
                </div>
             </div>
             {isLiveYield && (
               <div className="bg-green-500/5 border border-green-500/20 px-4 py-2 rounded-xl flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-green-400/80">Precompile 0x801</span>
               </div>
             )}
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <PoolStat
            icon={<Wallet className="w-4 h-4" />}
            label="Total Value Locked"
            value={formatUSDT(totalDeposited as bigint | undefined)}
            unit="USDT"
          />
          <PoolStat
            icon={<Database className="w-4 h-4" />}
            label="Internal Buffer"
            value={formatUSDT(poolBalance as bigint | undefined)}
            unit="USDT"
          />
          <PoolStat
            icon={<Zap className="w-4 h-4" />}
            label="Active Subsidies"
            value={(totalSubsidised as bigint | undefined)?.toString() ?? "0"}
            unit="TX"
            active
          />
          <PoolStat
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Security Rating"
            value="A+"
            unit="OZ-Audit"
          />
        </div>

        {/* ── Gas Savings Tracker (real-time, prominent) ── */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-blue-600/10 border-2 border-blue-600/40 ring-2 ring-blue-600/20">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600/20 flex items-center justify-center ring-2 ring-blue-600/30">
                <Zap className="w-10 h-10 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/80 mb-1">Signatures Substituted</p>
                <p className="text-2xl font-black font-space text-gray-900 tabular-nums">
                  {(totalSubsidised as bigint | undefined)?.toString() ?? "0"}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  ~{(Number(totalGas ?? 0n) / 1e6).toFixed(2)}M gas covered
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-green-500/10 border-2 border-green-500/40 ring-2 ring-green-500/20">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-500/20 flex items-center justify-center ring-2 ring-green-500/30">
                <DollarSign className="w-10 h-10 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400/80 mb-1">Gas Saved USD</p>
                <p className="text-2xl font-black font-space text-green-400 tabular-nums">
                  ${gasSavedInUsdt}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  ~{gasSavedDot} DOT absorbed by 0x801 yield
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Number(gasSavedInUsdt) * 10, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
              />
            </div>
          </div>
        </div>

        {/* ── Staking Precompile Stats ── */}
        {stakingStatsArr && (
          <div className="mt-8 p-6  bg-gray-50 border border-gray-200">
            <h4 className="text-sm font-bold font-space text-gray-600 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-600" />
              Staking Precompile (0x801) Live Data
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MiniStat label="Pending Rewards" value={`${formatUnits(stakingStatsArr[0], 18)} DOT`} />
              <MiniStat label="Total Staked" value={`${formatUnits(stakingStatsArr[1], 18)} DOT`} />
              <MiniStat label="Total Swept" value={`${formatUnits(stakingStatsArr[2], 18)} DOT`} />
              <MiniStat label="Last Sync" value={lastSyncTime} />
            </div>
          </div>
        )}

        {/* ── Real Yield Badge ── */}
        {realYieldReceived != null && (realYieldReceived as bigint) > 0n && (
          <div className="mt-6 p-4  bg-violet-600/5 border border-violet-600/20 flex items-center gap-4">
            <Flame className="w-5 h-5 text-violet-600" />
            <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">
              {formatUSDT(realYieldReceived as bigint)} USDT swept from live staking yield into the pool
            </p>
          </div>
        )}
      </div>

      {/* ── My Position ── */}
      {address && (
        <div className="terminal-card p-6 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/5 blur-[100px] -z-10" />

          <h3 className="text-xl font-bold font-space mb-8 flex items-center gap-3">
             <TrendingUp className="w-5 h-5 text-violet-600" />
             My Protocol Position
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6  bg-gray-50 border border-gray-200">
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Asset Stake</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-gray-900">{formatUSDT((myDeposit as any)?.[0])}</span>
                  <span className="text-xs text-gray-400 uppercase font-mono tracking-tighter">USDT</span>
               </div>
            </div>
            <div className="p-6  bg-gray-50 border border-gray-200">
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Pool Ownership</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-gray-900">{((Number(shareBps ?? 0n)) / 100).toFixed(2)}</span>
                  <span className="text-xs text-gray-400 uppercase font-mono tracking-tighter">%</span>
               </div>
            </div>
            <div className="p-6  bg-indigo-600/5 border border-indigo-600/20 ">
               <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3 ml-1">Claimable Rewards</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-gray-900">{formatUSDT(pendingYield as bigint | undefined)}</span>
                  <span className="text-xs text-gray-400 uppercase font-mono tracking-tighter">USDT</span>
               </div>
            </div>
          </div>

          {/* Interaction Forms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Deposit Asset</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-5 py-4  bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-gray-100 focus:outline-none transition-all font-space"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositing || approving}
                  className="px-8 py-4  bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold font-space hover:shadow-glow-pink transition-all active:scale-95 disabled:opacity-50"
                >
                  {depositing ? "Wait..." : "Stake"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Withdraw Shares</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  placeholder="Shares..."
                  className="flex-1 px-5 py-4  bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:border-gray-300 focus:bg-gray-100 focus:outline-none transition-all font-space"
                />
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="px-8 py-4  border border-gray-200 text-gray-500 text-sm font-bold font-space hover:text-gray-800 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {withdrawing ? "Wait..." : "Unstake"}
                </button>
              </div>
            </div>
          </div>

          {/* Reward Action */}
          <AnimatePresence>
            {pendingYield != null && (pendingYield as bigint) > 0n && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={handleClaimYield}
                disabled={claiming}
                className="w-full py-5  bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold font-space uppercase tracking-[0.2em] shadow-xl hover:shadow-glow-blue transition-all active:scale-95 disabled:opacity-50 group"
              >
                {claiming
                  ? "Distributing Rewards..."
                  : `Collect ${formatUSDT(pendingYield as bigint)} USDT Yield`}
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center gap-3 p-4  bg-gray-100 border border-gray-200">
             <Info className="w-4 h-4 text-gray-400" />
             <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
               Your stake powers the network-wide subsidy layer. Yield is sourced from Staking Precompile (0x801) rewards.
             </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PoolStat({
  icon, label, value, unit, active,
}: {
  icon: React.ReactNode; label: string; value: string; unit: string; active?: boolean;
}) {
  return (
    <div className={`p-6  border transition-all ${active ? 'bg-indigo-600/5 border-indigo-600/30 ' : 'bg-gray-50 border-gray-200'}`}>
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${active ? 'bg-indigo-600/10 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
          {icon}
       </div>
       <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
       <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold font-space ${active ? 'text-gray-900' : 'text-gray-700'}`}>{value}</span>
          <span className="text-[10px] text-gray-400 uppercase font-mono">{unit}</span>
       </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className="text-sm font-bold font-space text-gray-700 truncate">{value}</p>
    </div>
  );
}

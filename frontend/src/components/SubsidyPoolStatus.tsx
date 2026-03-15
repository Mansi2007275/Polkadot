import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, ERC20_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";
import { motion, AnimatePresence } from "framer-motion";
import { Database, TrendingUp, Zap, ShieldCheck, ArrowDownCircle, ArrowUpCircle, Wallet, Info } from "lucide-react";

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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Pool Header & Stats ── */}
      <div className="glass p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-pink/5 blur-[100px] -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
           <div>
              <h2 className="text-3xl font-bold font-space flex items-center gap-4">
                 <Database className="w-8 h-8 text-primary-pink" />
                 Subsidy Liquidity Pool
              </h2>
              <p className="text-white/40 mt-3 max-w-xl font-inter leading-relaxed">
                 Earn protocol-level yield substituted from validator rewards and ad revenue. 
                 Depositors empower zero-fee micropayments across the network.
              </p>
           </div>
           <div className="bg-primary-pink/10 border border-primary-pink/20 px-6 py-3 rounded-2xl flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary-pink" />
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-widest text-primary-pink/60">Estimated APY</span>
                 <span className="text-xl font-bold font-space text-white">{apy}%</span>
              </div>
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

        {/* Gas covered metric */}
        <div className="mt-10 p-5 rounded-3xl bg-primary-blue/5 border border-primary-blue/20 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary-blue/10 flex items-center justify-center">
             <Zap className="w-8 h-8 text-primary-blue shadow-glow-blue" />
          </div>
          <div>
            <p className="text-lg font-bold font-space text-white">
              {(totalSubsidised as bigint | undefined)?.toString() ?? "0"} Signatures Substituted
            </p>
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium mt-1">
              ~{(Number(totalGas ?? 0n) / 1e6).toFixed(2)}M gas units covered by protocol yield
            </p>
          </div>
        </div>
      </div>

      {/* ── My Position ── */}
      {address && (
        <div className="glass p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-purple/5 blur-[100px] -z-10" />
          
          <h3 className="text-xl font-bold font-space mb-8 flex items-center gap-3">
             <TrendingUp className="w-5 h-5 text-primary-purple" />
             My Protocol Position
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-3 ml-1">Asset Stake</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-white">{formatUSDT((myDeposit as any)?.[0])}</span>
                  <span className="text-xs text-white/20 uppercase font-mono tracking-tighter">USDT</span>
               </div>
            </div>
            <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-3 ml-1">Pool Ownership</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-white">{((Number(shareBps ?? 0n)) / 100).toFixed(2)}</span>
                  <span className="text-xs text-white/20 uppercase font-mono tracking-tighter">%</span>
               </div>
            </div>
            <div className="p-6 rounded-[24px] bg-primary-pink/5 border border-primary-pink/20 shadow-glow-pink/10">
               <p className="text-[10px] font-black uppercase tracking-widest text-primary-pink mb-3 ml-1">Claimable Rewards</p>
               <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-space text-white">{formatUSDT(pendingYield as bigint | undefined)}</span>
                  <span className="text-xs text-white/20 uppercase font-mono tracking-tighter">USDT</span>
               </div>
            </div>
          </div>

          {/* Interaction Forms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Deposit Asset</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm focus:border-primary-pink/50 focus:bg-white/[0.05] focus:outline-none transition-all font-space"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositing || approving}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-pink to-primary-purple text-white text-sm font-bold font-space hover:shadow-glow-pink transition-all active:scale-95 disabled:opacity-50"
                >
                  {depositing ? "Wait..." : "Stake"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Withdraw Shares</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  placeholder="Shares..."
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm focus:border-white/30 focus:bg-white/[0.05] focus:outline-none transition-all font-space"
                />
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="px-8 py-4 rounded-2xl border border-white/10 text-white/40 text-sm font-bold font-space hover:text-white hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
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
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-purple to-primary-blue text-white font-bold font-space uppercase tracking-[0.2em] shadow-xl hover:shadow-glow-blue transition-all active:scale-95 disabled:opacity-50 group"
              >
                {claiming
                  ? "Distributing Rewards..."
                  : `Collect ${formatUSDT(pendingYield as bigint)} USDT Yield`}
              </motion.button>
            )}
          </AnimatePresence>
          
          <div className="mt-8 flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
             <Info className="w-4 h-4 text-white/20" />
             <p className="text-[10px] text-white/20 uppercase font-bold tracking-tight">Your stake is used to power the network-wide subsidy layer. You can unstake at any time.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PoolStat({
  icon,
  label,
  value,
  unit,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  active?: boolean;
}) {
  return (
    <div className={`p-6 rounded-[24px] border transition-all ${active ? 'bg-primary-pink/5 border-primary-pink/30 shadow-glow-pink/10' : 'bg-white/[0.02] border-white/5'}`}>
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${active ? 'bg-primary-pink/10 text-primary-pink' : 'bg-white/5 text-white/20'}`}>
          {icon}
       </div>
       <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">{label}</p>
       <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold font-space ${active ? 'text-white' : 'text-white/80'}`}>{value}</span>
          <span className="text-[10px] text-white/20 uppercase font-mono">{unit}</span>
       </div>
    </div>
  );
}

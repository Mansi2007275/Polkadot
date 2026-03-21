import React, { useMemo, useState, useEffect } from "react";
import { useAccount, useReadContract, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES, SUBSIDY_ABI, BRIDGE_ABI } from "../config/contracts";
import { DEMO_DATA } from "../config/demoData";
import { formatUSDT } from "../hooks/useStream";

const getDemoMode = () => (window as any).__DEMO_MODE__ === true;
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Zap,
  DollarSign,
  Activity,
  Shield,
  Layers,
  Clock,
  ArrowUp,
  ArrowDown,
  Cpu,
  Flame,
  Target,
  Globe,
} from "lucide-react";

export default function YieldEngine() {
  const { address } = useAccount();
  const chainId = useChainId();
  const networkKey = chainId === 420420421 ? "paseo" : "hardhat";

  const subsidyAddr = CONTRACT_ADDRESSES[networkKey]?.SubsidyPool;
  const bridgeAddr = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;

  // ── Pool Reads ─────────────────────────────────────────────────────────────

  const { data: totalDepositedRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalDeposited",
    query: { refetchInterval: 10_000 },
  });
  const totalDeposited = getDemoMode() ? DEMO_DATA.pool.totalDeposited : totalDepositedRaw;

  const { data: poolBalanceRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "poolBalance",
    query: { refetchInterval: 10_000 },
  });
  const poolBalance = getDemoMode() ? DEMO_DATA.pool.poolBalance : poolBalanceRaw;

  const { data: totalSubsidisedRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalSubsidisedTxns",
    query: { refetchInterval: 10_000 },
  });
  const totalSubsidised = getDemoMode() ? DEMO_DATA.pool.totalSubsidisedTxns : totalSubsidisedRaw;

  const { data: totalGasRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "totalGasCovered",
    query: { refetchInterval: 10_000 },
  });
  const totalGas = getDemoMode() ? DEMO_DATA.pool.totalGasCovered : totalGasRaw;

  const { data: currentApyBpsRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "currentApyBps",
    query: { refetchInterval: 15_000 },
  });
  const currentApyBps = getDemoMode() ? DEMO_DATA.pool.currentApyBps : currentApyBpsRaw;

  const { data: dynamicApyBpsRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "dynamicApyBps",
    query: { refetchInterval: 15_000 },
  });
  const dynamicApyBps = getDemoMode() ? DEMO_DATA.pool.dynamicApyBps : dynamicApyBpsRaw;

  const { data: realYieldRaw } = useReadContract({
    address: subsidyAddr, abi: SUBSIDY_ABI, functionName: "realYieldReceived",
    query: { refetchInterval: 15_000 },
  });
  const realYield = getDemoMode() ? DEMO_DATA.pool.realYieldReceived : realYieldRaw;

  // ── Bridge / Staking Reads ─────────────────────────────────────────────────

  const { data: stakingStatsRaw } = useReadContract({
    address: bridgeAddr, abi: BRIDGE_ABI, functionName: "getStakingStats",
    query: { refetchInterval: 15_000 },
  });
  const stakingStats = getDemoMode() ? DEMO_DATA.staking : stakingStatsRaw;

  const { data: totalRewardsSwept } = useReadContract({
    address: bridgeAddr, abi: BRIDGE_ABI, functionName: "totalRewardsSwept",
    query: { refetchInterval: 15_000 },
  });

  const { data: lastYieldSyncRaw } = useReadContract({
    address: bridgeAddr, abi: BRIDGE_ABI, functionName: "lastYieldSync",
    query: { refetchInterval: 15_000 },
  });
  const lastYieldSync = getDemoMode() ? DEMO_DATA.staking[3] : lastYieldSyncRaw;

  // ── Computed ───────────────────────────────────────────────────────────────

  const DOT_PRICE = 7.5;

  const tvl = useMemo(() => {
    if (!totalDeposited) return 0;
    return Number(totalDeposited) / 1e6;
  }, [totalDeposited]);

  const gasSavedDot = useMemo(() => {
    if (!totalGas) return 0;
    return Number(totalGas) / 20_000_000;
  }, [totalGas]);

  const gasSavedUsd = useMemo(() => gasSavedDot * DOT_PRICE, [gasSavedDot]);

  const apy = useMemo(() => {
    if (currentApyBps) return Number(currentApyBps) / 100;
    return 5;
  }, [currentApyBps]);

  const isLive = dynamicApyBps != null && (dynamicApyBps as bigint) > 0n;

  const stakingStatsArr = stakingStats as [bigint, bigint, bigint, bigint] | undefined;
  const stakedDot = stakingStatsArr ? Number(formatUnits(stakingStatsArr[1], 18)) : 0;
  const pendingRewards = stakingStatsArr ? Number(formatUnits(stakingStatsArr[0], 18)) : 0;
  const sweptTotal = stakingStatsArr ? Number(formatUnits(stakingStatsArr[2], 18)) : 0;

  const efficiency = useMemo(() => {
    if (tvl === 0) return 0;
    return ((gasSavedUsd / tvl) * 100);
  }, [gasSavedUsd, tvl]);

  const lastSyncStr = lastYieldSync && Number(lastYieldSync) > 0
    ? new Date(Number(lastYieldSync) * 1000).toLocaleString()
    : "Never";

  // Animated counter
  const [displayedSaved, setDisplayedSaved] = useState(0);
  useEffect(() => {
    const target = gasSavedUsd;
    const step = (target - displayedSaved) / 20;
    if (Math.abs(target - displayedSaved) < 0.01) {
      setDisplayedSaved(target);
      return;
    }
    const timer = setTimeout(() => setDisplayedSaved(prev => prev + step), 50);
    return () => clearTimeout(timer);
  }, [gasSavedUsd, displayedSaved]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ── Hero Section ── */}
      <div className="terminal-card p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-pink/5 rounded-full blur-[150px] -z-10" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-blue/5 rounded-full blur-[150px] -z-10" />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <h2 className="text-3xl font-bold font-space flex items-center gap-4">
              <BarChart3 className="w-8 h-8 text-primary-pink" />
              Yield Engine Analytics
            </h2>
            <p className="text-gray-900/40 mt-3 max-w-xl font-inter leading-relaxed">
              Real-time analysis of TVL in the staking precompile versus gas costs
              absorbed for network users. Live data from Precompile 0x801.
            </p>
          </div>
          <div className="flex gap-3">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border ${isLive ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isLive ? 'text-green-400' : 'text-yellow-400'}`}>
                {isLive ? 'Live Staking' : 'Simulated Yield'}
              </span>
            </div>
          </div>
        </div>

        {/* ── TVL vs Gas Saved Hero Metrics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* TVL Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8  bg-gradient-to-br from-primary-pink/10 via-transparent to-primary-purple/5 border border-primary-pink/20 relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-primary-pink/5 blur-[40px]" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary-pink/10 border border-primary-pink/20 flex items-center justify-center">
                <Layers className="w-6 h-6 text-primary-pink" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-pink/60">Total Value Locked</p>
                <p className="text-[10px] text-gray-400 font-mono">SubsidyPool + Staking</p>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold font-space text-gray-900">${tvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs text-gray-400 uppercase font-mono">USDT</span>
            </div>
            {stakedDot > 0 && (
              <p className="text-xs text-gray-500 mt-3 font-mono">+ {stakedDot.toFixed(4)} DOT staked via 0x801</p>
            )}
          </motion.div>

          {/* Gas Saved Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-8  bg-gradient-to-br from-green-500/10 via-transparent to-primary-blue/5 border border-green-500/20 relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-green-500/5 blur-[40px]" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400/60">Total Gas Saved</p>
                <p className="text-[10px] text-gray-400 font-mono">DOT at ${DOT_PRICE}/DOT</p>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold font-space text-gray-900">${displayedSaved.toFixed(2)}</span>
              <span className="text-xs text-gray-400 uppercase font-mono">USD</span>
            </div>
            <p className="text-xs text-gray-500 mt-3 font-mono">{gasSavedDot.toFixed(6)} DOT absorbed by yield pool</p>
          </motion.div>
        </div>

        {/* ── Key Metrics Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Current APY"
            value={`${apy.toFixed(2)}%`}
            color="pink"
          />
          <MetricCard
            icon={<Zap className="w-4 h-4" />}
            label="Subsidised TX"
            value={(totalSubsidised as bigint | undefined)?.toString() ?? "0"}
            color="blue"
          />
          <MetricCard
            icon={<Activity className="w-4 h-4" />}
            label="Gas Covered"
            value={`${(Number(totalGas ?? 0n) / 1e6).toFixed(1)}M`}
            color="purple"
          />
          <MetricCard
            icon={<Target className="w-4 h-4" />}
            label="Efficiency"
            value={`${efficiency.toFixed(2)}%`}
            color="green"
          />
          <MetricCard
            icon={<Flame className="w-4 h-4" />}
            label="Real Yield"
            value={formatUSDT(realYield as bigint | undefined)}
            color="orange"
          />
          <MetricCard
            icon={<Shield className="w-4 h-4" />}
            label="Pool Buffer"
            value={formatUSDT(poolBalance as bigint | undefined)}
            color="white"
          />
        </div>
      </div>

      {/* ── Staking Precompile Deep Dive ── */}
      <div className="terminal-card p-6 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-purple/5 blur-[100px] -z-10" />

        <h3 className="text-xl font-bold font-space mb-8 flex items-center gap-3">
          <Cpu className="w-5 h-5 text-primary-purple" />
          Staking Precompile (0x801) Deep Dive
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StakingStat
            label="Bonded DOT"
            value={`${stakedDot.toFixed(4)}`}
            unit="DOT"
            icon={<Layers className="w-5 h-5 text-primary-pink" />}
          />
          <StakingStat
            label="Pending Rewards"
            value={`${pendingRewards.toFixed(6)}`}
            unit="DOT"
            icon={<Clock className="w-5 h-5 text-primary-blue" />}
            highlight
          />
          <StakingStat
            label="Total Swept"
            value={`${sweptTotal.toFixed(4)}`}
            unit="DOT"
            icon={<ArrowDown className="w-5 h-5 text-green-400" />}
          />
          <StakingStat
            label="Last Sync"
            value={lastSyncStr}
            unit=""
            icon={<Clock className="w-5 h-5 text-gray-900/40" />}
            small
          />
        </div>

        {/* Yield Flow Diagram */}
        <div className="p-8  bg-gray-50 border border-gray-200">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6">Yield Flow Architecture</p>
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4">
            <FlowNode label="Validators" sub="Polkadot Hub" color="pink" />
            <FlowArrow />
            <FlowNode label="Staking 0x801" sub="Precompile" color="purple" />
            <FlowArrow />
            <FlowNode label="StablecoinBridge" sub="syncRealTimeYield()" color="blue" />
            <FlowArrow />
            <FlowNode label="SubsidyPool" sub="receiveYieldSweep()" color="green" />
            <FlowArrow />
            <FlowNode label="Users" sub="Zero-Fee TX" color="white" />
          </div>
        </div>
      </div>

      {/* ── Protocol Health ── */}
      <div className="p-6 rounded-2xl border-4 border-black bg-white">
        <h3 className="text-xl font-bold font-space mb-8 flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary-blue" />
          Protocol Health Score
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <HealthGauge label="Yield Coverage" value={Math.min(100, efficiency * 10)} color="from-green-500 to-green-400" labelClass="text-gray-900" />
          <HealthGauge label="Pool Utilization" value={tvl > 0 ? Math.min(100, (Number(poolBalance ?? 0n) / 1e6 / tvl) * 100) : 0} color="from-primary-blue to-primary-purple" labelClass="text-gray-900" />
          <HealthGauge label="Subsidy Efficiency" value={Number(totalSubsidised ?? 0n) > 0 ? Math.min(100, gasSavedUsd / Number(totalSubsidised ?? 1n) * 100) : 0} color="from-primary-pink to-primary-purple" labelClass="text-gray-900" />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    pink: "bg-primary-pink/5 border-primary-pink/20 text-primary-pink",
    blue: "bg-primary-blue/5 border-primary-blue/20 text-primary-blue",
    purple: "bg-primary-purple/5 border-primary-purple/20 text-primary-purple",
    green: "bg-green-500/5 border-green-500/20 text-green-400",
    orange: "bg-orange-500/5 border-orange-500/20 text-orange-400",
    white: "bg-gray-100 border-gray-200 text-gray-500",
  };
  const cls = colorMap[color] || colorMap.white;

  return (
    <div className={`p-4 rounded-2xl border ${cls}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold font-space text-gray-900 truncate">{value}</p>
    </div>
  );
}

function StakingStat({ label, value, unit, icon, highlight, small }: {
  label: string; value: string; unit: string; icon: React.ReactNode; highlight?: boolean; small?: boolean;
}) {
  return (
    <div className={`p-6  border transition-all ${highlight ? 'bg-primary-blue/5 border-primary-blue/30' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-4">{icon}<span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span></div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-bold font-space text-gray-900 ${small ? 'text-sm' : 'text-xl'}`}>{value}</span>
        {unit && <span className="text-[10px] text-gray-400 uppercase font-mono">{unit}</span>}
      </div>
    </div>
  );
}

function FlowNode({ label, sub, color }: { label: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    pink: "border-primary-pink/30 bg-primary-pink/5",
    purple: "border-primary-purple/30 bg-primary-purple/5",
    blue: "border-primary-blue/30 bg-primary-blue/5",
    green: "border-green-500/30 bg-green-500/5",
    white: "border-gray-300 bg-gray-100",
  };
  return (
    <div className={`flex-shrink-0 px-4 py-3 rounded-xl border ${colorMap[color] || colorMap.white} text-center min-w-[100px]`}>
      <p className="text-xs font-bold font-space text-gray-900">{label}</p>
      <p className="text-[9px] text-gray-500 font-mono mt-0.5">{sub}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex-shrink-0 flex items-center">
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-gray-400"
      >
        <ArrowUp className="w-4 h-4 rotate-90" />
      </motion.div>
    </div>
  );
}

function HealthGauge({ label, value, color, labelClass }: { label: string; value: number; color: string; labelClass?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="p-6 bg-gray-50 border border-gray-200">
      <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${typeof labelClass === 'string' ? labelClass : 'text-gray-900'}`}>{label}</p>
      <div className="relative h-4 w-full rounded-full bg-gray-100 overflow-hidden border border-gray-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <p className="text-right mt-2 text-sm font-bold font-space text-gray-600">{clamped.toFixed(1)}%</p>
    </div>
  );
}

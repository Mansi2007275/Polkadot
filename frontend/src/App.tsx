import React, { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "./components/WalletConnect";
import StreamForm from "./components/StreamForm";
import Dashboard from "./components/Dashboard";
import SubsidyPoolStatus from "./components/SubsidyPoolStatus";
import BridgeButton from "./components/BridgeButton";
import TransactionHistory from "./components/TransactionHistory";
import YieldEngine from "./components/YieldEngine";
import { BentoGrid } from "./components/BentoGrid";
import { PrecompileMonitor } from "./components/PrecompileMonitor";
import { subscribePrecompileLogs } from "./lib/precompileFeed";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Send, Database, History, Repeat, Github, ExternalLink } from "lucide-react";

type Tab = "streams" | "subsidy" | "bridge" | "analytics" | "history";

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "streams", label: "Streams", icon: <Send className="w-3.5 h-3.5" /> },
  { key: "subsidy", label: "Yield Pool", icon: <Database className="w-3.5 h-3.5" /> },
  { key: "analytics", label: "Yield Engine", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "bridge", label: "Bridge", icon: <Repeat className="w-3.5 h-3.5" /> },
  { key: "history", label: "History", icon: <History className="w-3.5 h-3.5" /> },
];

function usePrecompileLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  React.useEffect(() => subscribePrecompileLogs(setLogs), []);
  return logs;
}

export default function App() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("streams");
  const precompileLogsState = usePrecompileLogs();

  return (
    <div className="min-h-screen bg-background text-white font-mono selection:bg-neon-pink/20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a] border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-neon-pink flex items-center justify-center">
              <span className="text-neon-pink text-sm font-bold">P</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Protocol Console</h1>
              <p className="text-[9px] text-[#666] uppercase tracking-widest">
                Polkadot Hub · Paseo · REVM
              </p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Bento Grid - always visible */}
          <BentoGrid />

          {/* Connect CTA when disconnected */}
          {!isConnected && (
            <div className="terminal-card p-12 text-center border-dashed">
              <p className="text-[10px] font-mono text-[#666] uppercase tracking-widest mb-4">
                Connect wallet to create streams, deposit, bridge
              </p>
              <p className="text-xs font-mono text-[#444]">
                Latency-optimized Sablier-variant via Polkadot REVM
              </p>
            </div>
          )}

          {/* Authenticated: Tabs + Content + Precompile Console */}
          {isConnected && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div>
                {/* Tabs */}
                <div className="flex gap-0 mb-6 border-b border-[#222] overflow-x-auto scrollbar-none">
                  {TAB_CONFIG.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`relative px-5 py-3 text-[11px] font-mono font-semibold uppercase tracking-widest flex items-center gap-2 whitespace-nowrap border-b-2 -mb-[1px] transition-colors ${
                        activeTab === key
                          ? "text-white border-neon-pink"
                          : "text-[#666] border-transparent hover:text-[#888]"
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeTab === "streams" && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <StreamForm />
                        <Dashboard />
                      </div>
                    )}
                    {activeTab === "subsidy" && <SubsidyPoolStatus />}
                    {activeTab === "analytics" && <YieldEngine />}
                    {activeTab === "bridge" && <BridgeButton />}
                    {activeTab === "history" && <TransactionHistory />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Precompile Feed - side panel */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <PrecompileMonitor logs={precompileLogsState} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-[#222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-mono text-[#444]">
            XCM(0x800) Staking(0x801) Assets(0x802) · Paseo Testnet
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-[#666] hover:text-neon-pink transition-colors flex items-center gap-2"
            >
              <Github className="w-3.5 h-3.5" /> Source
            </a>
            <a
              href="https://blockscout.paseo.polkadot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-[#666] hover:text-neon-pink transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

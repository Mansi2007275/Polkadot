import React, { useState } from "react";
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
import { BarChart3, Send, Database, History, Repeat, Github, ExternalLink, Sparkles } from "lucide-react";


type Tab = "streams" | "subsidy" | "bridge" | "analytics" | "history";

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "streams", label: "Streams", icon: <Send className="w-4 h-4" /> },
  { key: "subsidy", label: "Yield Pool", icon: <Database className="w-4 h-4" /> },
  { key: "analytics", label: "Yield Engine", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "bridge", label: "Bridge", icon: <Repeat className="w-4 h-4" /> },
  { key: "history", label: "History", icon: <History className="w-4 h-4" /> },
];

export default function App() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("streams");
  const [logs, setLogs] = useState<any[]>([]);
  const [demoMode, setDemoMode] = useState(!isConnected); // Auto-enable if not connected

  // Provide demoMode to the app via window object for hooks to read (simpler than Context for this MVP)
  React.useEffect(() => {
    (window as any).__DEMO_MODE__ = demoMode;
  }, [demoMode]);

  React.useEffect(() => subscribePrecompileLogs(setLogs), []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-white border-b-4 border-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between flex-wrap gap-y-2">
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center border-2 border-black flex-shrink-0">
              <span className="text-white text-lg font-extrabold tracking-widest whitespace-nowrap" style={{ fontFamily: 'Press Start 2P, monospace' }}>P</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-black tracking-wider truncate" style={{ fontFamily: 'Press Start 2P, monospace' }}>Protocol Console</h1>
              <p className="text-xs text-pink-600 font-bold truncate" style={{ fontFamily: 'Press Start 2P, monospace' }}>Polkadot Hub · Paseo</p>
            </div>
          </div>
          <div className="flex items-center gap-4 min-w-0 flex-shrink">
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold border-2 border-black transition-all shadow-lg whitespace-nowrap ${
                demoMode 
                  ? "bg-pink-100 text-pink-700 animate-pulse" 
                  : "bg-white text-black hover:bg-pink-50"
              }`}
              style={{ fontFamily: 'Press Start 2P, monospace', letterSpacing: '0.05em' }}
            >
              <span className="w-4 h-4"><Sparkles className={`w-full h-full ${demoMode ? "animate-pulse" : ""}`} /></span>
              {demoMode ? "DEMO MODE ACTIVE" : "DEMO MODE"}
            </button>
            <div className="min-w-0"><WalletConnect /></div>
          </div>

        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BentoGrid />

        {(!isConnected && !demoMode) && (
          <div className="mt-6 p-12 text-center bg-white rounded-xl border border-gray-200">
            <p className="text-base text-gray-600 mb-1">Connect your wallet to get started</p>
            <p className="text-sm text-gray-500">Create streams, deposit to the yield pool, or bridge assets</p>
          </div>
        )}

        {(isConnected || demoMode) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            <div>
              <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
                {TAB_CONFIG.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-extrabold border-b-4 border-black -mb-px transition-colors ${
                      activeTab === key
                        ? "text-pink-600 bg-pink-50"
                        : "text-gray-500 hover:text-pink-500 hover:border-pink-300 bg-white"
                    }`}
                    style={{ fontFamily: 'Press Start 2P, monospace', letterSpacing: '0.05em' }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

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

            <div className="lg:sticky lg:top-24 lg:self-start">
              <PrecompileMonitor logs={logs} />
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">XCM · Staking · Assets · Paseo Testnet</p>
          <div className="flex gap-6">
            <a
              href="https://github.com/Mansi2007275/Polkadot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <Github className="w-4 h-4" /> Source
            </a>
            <a
              href="https://blockscout.paseo.polkadot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" /> Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

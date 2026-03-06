import React, { useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "./components/WalletConnect";
import StreamForm from "./components/StreamForm";
import Dashboard from "./components/Dashboard";
import SubsidyPoolStatus from "./components/SubsidyPoolStatus";
import BridgeButton from "./components/BridgeButton";
import TransactionHistory from "./components/TransactionHistory";

type Tab = "streams" | "subsidy" | "bridge" | "history";

export default function App() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("streams");

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white font-inter">
      {/* ── Header ── */}
      <header className="border-b border-[#2A2A2A] bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Polkadot logo mark */}
            <div className="w-8 h-8 rounded-full bg-[#E6007A] flex items-center justify-center">
              <span className="text-white text-sm font-bold">●</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-none">
                Zero-Fee Micropayments
              </h1>
              <p className="text-xs text-[#888] leading-none mt-0.5">
                Polkadot Hub · Paseo Testnet
              </p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* ── Hero Banner (unauthenticated) ── */}
      {!isConnected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#E6007A]/10 border border-[#E6007A]/30 text-[#E6007A] text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-[#E6007A] animate-pulse" />
            Live on Paseo Testnet
          </div>
          <h2 className="text-5xl font-bold text-white mb-4 leading-tight">
            Stream Stablecoins.
            <br />
            <span className="text-[#E6007A]">Pay Zero Fees.</span>
          </h2>
          <p className="text-xl text-[#888] max-w-2xl mx-auto mb-8">
            Continuous ERC-20 payment streams on Polkadot Hub with gas costs
            entirely covered by yield from staking rewards and ad revenue.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#666]">
            <Feature icon="⚡" label="Sablier-style streaming" />
            <Feature icon="🛡️" label="Gas subsidised by yield pool" />
            <Feature icon="🌉" label="XCM stablecoin bridge" />
            <Feature icon="🔒" label="OpenZeppelin 5.x security" />
          </div>
        </div>
      )}

      {/* ── Authenticated Layout ── */}
      {isConnected && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-8 bg-[#1A1A1A] p-1 rounded-xl w-fit">
            {(["streams", "subsidy", "bridge", "history"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  activeTab === tab
                    ? "bg-[#E6007A] text-white shadow-lg shadow-[#E6007A]/20"
                    : "text-[#888] hover:text-white hover:bg-[#252525]"
                }`}
              >
                {tab === "streams" ? "💫 Streams" : 
                 tab === "subsidy" ? "🏦 Subsidy Pool" : 
                 tab === "bridge"  ? "🌉 Bridge" : 
                 "📜 History"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "streams" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <StreamForm />
              <Dashboard />
            </div>
          )}
          {activeTab === "subsidy"  && <SubsidyPoolStatus />}
          {activeTab === "bridge"   && <BridgeButton />}
          {activeTab === "history"  && <TransactionHistory />}
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-[#2A2A2A] mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[#555] text-sm">
            Built for DoraHacks / OpenGuild Hackathon · Polkadot Hub EVM Track
          </p>
          <div className="flex gap-4 text-[#555] text-sm">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://paseo.rpc.polkadot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Paseo RPC
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

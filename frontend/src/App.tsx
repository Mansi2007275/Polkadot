import React, { useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "./components/WalletConnect";
import StreamForm from "./components/StreamForm";
import Dashboard from "./components/Dashboard";
import SubsidyPoolStatus from "./components/SubsidyPoolStatus";
import BridgeButton from "./components/BridgeButton";
import TransactionHistory from "./components/TransactionHistory";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Repeat, Lock, Github, ExternalLink } from "lucide-react";

type Tab = "streams" | "subsidy" | "bridge" | "history";

export default function App() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("streams");

  return (
    <div className="min-h-screen bg-background text-white font-inter selection:bg-primary-pink/30">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-pink to-primary-purple rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative w-10 h-10 rounded-full bg-background flex items-center justify-center border border-white/10">
                <span className="text-primary-pink text-xl font-black font-space">P</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold font-space bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 leading-none">
                Protocol
              </h1>
              <p className="text-[10px] text-primary-blue font-bold tracking-widest uppercase mt-1">
                Polkadot Hub · Paseo Net
              </p>
            </div>
          </motion.div>
          <WalletConnect />
        </div>
      </header>

      {/* ── Hero Banner (unauthenticated) ── */}
      {!isConnected && (
        <div className="relative overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-pink/20 rounded-full blur-[120px] -z-10"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary-blue/20 rounded-full blur-[120px] -z-10"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full glass border border-white/10 text-primary-pink text-xs font-bold uppercase tracking-widest"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary-pink animate-pulse" />
              Mainnet Alpha coming soon
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl sm:text-7xl font-bold font-space mb-8 leading-tight tracking-tight"
            >
              Stream Assets.
              <br />
              <span className="gradient-text">Zero Fees Attached.</span>
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-white/60 max-w-3xl mx-auto mb-12 font-inter leading-relaxed"
            >
              The first gas-less micropayment infrastructure on Polkadot Hub. 
              Unlock continuous value flow powered by protocol-level yield substitution.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
            >
              <FeatureCard 
                icon={<Zap className="w-6 h-6 text-primary-pink" />} 
                label="Sablier Streams" 
                desc="Continuous on-chain payments"
              />
              <FeatureCard 
                icon={<Shield className="w-6 h-6 text-primary-blue" />} 
                label="Yield Subsidy" 
                desc="Gas covered by protocol rewards"
              />
              <FeatureCard 
                icon={<Repeat className="w-6 h-6 text-primary-purple" />} 
                label="XCM Bridge" 
                desc="Multi-chain asset liquidity"
              />
              <FeatureCard 
                icon={<Lock className="w-6 h-6 text-white" />} 
                label="OZ Secure" 
                desc="Audited smart contracts"
              />
            </motion.div>
          </div>
        </div>
      )}

      {/* ── Authenticated Layout ── */}
      {isConnected && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Tabs */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-1.5 mb-12 glass p-1.5 rounded-2xl w-fit mx-auto border border-white/5"
          >
            {(["streams", "subsidy", "bridge", "history"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-8 py-3 rounded-xl text-sm font-bold font-space capitalize transition-all duration-300 ${
                  activeTab === tab
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-primary-pink to-primary-purple rounded-xl -z-10 shadow-glow-pink"
                  />
                )}
                <span className="flex items-center gap-2">
                  {tab === "streams" ? "Streams" : 
                   tab === "subsidy" ? "Yield Pool" : 
                   tab === "bridge"  ? "Bridge" : 
                   "History"}
                </span>
              </button>
            ))}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "streams" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <StreamForm />
                  <Dashboard />
                </div>
              )}
              {activeTab === "subsidy"  && <SubsidyPoolStatus />}
              {activeTab === "bridge"   && <BridgeButton />}
              {activeTab === "history"  && <TransactionHistory />}
            </motion.div>
          </AnimatePresence>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="mt-auto py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 opacity-60 grayscale hover:grayscale-0 transition duration-500">
               <div className="w-5 h-5 rounded-full bg-primary-pink" />
               <span className="text-sm font-space font-bold">Protocol</span>
            </div>
            <p className="text-white/30 text-xs mt-3 text-center md:text-left">
              Polkadot Hub EVM Track · Paseo Testnet Deployment
            </p>
          </div>
          
          <div className="flex items-center gap-8">
            <FooterLink href="https://github.com" icon={<Github className="w-4 h-4" />} label="Docs" />
            <FooterLink href="https://paseo.rpc.polkadot.com" icon={<ExternalLink className="w-4 h-4" />} label="Network" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="glass glass-hover p-6 rounded-3xl text-left transition-all duration-300 border border-white/5">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold font-space mb-1">{label}</h3>
      <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}

function FooterLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-white/40 hover:text-primary-pink text-sm font-bold transition-colors duration-300"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

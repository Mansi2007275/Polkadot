import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });

  return (
    <div className="flex items-center gap-4">
      {isConnected && balance && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl glass border border-white/10 shadow-glow-blue/20"
        >
          <div className="relative">
             <div className="w-2 h-2 rounded-full bg-primary-blue animate-pulse" />
             <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary-blue blur-sm animate-pulse" />
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-widest text-white/20 leading-none mb-1">Paseo Native</span>
             <span className="text-sm font-bold font-space text-white leading-none">
               {parseFloat(balance.formatted).toFixed(4)} <span className="text-[10px] text-primary-blue font-mono font-black">{balance.symbol}</span>
             </span>
          </div>
        </motion.div>
      )}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-pink to-primary-purple rounded-2xl blur opacity-20 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-background rounded-2xl p-0.5 border border-white/10 group-hover:border-transparent transition-colors">
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });

  return (
    <div className="flex items-center gap-3">
      {isConnected && balance && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 border border-[#222]">
          <div className="w-1.5 h-1.5 bg-neon-green" />
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-[#666] uppercase">Paseo</span>
            <span className="text-[11px] font-mono text-white tabular-nums">
              {parseFloat(balance.formatted).toFixed(4)} <span className="text-[9px] text-[#666]">{balance.symbol}</span>
            </span>
          </div>
        </div>
      )}
      <div className="border border-[#222] p-0.5 hover:border-neon-pink transition-colors">
        <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
      </div>
    </div>
  );
}

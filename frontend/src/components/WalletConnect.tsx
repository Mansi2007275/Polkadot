import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";

/**
 * WalletConnect – renders the RainbowKit connect button with a custom wrapper
 * that also shows the user's DOT/native balance on Paseo.
 */
export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });

  return (
    <div className="flex items-center gap-3">
      {isConnected && balance && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-[#CCC]">
            {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
          </span>
        </div>
      )}
      <ConnectButton
        accountStatus="address"
        chainStatus="icon"
        showBalance={false}
      />
    </div>
  );
}

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  return (
    <div className="flex items-center gap-4">
      {isConnected && balance && (
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-pink-100 rounded-lg border-2 border-pink-400 shadow-md">
          <div className="w-2 h-2 rounded-full bg-pink-500" />
          <span className="text-base font-extrabold text-pink-700 tabular-nums" style={{ fontFamily: 'Press Start 2P, monospace', letterSpacing: '0.05em' }}>
            {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
          </span>
        </div>
      )}
      <div className="bg-pink-100 rounded-lg border-2 border-pink-400 px-3 py-1 shadow-md">
        <ConnectButton
          accountStatus="address"
          chainStatus="icon"
          showBalance={false}
        />
      </div>
    </div>
  );
}

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

/** Polkadot Hub Paseo testnet chain definition for viem/wagmi. */
export const paseo = defineChain({
  id: 420420421,
  name: "Polkadot Hub Paseo",
  nativeCurrency: {
    decimals: 18,
    name: "DOT",
    symbol: "DOT",
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_PASEO_RPC_URL || "https://paseo.rpc.polkadot.com"],
      webSocket: [import.meta.env.VITE_PASEO_WS_URL || "wss://paseo.rpc.polkadot.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout Paseo",
      url: "https://blockscout.paseo.polkadot.com",
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "Zero-Fee Micropayments",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [paseo],
  ssr: false,
});

import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { parseUnits, toHex, stringToBytes } from "viem";
import { CONTRACT_ADDRESSES, BRIDGE_ABI, ERC20_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";
import { pushPrecompileLog } from "../lib/precompileFeed";
import { mockScalePayload } from "./PrecompileMonitor";
import { motion } from "framer-motion";
import { Repeat, CheckCircle, Database, Zap, ArrowRight } from "lucide-react";

/** Well-known parachain IDs on Polkadot. */
const PARACHAINS = [
  { name: "Acala",      id: 2000, description: "DeFi hub with aUSD stablecoin" },
  { name: "Hydration",  id: 2034, description: "Omnipool DEX"                  },
  { name: "Bifrost",    id: 2030, description: "Liquid staking parachain"      },
  { name: "Moonbeam",   id: 2004, description: "EVM-compatible parachain"      },
];

export default function BridgeButton() {
  const { address } = useAccount();
  const chainId     = useChainId();
  const networkKey  = chainId === 420420421 ? "paseo" : "hardhat";

  const bridgeAddr = CONTRACT_ADDRESSES[networkKey]?.StablecoinBridge;
  const usdtAddr   = CONTRACT_ADDRESSES[networkKey]?.USDT;

  const [destParaId,   setDestParaId]   = useState<number>(2000);
  const [beneficiary,  setBeneficiary]  = useState("");
  const [amount,       setAmount]       = useState("");
  const [txStatus,     setTxStatus]     = useState<"idle" | "approving" | "bridging" | "done" | "error">("idle");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [pendingBridge, setPendingBridge] = useState<{
    amount: bigint;
    beneficiary: `0x${string}`;
    destParaId: number;
  } | null>(null);

  // ── Balances ───────────────────────────────────────────────────────────────

  const { data: bridgeBalance } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "bridgeBalance",
    args: [usdtAddr],
    query: { refetchInterval: 15_000 },
  });

  const { data: totalOut } = useReadContract({
    address: bridgeAddr,
    abi: BRIDGE_ABI,
    functionName: "totalBridgedOut",
    args: [usdtAddr],
    query: { refetchInterval: 15_000 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract: approveWrite, data: approveTx } = useWriteContract();
  const { writeContract: bridgeWrite,  data: bridgeTx  } = useWriteContract();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: bridgeSuccess  } = useWaitForTransactionReceipt({ hash: bridgeTx  });

  React.useEffect(() => {
    if (approveSuccess && txStatus === "approving" && pendingBridge) {
      setTxStatus("bridging");
      bridgeWrite({
        address: bridgeAddr,
        abi: BRIDGE_ABI,
        functionName: "bridgeToParachain",
        args: [
          usdtAddr,
          pendingBridge.amount,
          pendingBridge.destParaId,
          pendingBridge.beneficiary,
        ],
      });
    }
  }, [approveSuccess, txStatus, pendingBridge, bridgeWrite, bridgeAddr, usdtAddr]);

  React.useEffect(() => {
    if (bridgeSuccess && txStatus === "bridging") {
      setTxStatus("done");
      setPendingBridge(null);
    }
  }, [bridgeSuccess, txStatus]);

  const handleBridge = () => {
    setErrorMsg("");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Enter a valid amount"); return;
    }
    if (!beneficiary) {
      setErrorMsg("Enter a beneficiary address on the destination chain"); return;
    }

    const amountParsed = parseUnits(amount, 6);
    const beneficiaryBytes = deriveBeneficiary(beneficiary);
    setPendingBridge({ amount: amountParsed, beneficiary: beneficiaryBytes, destParaId });
    setTxStatus("approving");

    pushPrecompileLog({
      method: "bridgeToParachain",
      target: "0x800",
      payload: mockScalePayload("bridgeToParachain", {
        destParaId,
        amount: amountParsed.toString(),
        beneficiary: beneficiary.slice(0, 20) + "…",
      }),
    });

    approveWrite({
      address: usdtAddr,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [bridgeAddr, amountParsed],
    });
  };

  const isLoading = txStatus === "approving" || txStatus === "bridging";
  const selectedChain = PARACHAINS.find((p) => p.id === destParaId);

  return (
    <div className="space-y-6">
      <div className="terminal-card p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
           <div>
              <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
                 <Repeat className="w-4 h-4 text-neon-blue" />
                 XCM 0x800
              </h2>
              <p className="text-[10px] font-mono text-[#666] mt-1">
                 ReserveTransferAssets · cross-chain
              </p>
           </div>
           <div className="flex gap-4">
              <StatCard
                 label="Pool Buffer"
                 value={formatUSDT(bridgeBalance as bigint | undefined)}
                 icon={<Database className="w-4 h-4 text-white/20" />}
              />
              <StatCard
                 label="Protocol Throughput"
                 value={formatUSDT(totalOut as bigint | undefined)}
                 icon={<Zap className="w-4 h-4 text-primary-pink" />}
                 highlight
              />
           </div>
        </div>

        {/* ── Bridge Form ── */}
        <div className="relative">
          {txStatus === "done" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border border-[#222] bg-black/30"
            >
              <div className="w-12 h-12 border border-neon-pink flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-neon-pink" />
              </div>
              <p className="text-sm font-mono text-white mb-2">XCM dispatched</p>
              <p className="text-[10px] font-mono text-[#666] mb-6">
                {selectedChain?.name} · ~12s
              </p>
              <button
                onClick={() => {
                  setTxStatus("idle");
                  setPendingBridge(null);
                  setAmount("");
                  setBeneficiary("");
                }}
                className="px-6 py-2 border border-[#333] text-[11px] font-mono text-[#888] hover:border-[#444] hover:text-white"
              >
                New
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                {/* Destination Selector */}
                <div className="space-y-4">
                  <label className="block text-[9px] font-mono text-[#666] uppercase mb-2">Parachain</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PARACHAINS.map((chain) => (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => setDestParaId(chain.id)}
                        disabled={isLoading}
                        className={`p-3 text-left transition-all border ${
                          destParaId === chain.id
                            ? "border-neon-blue bg-neon-blue/10"
                            : "border-[#222] bg-black/30 text-[#666] hover:border-[#333]"
                        }`}
                      >
                        <p className={`text-[11px] font-mono ${destParaId === chain.id ? "text-white" : "text-[#666]"}`}>{chain.name}</p>
                        <p className="text-[9px] font-mono text-[#444] mt-0.5">ID: {chain.id}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 border border-[#222] bg-black/30">
                  <p className="text-[10px] font-mono text-[#666]">
                    XCM V3 · ReserveTransferAssets · 0x0800 → Relay → {selectedChain?.name}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Beneficiary */}
                <div>
                  <label className="block text-[9px] font-mono text-[#666] uppercase mb-1">Beneficiary</label>
                  <input
                    type="text"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder="0x or SS58..."
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 bg-black/50 border border-[#222] text-[11px] font-mono text-white placeholder-[#444] focus:border-neon-pink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono text-[#666] uppercase mb-1">Amount (USDT)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 bg-black/50 border border-[#222] text-[11px] font-mono text-white placeholder-[#444] focus:border-neon-pink focus:outline-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2 border border-red-500/30 bg-red-500/5 text-[10px] font-mono text-red-400">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleBridge}
                  disabled={isLoading}
                  className="w-full py-3 border border-neon-blue bg-neon-blue/10 text-neon-blue text-[11px] font-mono font-semibold uppercase tracking-wider hover:bg-neon-blue/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3.5 h-3.5 border border-[#333] border-t-white" />
                      …
                    </span>
                  ) : (
                    <>
                      Bridge → {selectedChain?.name}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="px-4 py-3 border border-[#222] bg-black/30">
       <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-[9px] font-mono text-[#666] uppercase">{label}</span>
       </div>
       <p className={`text-sm font-mono tabular-nums ${highlight ? "text-neon-pink" : "text-white"}`}>
          {value} <span className="text-[9px] text-[#666]">USDT</span>
       </p>
    </div>
  );
}

/** Convert a beneficiary string to bytes32 for the smart contract. */
function deriveBeneficiary(input: string): `0x${string}` {
  if (input.startsWith("0x") && input.length === 66) {
    return input as `0x${string}`;
  }
  if (input.startsWith("0x") && input.length === 42) {
    return `0x${input.slice(2).padStart(64, "0")}` as `0x${string}`;
  }
  const bytes = stringToBytes(input.slice(0, 32).padEnd(32, "\0"));
  return toHex(bytes) as `0x${string}`;
}

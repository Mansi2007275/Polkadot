import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { parseUnits, toHex, stringToBytes, isAddress } from "viem";
import { CONTRACT_ADDRESSES, BRIDGE_ABI, ERC20_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";
import { motion, AnimatePresence } from "framer-motion";
import { Repeat, ArrowRightLeft, Globe, Send, CheckCircle, Info, Database, Zap, ArrowRight } from "lucide-react";

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
    if (approveSuccess && txStatus === "approving") {
      setTxStatus("bridging");
      const beneficiaryBytes = deriveBeneficiary(beneficiary);
      bridgeWrite({
        address: bridgeAddr,
        abi: BRIDGE_ABI,
        functionName: "bridgeToParachain",
        args: [
          usdtAddr,
          parseUnits(amount, 6),
          destParaId,
          beneficiaryBytes,
        ],
      });
    }
  }, [approveSuccess]);

  React.useEffect(() => {
    if (bridgeSuccess && txStatus === "bridging") {
      setTxStatus("done");
    }
  }, [bridgeSuccess]);

  const handleBridge = () => {
    setErrorMsg("");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Enter a valid amount"); return;
    }
    if (!beneficiary) {
      setErrorMsg("Enter a beneficiary address on the destination chain"); return;
    }

    const amountParsed = parseUnits(amount, 6);
    setTxStatus("approving");
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ── Bridge Header & Stats ── */}
      <div className="glass p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-blue/5 blur-[100px] -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
           <div>
              <h2 className="text-3xl font-bold font-space flex items-center gap-4">
                 <Repeat className="w-8 h-8 text-primary-blue" />
                 XCM Asset Bridge
              </h2>
              <p className="text-white/40 mt-3 max-w-xl font-inter leading-relaxed">
                 Seamlessly transfer USDT between Polkadot Hub and integrated Parachains using 
                 trustless Cross-Consensus Messaging (XCM) precompiles.
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 bg-white/[0.02] border border-white/5 rounded-[32px]"
            >
              <div className="w-24 h-24 rounded-full bg-primary-pink/10 border border-primary-pink/30 flex items-center justify-center mx-auto mb-8 shadow-glow-pink">
                <CheckCircle className="w-12 h-12 text-primary-pink" />
              </div>
              <h3 className="text-3xl font-bold font-space mb-3 text-white">XCM Message Dispatched</h3>
              <p className="text-white/40 text-sm mb-10 max-w-md mx-auto leading-relaxed">
                Tokens are currently traversing the relay chain. Estimated arrival on {selectedChain?.name} in <span className="text-white font-bold">12 seconds</span>.
              </p>
              <button
                onClick={() => setTxStatus("idle")}
                className="px-12 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold font-space hover:bg-white/10 transition-all active:scale-95"
              >
                Send Another Artifact
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                {/* Destination Selector */}
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Terminal Parachain</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PARACHAINS.map((chain) => (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => setDestParaId(chain.id)}
                        disabled={isLoading}
                        className={`p-4 rounded-2xl text-left transition-all border ${
                          destParaId === chain.id
                            ? "bg-primary-blue/10 border-primary-blue/40 shadow-glow-blue/10"
                            : "bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20"
                        }`}
                      >
                        <p className={`text-sm font-bold font-space ${destParaId === chain.id ? 'text-white' : 'text-white/40'}`}>{chain.name}</p>
                        <p className="text-[10px] font-mono mt-1 opacity-60">ID: {chain.id}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* XCM Architecture Card */}
                <div className="p-6 rounded-[24px] bg-white/[0.03] border border-white/5 space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                         <Globe className="w-5 h-5 text-white/40" />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-white">Cross-Chain Precompile</p>
                         <p className="text-[10px] text-white/20 font-mono">XCM V3 · ReserveTransferAssets</p>
                      </div>
                   </div>
                   <p className="text-[10px] text-white/40 leading-relaxed italic">
                      Automated execution via <code className="text-primary-blue">0x...0800</code>. Tokens travel from Polkadot Hub → Relay → {selectedChain?.name}.
                   </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Beneficiary */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Destination Beneficiary</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                      placeholder="SS58 or Hex address..."
                      disabled={isLoading}
                      className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/10 focus:border-primary-pink/50 focus:bg-white/[0.05] focus:outline-none focus:shadow-glow-pink transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Asset Quantity</label>
                  <div className="relative group">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      disabled={isLoading}
                      className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/10 focus:border-primary-purple/50 focus:bg-white/[0.05] focus:outline-none focus:shadow-glow-purple transition-all font-space font-bold pr-16"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black">USDT</span>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-bold uppercase tracking-widest text-center">
                    {errorMsg}
                  </div>
                )}

                {/* Submit Action */}
                <button
                  onClick={handleBridge}
                  disabled={isLoading}
                  className="w-full py-5 rounded-[24px] bg-gradient-to-r from-primary-blue via-primary-purple to-primary-pink text-white font-bold font-space uppercase tracking-[0.2em] shadow-xl hover:shadow-glow-blue transition-all active:scale-95 disabled:opacity-50 group"
                >
                  {isLoading ? (
                     <span className="flex items-center justify-center gap-3">
                       <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
                       Synchronizing...
                     </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                       Bridge to {selectedChain?.name}
                       <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
                
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                   <Info className="w-4 h-4 text-white/20" />
                   <p className="text-[10px] text-white/20 uppercase font-bold tracking-tight">Small XCM delivery fee will be deducted by the target chain.</p>
                </div>
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
    <div className="px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
       <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">{label}</span>
       </div>
       <p className={`text-lg font-bold font-space ${highlight ? 'text-primary-pink' : 'text-white'}`}>
          {value} <span className="text-[10px] text-white/20 font-mono">USDT</span>
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

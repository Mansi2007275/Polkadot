import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { parseUnits, toHex, stringToBytes, isAddress } from "viem";
import { CONTRACT_ADDRESSES, BRIDGE_ABI, ERC20_ABI } from "../config/contracts";
import { formatUSDT } from "../hooks/useStream";

/** Well-known parachain IDs on Polkadot. */
const PARACHAINS = [
  { name: "Acala",      id: 2000, description: "DeFi hub with aUSD stablecoin" },
  { name: "Hydration",  id: 2034, description: "Omnipool DEX"                  },
  { name: "Bifrost",    id: 2030, description: "Liquid staking parachain"      },
  { name: "Moonbeam",   id: 2004, description: "EVM-compatible parachain"      },
];

/**
 * BridgeButton – UI for bridging USDT between Polkadot Hub and parachains
 * via the StablecoinBridge contract and XCM precompiles.
 */
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
      // Derive bytes32 beneficiary from SS58 or hex address
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
    <div className="space-y-6">
      {/* ── Bridge Stats ── */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-1">XCM Stablecoin Bridge</h2>
        <p className="text-sm text-[#888] mb-6">
          Bridge USDT from Polkadot Hub to any parachain using XCM precompiles.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-xs text-[#555] mb-1">Bridge Liquidity</p>
            <p className="text-sm font-semibold text-white">
              {formatUSDT(bridgeBalance as bigint | undefined)} USDT
            </p>
          </div>
          <div className="px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-xs text-[#555] mb-1">Total Bridged Out</p>
            <p className="text-sm font-semibold text-[#E6007A]">
              {formatUSDT(totalOut as bigint | undefined)} USDT
            </p>
          </div>
        </div>
      </div>

      {/* ── Bridge Form ── */}
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
        <h3 className="text-base font-semibold mb-5">Bridge USDT to Parachain</h3>

        {txStatus === "done" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🌉</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-green-400">XCM Message Sent!</h3>
            <p className="text-[#888] text-sm mb-6">
              Your USDT is being bridged. It will arrive on {selectedChain?.name ?? "the destination"}
              {" "}within 1-2 blocks (~12 seconds on Paseo).
            </p>
            <button
              onClick={() => setTxStatus("idle")}
              className="px-6 py-2 rounded-lg bg-[#E6007A] text-white font-medium"
            >
              Bridge More
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Destination Parachain */}
            <div>
              <label className="block text-sm text-[#888] mb-2">Destination Parachain</label>
              <div className="grid grid-cols-2 gap-2">
                {PARACHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setDestParaId(chain.id)}
                    disabled={isLoading}
                    className={`px-4 py-3 rounded-xl text-left transition-all ${
                      destParaId === chain.id
                        ? "bg-[#E6007A]/20 border border-[#E6007A]/60 text-white"
                        : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white hover:border-[#444]"
                    }`}
                  >
                    <p className="text-sm font-medium">{chain.name}</p>
                    <p className="text-xs text-[#555] mt-0.5">Para ID: {chain.id}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Beneficiary */}
            <div>
              <label className="block text-sm text-[#888] mb-1.5">
                Beneficiary (32-byte hex or SS58 address on {selectedChain?.name})
              </label>
              <input
                type="text"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="0x... or 5Grwva..."
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm text-[#888] mb-1.5">Amount (USDT)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10"
                  min="0"
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#888]">USDT</span>
              </div>
            </div>

            {/* XCM info */}
            <div className="px-4 py-3 rounded-xl bg-[#0A0A1A] border border-[#1A1A3A]">
              <p className="text-xs text-[#6A6A9F] font-medium mb-1">XCM Precompile: 0x0000…0800</p>
              <p className="text-xs text-[#555]">
                Uses <code className="font-mono text-[#888]">xcmSend()</code> with
                ReserveTransferAssets to {selectedChain?.name} (Para {destParaId}).
                Fees are deducted from the transferred amount.
              </p>
            </div>

            {errorMsg && (
              <div className="px-4 py-3 rounded-xl bg-[#1A0A0A] border border-[#3A1A1A]">
                <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1A1A1A]">
                <div className="w-4 h-4 border-2 border-[#E6007A] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#888]">
                  {txStatus === "approving" ? "Approving token spend…" : "Sending XCM message…"}
                </p>
              </div>
            )}

            <button
              onClick={handleBridge}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#E6007A] text-white font-semibold hover:bg-[#CC006A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing…" : `Bridge to ${selectedChain?.name ?? "Parachain"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Convert a beneficiary string to bytes32 for the smart contract. */
function deriveBeneficiary(input: string): `0x${string}` {
  if (input.startsWith("0x") && input.length === 66) {
    return input as `0x${string}`;
  }
  if (input.startsWith("0x") && input.length === 42) {
    // Pad EVM address to bytes32
    return `0x${input.slice(2).padStart(64, "0")}` as `0x${string}`;
  }
  // Encode arbitrary string to bytes32
  const bytes = stringToBytes(input.slice(0, 32).padEnd(32, "\0"));
  return toHex(bytes) as `0x${string}`;
}

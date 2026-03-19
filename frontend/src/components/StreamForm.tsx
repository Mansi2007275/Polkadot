import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress, parseUnits } from "viem";
import { useCreateStream, useUSDTBalance, formatUSDT } from "../hooks/useStream";
import { useWaitForTransactionReceipt } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { pushPrecompileLog } from "../lib/precompileFeed";
import { mockScalePayload } from "./PrecompileMonitor";

type Step = "idle" | "approving" | "approved" | "creating" | "done" | "error";

export default function StreamForm() {
  const { address } = useAccount();
  const { data: usdtBalance } = useUSDTBalance(address);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("86400");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingParams, setPendingParams] = useState<{
    recipient: `0x${string}`;
    depositUsdt: string;
    durationSeconds: bigint;
  } | null>(null);

  const { approve, createStream, approveTxHash, createTxHash, isApproving, isCreating } =
    useCreateStream();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createTxHash });

  React.useEffect(() => {
    if (approveSuccess && step === "approving" && pendingParams) {
      setStep("approved");
      createStream(pendingParams);
      setStep("creating");
    }
  }, [approveSuccess, step, pendingParams, createStream]);

  React.useEffect(() => {
    if (createSuccess && step === "creating") {
      setStep("done");
      setPendingParams(null);
    }
  }, [createSuccess, step]);

  const validate = (): boolean => {
    if (!isAddress(recipient)) {
      setErrorMsg("Invalid address");
      return false;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Invalid amount");
      return false;
    }
    if (!duration || isNaN(Number(duration)) || Number(duration) < 60) {
      setErrorMsg("Duration >= 60s");
      return false;
    }
    const deposit = BigInt(Math.floor(Number(amount) * 1e6));
    if (deposit % BigInt(duration) !== 0n) {
      setErrorMsg("Deposit must divide evenly by duration");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const params = {
      recipient: recipient as `0x${string}`,
      depositUsdt: amount,
      durationSeconds: BigInt(duration),
    };
    setPendingParams(params);
    setStep("approving");
    approve(params);

    pushPrecompileLog({
      method: "createStream",
      target: "0x802",
      payload: mockScalePayload("createStream", {
        recipient,
        deposit: parseUnits(amount, 6).toString(),
        durationSeconds: duration,
      }),
    });
  };

  const resetForm = () => {
    setRecipient("");
    setAmount("");
    setDuration("86400");
    setStep("idle");
    setErrorMsg("");
    setPendingParams(null);
  };

  const isLoading = step === "approving" || step === "creating" || isApproving || isCreating;

  const durationOptions = [
    { label: "1H", value: "3600" },
    { label: "1D", value: "86400" },
    { label: "1W", value: "604800" },
    { label: "1M", value: "2592000" },
  ];

  const hasPreview = recipient && amount && duration && Number(amount) > 0 && Number(duration) > 0;
  const scalePayload = hasPreview
    ? mockScalePayload("createStream", {
        recipient,
        deposit: parseUnits(amount, 6).toString(),
        durationSeconds: duration,
      })
    : "";

  return (
    <div className="terminal-card p-6">
      <div className="mb-6">
        <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-neon-pink" />
          Create Stream
        </h2>
        <p className="text-[10px] font-mono text-[#666] mt-1">
          Sablier-variant · REVM
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 p-3 bg-black/50 border border-[#222]">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#666]" />
          <span className="text-[10px] font-mono text-[#666] uppercase">Balance</span>
        </div>
        <span className="text-sm font-mono text-white tabular-nums">
          {formatUSDT(usdtBalance)} <span className="text-[10px] text-[#666]">USDT</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === "done" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-12 h-12 border border-neon-pink flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-neon-pink" />
            </div>
            <p className="text-[11px] font-mono text-white mb-6">Stream initialized</p>
            <button
              onClick={resetForm}
              className="px-6 py-2 border border-[#333] text-[11px] font-mono text-[#888] hover:border-[#444] hover:text-white transition-colors"
            >
              New
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="block text-[9px] font-mono text-[#666] uppercase mb-1">Recipient</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2.5 bg-black/50 border border-[#222] text-[11px] font-mono text-white placeholder-[#444] focus:border-neon-pink focus:outline-none"
                disabled={isLoading}
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
                step="1"
                className="w-full px-3 py-2.5 bg-black/50 border border-[#222] text-[11px] font-mono text-white placeholder-[#444] focus:border-neon-pink focus:outline-none"
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-mono text-[#666] uppercase">Duration</label>
                <div className="flex gap-1">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`px-2 py-0.5 text-[9px] font-mono transition-colors ${
                        duration === opt.value
                          ? "border border-neon-blue text-neon-blue"
                          : "border border-[#222] text-[#666] hover:text-[#888]"
                      }`}
                      disabled={isLoading}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Clock className="w-3 h-3 text-[#444]" />
                </div>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="86400"
                  className="w-full pl-8 pr-3 py-2.5 bg-black/50 border border-[#222] text-[11px] font-mono text-white placeholder-[#444] focus:border-neon-pink focus:outline-none"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Technical Preview — SCALE-encoded bytes */}
            <AnimatePresence>
              {hasPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-black border border-[#222] border-l-2 border-l-neon-pink"
                >
                  <p className="text-[9px] font-mono text-neon-pink uppercase mb-2">Technical Preview</p>
                  <p className="text-[10px] font-mono text-[#666] break-all leading-relaxed">
                    {scalePayload}
                  </p>
                  <p className="text-[9px] font-mono text-[#444] mt-2">
                    createStream calldata · bridge helpers
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {errorMsg && (
              <div className="p-2 border border-red-500/30 bg-red-500/5 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-[10px] font-mono text-red-400">{errorMsg}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 text-neon-pink animate-spin" />
                <p className="text-[10px] font-mono text-[#666]">
                  {step === "approving" ? "Approve…" : "Create…"}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 border border-neon-pink bg-neon-pink/10 text-neon-pink text-[11px] font-mono font-semibold uppercase tracking-wider hover:bg-neon-pink/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "…" : "Deploy Stream"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { useCreateStream, useUSDTBalance, formatUSDT } from "../hooks/useStream";
import { useWaitForTransactionReceipt } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, Clock, CheckCircle, AlertCircle, Info, Loader2 } from "lucide-react";

type Step = "idle" | "approving" | "approved" | "creating" | "done" | "error";

export default function StreamForm() {
  const { address } = useAccount();
  const { data: usdtBalance } = useUSDTBalance(address);

  const [recipient, setRecipient]   = useState("");
  const [amount, setAmount]         = useState("");
  const [duration, setDuration]     = useState("86400"); // 1 day default
  const [step, setStep]             = useState<Step>("idle");
  const [errorMsg, setErrorMsg]     = useState("");

  const { approve, createStream, approveTxHash, createTxHash, isApproving, isCreating } =
    useCreateStream();

  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: createSuccess }  = useWaitForTransactionReceipt({ hash: createTxHash  });

  // Watch for approve confirmation → auto-submit create
  React.useEffect(() => {
    if (approveSuccess && step === "approving") {
      setStep("approved");
      createStream({
        recipient: recipient as `0x${string}`,
        depositUsdt: amount,
        durationSeconds: BigInt(duration),
      });
      setStep("creating");
    }
  }, [approveSuccess]);

  React.useEffect(() => {
    if (createSuccess && step === "creating") {
      setStep("done");
    }
  }, [createSuccess]);

  const validate = (): boolean => {
    if (!isAddress(recipient)) { setErrorMsg("Invalid recipient address"); return false; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Enter a valid USDT amount"); return false;
    }
    if (!duration || isNaN(Number(duration)) || Number(duration) < 60) {
      setErrorMsg("Duration must be at least 60 seconds"); return false;
    }
    const deposit = BigInt(Math.floor(Number(amount) * 1e6));
    if (deposit % BigInt(duration) !== 0n) {
      setErrorMsg("Deposit must be exactly divisible by duration in seconds");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStep("approving");
    approve({
      recipient: recipient as `0x${string}`,
      depositUsdt: amount,
      durationSeconds: BigInt(duration),
    });
  };

  const resetForm = () => {
    setRecipient("");
    setAmount("");
    setDuration("86400");
    setStep("idle");
    setErrorMsg("");
  };

  const isLoading = step === "approving" || step === "creating" || isApproving || isCreating;

  const durationOptions = [
    { label: "1H",  value: "3600"    },
    { label: "1D",   value: "86400"   },
    { label: "1W",  value: "604800"  },
    { label: "1M", value: "2592000" },
  ];

  return (
    <div className="glass p-8 rounded-[32px] border border-white/10 shadow-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-space flex items-center gap-3">
           <Send className="w-6 h-6 text-primary-pink" />
           Initiate Asset Flow
        </h2>
        <p className="text-sm text-white/40 mt-1 font-inter">
          Stream assets continuously. <span className="text-primary-blue font-bold">Gas Substitute active.</span>
        </p>
      </div>

      {/* USDT Balance */}
      <div className="flex justify-between items-center mb-8 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/5">
        <div className="flex items-center gap-2">
           <Wallet className="w-4 h-4 text-white/20" />
           <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Available Liquidity</span>
        </div>
        <span className="text-lg font-bold font-space text-white">
          {formatUSDT(usdtBalance)} <span className="text-[10px] text-white/20 uppercase font-mono">USDT</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === "done" ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <div className="w-20 h-20 rounded-full bg-primary-pink/10 border border-primary-pink/30 flex items-center justify-center mx-auto mb-6 shadow-glow-pink">
              <CheckCircle className="w-10 h-10 text-primary-pink" />
            </div>
            <h3 className="text-2xl font-bold font-space mb-2 text-white">Flow Initialized</h3>
            <p className="text-white/40 text-sm mb-8 max-w-[240px] mx-auto leading-relaxed">
              Assets are now streaming autonomously through the protocol.
            </p>
            <button
              onClick={resetForm}
              className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold font-space hover:bg-white/10 transition-all active:scale-95"
            >
              Start New Flow
            </button>
          </motion.div>
        ) : (
          <motion.form 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit} 
            className="space-y-6"
          >
            {/* Recipient */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Recipient Node Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/10 focus:border-primary-pink/50 focus:bg-white/[0.05] focus:outline-none focus:shadow-glow-pink transition-all"
                disabled={isLoading}
              />
            </div>

            {/* Total USDT Deposit */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Asset Allocation</label>
              <div className="relative group">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="1"
                  className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/10 focus:border-primary-purple/50 focus:bg-white/[0.05] focus:outline-none focus:shadow-glow-purple transition-all pr-16 font-space font-bold"
                  disabled={isLoading}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black uppercase tracking-widest">
                  USDT
                </span>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                 <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Temporal Duration</label>
                 <div className="flex gap-1.5">
                    {durationOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDuration(opt.value)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          duration === opt.value
                            ? "bg-primary-blue text-white shadow-glow-blue"
                            : "bg-white/5 text-white/30 hover:text-white/60"
                        }`}
                        disabled={isLoading}
                      >
                        {opt.label}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                   <Clock className="w-4 h-4 text-white/10" />
                </div>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Seconds..."
                  className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder-white/10 focus:border-primary-blue/50 focus:bg-white/[0.05] focus:outline-none focus:shadow-glow-blue transition-all font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Rate Preview */}
            <AnimatePresence>
              {amount && duration && Number(amount) > 0 && Number(duration) > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 py-4 rounded-2xl bg-primary-pink/5 border border-primary-pink/10 shadow-inner overflow-hidden"
                >
                  <p className="text-[10px] text-primary-pink font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                     <span className="w-1.5 h-1.5 bg-primary-pink animate-pulse" />
                     Estimated Velocity
                  </p>
                  <p className="text-xl font-bold font-space text-white">
                    {(Number(amount) / (Number(duration) / 86400)).toFixed(4)} <span className="text-xs text-white/20 font-normal ml-1 lowercase font-inter">usdt / day</span>
                  </p>
                  <p className="text-[10px] text-white/10 mt-1 uppercase font-mono italic">
                    ≈ {(Number(amount) / Number(duration)).toFixed(8)} per second
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subsidy Info */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-full bg-primary-blue/10 flex items-center justify-center flex-shrink-0">
                 <Info className="w-4 h-4 text-primary-blue" />
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-tighter leading-tight font-bold">
                 Substitute layer detected — Transaction costs <span className="text-primary-blue">waived</span> via protocol staking.
              </p>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400 font-bold uppercase tracking-widest">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Footer */}
            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-2">
                <Loader2 className="w-4 h-4 text-primary-pink animate-spin" />
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                  {step === "approving" ? "Awaiting Authorization..." : "Finalizing Stream Logic..."}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary-pink via-primary-purple to-primary-blue text-white font-bold font-space uppercase tracking-[0.15em] shadow-xl hover:shadow-glow-pink transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-100 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                 <span className="flex items-center justify-center gap-3">
                   <Loader2 className="w-5 h-5 animate-spin" />
                   Processing
                 </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                   Deploy Stream
                </span>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

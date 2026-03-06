import React, { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { useCreateStream, useUSDTBalance, formatUSDT } from "../hooks/useStream";
import { useWaitForTransactionReceipt } from "wagmi";

type Step = "idle" | "approving" | "approved" | "creating" | "done" | "error";

/**
 * StreamForm – lets the connected user create a new payment stream.
 * Flow: Approve USDT → Create Stream
 */
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
    { label: "1 Hour",  value: "3600"    },
    { label: "1 Day",   value: "86400"   },
    { label: "1 Week",  value: "604800"  },
    { label: "1 Month", value: "2592000" },
  ];

  return (
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-1">Create Stream</h2>
      <p className="text-sm text-[#888] mb-6">
        Stream USDT continuously to any address.{" "}
        <span className="text-[#E6007A]">Gas covered by yield pool.</span>
      </p>

      {/* USDT Balance */}
      <div className="flex justify-between items-center mb-5 px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
        <span className="text-sm text-[#888]">Your USDT Balance</span>
        <span className="text-sm font-medium text-white">
          {formatUSDT(usdtBalance)} USDT
        </span>
      </div>

      {step === "done" ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 text-green-400">Stream Created!</h3>
          <p className="text-[#888] text-sm mb-6">
            Tokens are now flowing continuously to the recipient.
          </p>
          <button
            onClick={resetForm}
            className="px-6 py-2 rounded-lg bg-[#E6007A] text-white font-medium hover:bg-[#CC006A] transition-colors"
          >
            Create Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors"
              disabled={isLoading}
            />
          </div>

          {/* Total USDT Deposit */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">Total USDT Deposit</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                min="0"
                step="1"
                className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors pr-16"
                disabled={isLoading}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#888] font-medium">
                USDT
              </span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">Duration</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all ${
                    duration === opt.value
                      ? "bg-[#E6007A] text-white"
                      : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white hover:border-[#444]"
                  }`}
                  disabled={isLoading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Duration in seconds"
              className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:border-[#E6007A] focus:outline-none transition-colors"
              disabled={isLoading}
            />
          </div>

          {/* Rate Preview */}
          {amount && duration && Number(amount) > 0 && Number(duration) > 0 && (
            <div className="px-4 py-3 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E]">
              <p className="text-xs text-[#666] mb-1">Streaming rate</p>
              <p className="text-sm font-medium text-[#E6007A]">
                {(Number(amount) / (Number(duration) / 86400)).toFixed(6)} USDT / day
              </p>
              <p className="text-xs text-[#555] mt-1">
                = {(Number(amount) / Number(duration)).toFixed(8)} USDT / second
              </p>
            </div>
          )}

          {/* Subsidy notice */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0A1A0A] border border-[#1A3A1A]">
            <span className="text-sm">⛽</span>
            <p className="text-xs text-[#6A9F6A]">
              Gas fees for this transaction are covered by the yield pool — you pay zero fees.
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="px-4 py-3 rounded-xl bg-[#1A0A0A] border border-[#3A1A1A]">
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Step indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
              <div className="w-4 h-4 border-2 border-[#E6007A] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#888]">
                {step === "approving" ? "Approving USDT…" : "Creating stream…"}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#E6007A] text-white font-semibold hover:bg-[#CC006A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing…" : "Create Stream"}
          </button>
        </form>
      )}
    </div>
  );
}

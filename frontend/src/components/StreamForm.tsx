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
    // No strict divisibility check to allow arbitrary (e.g. 1 USDT / 1 Day)
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
    <div className="p-6 rounded-2xl border-4 border-black bg-white shadow-xl ring-2 ring-pink-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Stream</h2>
      <p className="text-sm text-gray-500 mb-6">Sablier-variant · REVM</p>

      <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">Balance</span>
        </div>
        <span className="text-sm font-medium text-gray-900 tabular-nums">
          {formatUSDT(usdtBalance)} <span className="text-gray-500">USDT</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === "done" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm text-gray-900 mb-6">Stream initialized</p>
            <button
              onClick={resetForm}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USDT)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">Duration</label>
                <div className="flex gap-1">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        duration === opt.value
                          ? "bg-indigo-100 text-indigo-700 font-medium"
                          : "text-gray-500 hover:bg-gray-100"
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
                  <Clock className="w-3 h-3 text-gray-500" />
                </div>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="86400"
                  className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg border-l-4 border-l-indigo-500"
                >
                  <p className="text-xs font-medium text-indigo-600 mb-2">Technical Preview</p>
                  <p className="text-xs font-mono text-gray-600 break-all leading-relaxed">
                    {scalePayload}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    createStream calldata · bridge helpers
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {errorMsg && (
              <div className="p-3 border border-red-200 bg-red-50 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-3">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <p className="text-sm text-gray-500">
                  {step === "approving" ? "Approve…" : "Create…"}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-pink-600 text-white text-sm font-extrabold rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-pink-600"
            >
              {isLoading ? "…" : "Deploy Stream"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

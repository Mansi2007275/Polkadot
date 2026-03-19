import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** SVG flow: Yield particles moving from Staking Precompile (0x801) → Subsidy Pool */
export function YieldFlowSvg({ className }: { className?: string }) {
  const [particles, setParticles] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) => [...prev.slice(-6), Date.now()]);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative h-20 w-full bg-black/60 border border-[#222] overflow-hidden ${className ?? ""}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGradY" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E6007A" />
            <stop offset="100%" stopColor="#0070F3" />
          </linearGradient>
        </defs>
        {/* Animated dashed path */}
        <motion.path
          d="M 30 40 Q 120 20 200 40 T 370 40"
          fill="transparent"
          stroke="url(#flowGradY)"
          strokeWidth="2"
          strokeDasharray="10 8"
          initial={{ strokeDashoffset: 36 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        />
      </svg>
      {/* Floating particles */}
      <AnimatePresence>
        {particles.map((id) => (
          <motion.div
            key={id}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-neon-pink"
            initial={{ left: "8%", opacity: 0 }}
            animate={{ left: "92%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
            style={{ zIndex: 2 }}
          />
        ))}
      </AnimatePresence>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
          0x801 → SubsidyPool · gas covered
        </span>
      </div>
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <span className="text-[9px] font-mono text-neon-pink">0x801</span>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <span className="text-[9px] font-mono text-neon-blue">Pool</span>
      </div>
    </div>
  );
}

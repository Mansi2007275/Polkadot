import React from "react";

export function YieldFlowSvg({ className = "" }: { className?: string }) {
  return (
    <div className={`h-16 flex items-center justify-center ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="font-mono">0x801</span>
        <span>→</span>
        <span>SubsidyPool</span>
        <span className="text-gray-400">· gas covered</span>
      </div>
    </div>
  );
}

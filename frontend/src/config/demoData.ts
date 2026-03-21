import { parseUnits } from "viem";
import { StreamData } from "../hooks/useStream";

export const DEMO_STREAM_ID = 888n;

export const DEMO_DATA = {
  // Mock Stream for Dashboard
  stream: {
    sender: "0xE6007A0000000000000000000000000000000000" as `0x${string}`,
    recipient: "0x0070F30000000000000000000000000000000000" as `0x${string}`,
    token: "0x1984000000000000000000000000000000000000" as `0x${string}`,
    deposit: parseUnits("5000", 6),
    ratePerSecond: 57870n, // ~5 USDT/day
    startTime: BigInt(Math.floor(Date.now() / 1000) - 3600 * 12), // Started 12h ago
    stopTime: BigInt(Math.floor(Date.now() / 1000) + 3600 * 24 * 7), // Ends in 7 days
    withdrawn: parseUnits("120", 6),
    status: 0 as const,
  } as StreamData,

  // Mock Pool Stats for SubsidyPoolStatus
  pool: {
    totalDeposited: parseUnits("2450000", 6),    // $2.45M
    poolBalance: parseUnits("185000", 6),       // $185k internal buffer
    totalSubsidisedTxns: 12450n,
    totalGasCovered: 845000000000n,             // ~42k DOT worth of gas
    currentApyBps: 1250n,                       // 12.5%
    dynamicApyBps: 1320n,                       // 13.2% (live)
    realYieldReceived: parseUnits("12500", 6),  // $12.5k swept
  },

  // Mock Staking Stats (Precompile 0x801)
  staking: [
    parseUnits("420", 18),    // Pending Rewards (DOT)
    parseUnits("15000", 18),  // Total Staked (DOT)
    parseUnits("8500", 18),   // Total Swept (DOT)
    BigInt(Math.floor(Date.now() / 1000) - 300) // Last Sync (5 min ago)
  ] as [bigint, bigint, bigint, bigint],

  // Mock User Position
  myPosition: {
    deposit: [parseUnits("1000", 6)],
    shareBps: 450n, // 4.5%
    pendingYield: parseUnits("12", 6),
  }
};

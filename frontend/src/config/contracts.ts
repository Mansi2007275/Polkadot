import { Address } from "viem";

/** Contract addresses – update after deploying to Paseo. */
export const CONTRACT_ADDRESSES: Record<string, Record<string, Address>> = {
  paseo: {
    MicropaymentStream: (import.meta.env.VITE_STREAM_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    SubsidyPool:        (import.meta.env.VITE_SUBSIDY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    StablecoinBridge:   (import.meta.env.VITE_BRIDGE_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    USDT:               (import.meta.env.VITE_USDT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  },
  hardhat: {
    MicropaymentStream: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address,
    SubsidyPool:        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address,
    StablecoinBridge:   "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address,
    USDT:               "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// ABIs
// ───────────────────────────────────────────────────────────────────────────

export const STREAM_ABI = [
  // Views
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "getStream",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sender",        type: "address" },
          { name: "recipient",     type: "address" },
          { name: "token",         type: "address" },
          { name: "deposit",       type: "uint256" },
          { name: "ratePerSecond", type: "uint256" },
          { name: "startTime",     type: "uint256" },
          { name: "stopTime",      type: "uint256" },
          { name: "withdrawn",     type: "uint256" },
          { name: "status",        type: "uint8"   },
        ],
      },
    ],
  },
  {
    name: "nextStreamId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Writes
  {
    name: "createStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient",  type: "address" },
      { name: "deposit",    type: "uint256" },
      { name: "token",      type: "address" },
      { name: "startTime",  type: "uint256" },
      { name: "stopTime",   type: "uint256" },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
  },
  {
    name: "withdrawFromStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "streamId", type: "uint256" },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "pauseStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "resumeStream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    name: "StreamCreated",
    type: "event",
    inputs: [
      { name: "streamId",      type: "uint256", indexed: true  },
      { name: "sender",        type: "address", indexed: true  },
      { name: "recipient",     type: "address", indexed: true  },
      { name: "token",         type: "address", indexed: false },
      { name: "deposit",       type: "uint256", indexed: false },
      { name: "startTime",     type: "uint256", indexed: false },
      { name: "stopTime",      type: "uint256", indexed: false },
      { name: "ratePerSecond", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StreamWithdrawn",
    type: "event",
    inputs: [
      { name: "streamId",      type: "uint256", indexed: true  },
      { name: "recipient",     type: "address", indexed: true  },
      { name: "amount",        type: "uint256", indexed: false },
      { name: "gasSubsidised", type: "bool",    indexed: false },
    ],
  },
  {
    name: "StreamCancelled",
    type: "event",
    inputs: [
      { name: "streamId",        type: "uint256", indexed: true  },
      { name: "sender",          type: "address", indexed: true  },
      { name: "senderRefund",    type: "uint256", indexed: false },
      { name: "recipientAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const SUBSIDY_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimYield",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "pendingYield",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "depositor", type: "address" }],
    outputs: [{ name: "pending", type: "uint256" }],
  },
  {
    name: "poolBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSubsidisedTxns",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalGasCovered",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "depositors",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "amount",           type: "uint256" },
      { name: "shares",           type: "uint256" },
      { name: "rewardDebt",       type: "uint256" },
      { name: "depositTimestamp", type: "uint256" },
    ],
  },
  {
    name: "totalDeposited",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "BASE_YIELD_BPS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "depositorShareBps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "depositor", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const BRIDGE_ABI = [
  {
    name: "bridgeToParachain",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",       type: "address" },
      { name: "amount",      type: "uint256" },
      { name: "destParaId",  type: "uint32"  },
      { name: "beneficiary", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "totalBridgedOut",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBridgedIn",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "bridgeBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "BridgeOutInitiated",
    type: "event",
    inputs: [
      { name: "token",       type: "address", indexed: true  },
      { name: "sender",      type: "address", indexed: true  },
      { name: "destParaId",  type: "uint32",  indexed: false },
      { name: "beneficiary", type: "bytes32", indexed: true  },
      { name: "amount",      type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

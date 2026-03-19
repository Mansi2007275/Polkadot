import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const PASEO_RPC    = process.env.PASEO_RPC_URL || "https://paseo.rpc.polkadot.com";
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "london",
    },
  },

  networks: {
    // -------------------------------------------------------------------------
    // Polkadot Hub Paseo Testnet
    // -------------------------------------------------------------------------
    paseo: {
      url: PASEO_RPC,
      chainId: 420420417, // Polkadot Hub Paseo EVM chain id
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 120_000,
    },

    // -------------------------------------------------------------------------
    // Local Hardhat network (for testing)
    // -------------------------------------------------------------------------
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
      blockGasLimit: 30_000_000,
    },

    // -------------------------------------------------------------------------
    // Optional: local node (e.g. zombienet or chopsticks fork of Paseo)
    // -------------------------------------------------------------------------
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },

  etherscan: {
    apiKey: {
      paseo: ETHERSCAN_KEY,
    },
    customChains: [
      {
        network: "paseo",
        chainId: 420420417,
        urls: {
          apiURL: "https://blockscout.paseo.polkadot.com/api",
          browserURL: "https://blockscout.paseo.polkadot.com",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },


};

export default config;

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "london",
    },
  },
  networks: {
    hardhat: {
      chainId: 420420417,
    },
    paseo: {
      chainId: 420420417,
      url: process.env.PASEO_RPC_URL || "https://eth-rpc-testnet.polkadot.io/",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasMultiplier: 1.2,
    },
  },
  etherscan: {
    apiKey: { paseo: "no-api-key-needed" },
    customChains: [{
      network: "paseo",
      chainId: 420420417,
      urls: {
        apiURL:     "https://blockscout-testnet.polkadot.io/api",
        browserURL: "https://blockscout-testnet.polkadot.io",
      },
    }],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    outputFile: "test/results/gas-report.txt",
    noColors: true,
  },
};

export default config;

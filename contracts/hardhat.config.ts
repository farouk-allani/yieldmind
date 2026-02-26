import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const HEDERA_PRIVATE_KEY_HEX = process.env.HEDERA_PRIVATE_KEY_HEX || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: HEDERA_PRIVATE_KEY_HEX ? [HEDERA_PRIVATE_KEY_HEX] : [],
      timeout: 60000,
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: HEDERA_PRIVATE_KEY_HEX ? [HEDERA_PRIVATE_KEY_HEX] : [],
      timeout: 60000,
    },
  },
};

export default config;

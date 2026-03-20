import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prevents false workspace-root detection when multiple lockfiles exist
  outputFileTracingRoot: path.join(__dirname, "../"),
  webpack: (config) => {
    // Silence missing optional dependencies from MetaMask SDK and WalletConnect
    // that are only needed in React Native / Node environments.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;

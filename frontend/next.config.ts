import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prevents false workspace-root detection when multiple lockfiles exist
  outputFileTracingRoot: path.join(__dirname, "../"),
};

export default nextConfig;

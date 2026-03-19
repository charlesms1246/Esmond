// frontend/lib/wagmi/config.ts
/**
 * Wagmi + viem configuration for Esmond on Paseo testnet.
 *
 * Chain ID: 420420417 (Paseo Asset Hub — confirmed by AGT-03/AGT-04)
 * RPC: NEXT_PUBLIC_PASEO_RPC_URL (default: https://eth-rpc-testnet.polkadot.io/)
 */

import { createConfig, http } from "wagmi";
import { defineChain }        from "viem";
import { injected, metaMask } from "wagmi/connectors";

// ─── Define Paseo as a custom viem chain ──────────────────────────────────
export const paseo = defineChain({
  id:   420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: {
    name:     "Paseo",
    symbol:   "PAS",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http:      [process.env.NEXT_PUBLIC_PASEO_RPC_URL || "https://eth-rpc-testnet.polkadot.io/"],
      webSocket: [process.env.NEXT_PUBLIC_PASEO_WS_URL  || "wss://asset-hub-paseo-rpc.n.dwellir.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url:  "https://blockscout-passet-hub.parity-testnet.parity.io",
    },
  },
  testnet: true,
});

// ─── Wagmi config ─────────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains:     [paseo],
  connectors: [
    injected(),   // MetaMask, SubWallet, Talisman (all injected providers)
    metaMask(),   // Explicit MetaMask connector
  ],
  transports: {
    [paseo.id]: http(
      process.env.NEXT_PUBLIC_PASEO_RPC_URL || "https://eth-rpc-testnet.polkadot.io/"
    ),
  },
  ssr: true, // Required for Next.js App Router
});

// Type augmentation for wagmi
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

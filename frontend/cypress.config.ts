import { defineConfig } from "cypress";

// ─── Node-side task helpers ────────────────────────────────────────────────
interface SendTxArgs {
  pk:       `0x${string}`;
  rpc:      string;
  txParams: {
    address:      `0x${string}`;
    abi:          any[];
    functionName: string;
    args?:        any[];        // uint256 values must be decimal strings (JSON-safe)
    gas?:         string;       // decimal string, e.g. "200000"
    value?:       string;       // decimal string
  };
}

const paseoChain = {
  id:             420420417,
  name:           "Polkadot Hub Testnet",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 18 },
  rpcUrls:        { default: { http: ["https://eth-rpc-testnet.polkadot.io/"] } },
} as const;

export default defineConfig({
  e2e: {
    baseUrl:          "http://localhost:3000",
    specPattern:      "cypress/e2e/**/*.cy.ts",
    supportFile:      "cypress/support/e2e.ts",
    viewportWidth:    1280,
    viewportHeight:   800,
    defaultCommandTimeout: 30_000,   // 30s — Paseo block time is 6s
    requestTimeout:   30_000,
    responseTimeout:  30_000,
    video:            true,
    screenshotOnRunFailure: true,
    env: {
      // Set real values in cypress.env.json (git-ignored)
      DEPLOYER_PRIVATE_KEY: "",
      PASEO_RPC_URL:        "https://eth-rpc-testnet.polkadot.io/",
      VAULT_ADDRESS:        "0xFebcB30Ff5c4894Ad2615237A1211771db865e5E",
      ESCROW_ADDRESS:       "0x5a7c76a67E231DfE89b29c8Fd0f82d2A2697BAaA",
      SUB_ADDRESS:          "0x29420F825ED2D26970BDfB8eCDB03F0ba1B94679",
      MOCK_ERC20_ADDRESS:   "0xA01337C3a4008BaABfef5472bEfAf1C4Dbf8C243",
      CONNECTED_ADDRESS:    "0xce4389ACb79463062c362fACB8CB04513fA3D8D8",
    },

    setupNodeEvents(on, config) {
      on("task", {
        // ── Simple console logger ──────────────────────────────────────────
        log(message: string) {
          console.log("[cypress:task]", message);
          return null;
        },

        // ── Send a signed transaction from the deployer key ────────────────
        // Used for on-chain setup (fund wallet, approve tokens, etc.)
        // Requires DEPLOYER_PRIVATE_KEY in cypress.env.json
        async sendTransaction({ pk, rpc, txParams }: SendTxArgs) {
          const { createWalletClient, createPublicClient, http } = await import("viem");
          const { privateKeyToAccount }                          = await import("viem/accounts");

          const account = privateKeyToAccount(pk);
          const chain   = { ...paseoChain, rpcUrls: { default: { http: [rpc] } } };

          const walletClient = createWalletClient({
            account,
            chain:     chain as any,
            transport: http(rpc),
          });
          const publicClient = createPublicClient({
            chain:     chain as any,
            transport: http(rpc),
          });

          // Cypress serialises task args through JSON, which cannot represent
          // BigInt literals.  Convert decimal-string numbers back to BigInt so
          // viem receives the correct types for uint256/uint32 parameters.
          const coerceArg = (v: unknown): unknown => {
            if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
            if (Array.isArray(v)) return v.map(coerceArg);
            return v;
          };
          const coercedArgs = (txParams.args ?? []).map(coerceArg);
          const coercedGas  = txParams.gas   ? BigInt(txParams.gas)   : undefined;
          const coercedVal  = txParams.value ? BigInt(txParams.value) : undefined;

          const hash = await walletClient.writeContract({
            account,
            chain:        chain as any,
            address:      txParams.address,
            abi:          txParams.abi,
            functionName: txParams.functionName,
            args:         coercedArgs,
            gas:          coercedGas,
            value:        coercedVal,
          } as any);

          await publicClient.waitForTransactionReceipt({ hash });
          console.log(`[cypress:task] sendTransaction confirmed: ${hash}`);
          return hash;
        },

        // ── Read on-chain state (no signer required) ──────────────────────
        async readContract({ rpc, address, abi, functionName, args }: {
          rpc: string; address: `0x${string}`; abi: any[];
          functionName: string; args?: any[];
        }) {
          const { createPublicClient, http } = await import("viem");
          const client = createPublicClient({
            chain:     paseoChain as any,
            transport: http(rpc),
          });
          const result = await client.readContract({ address, abi, functionName, args: args ?? [] } as any);
          return result == null ? null : String(result);
        },
      });

      return config;
    },
  },
});

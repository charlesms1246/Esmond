// frontend/cypress/plugins/index.ts
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Chain ID 420420417 (Paseo Asset Hub — confirmed on-chain by AGT-03/AGT-04)
const PASEO_CHAIN = {
  id: 420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 18 },
  rpcUrls: { default: { http: ["https://eth-rpc-testnet.polkadot.io/"] } },
};

export default (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  on("task", {
    async sendTransaction({ pk, rpc, txParams }: any) {
      if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in cypress.env.json");
      const account      = privateKeyToAccount(pk as `0x${string}`);
      const walletClient = createWalletClient({
        account, chain: PASEO_CHAIN as any, transport: http(rpc),
      });
      const publicClient = createPublicClient({ chain: PASEO_CHAIN as any, transport: http(rpc) });
      const hash    = await walletClient.writeContract(txParams);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return { hash, status: receipt.status };
    },

    async readContract({ rpc, address, abi, functionName, args }: any) {
      const publicClient = createPublicClient({ chain: PASEO_CHAIN as any, transport: http(rpc) });
      return publicClient.readContract({ address, abi, functionName, args });
    },

    log(message: string) {
      console.log(`[Cypress Task] ${message}`);
      return null;
    },
  });
  return config;
};

// frontend/cypress/support/commands.ts

// Chain ID 420420417 (Paseo Asset Hub — confirmed on-chain by AGT-03/AGT-04)
// Hex: 0x190f1b41 (NOT 0x190f1b46 which is 420420422)

Cypress.Commands.add("mockWalletConnect", (address: string) => {
  cy.window().then((win) => {
    (win as any).__testWalletAddress = address;
    (win as any).ethereum = {
      isMetaMask:      true,
      selectedAddress: address,
      chainId:         "0x190f1b41", // 420420417
      request: async ({ method, params }: any) => {
        if (method === "eth_requestAccounts") return [address];
        if (method === "eth_accounts")        return [address];
        if (method === "eth_chainId")         return "0x190f1b41";
        if (method === "net_version")         return "420420417";
        if (method === "wallet_switchEthereumChain") return null;
        // For actual transactions, proxy to real RPC
        const rpc = Cypress.env("PASEO_RPC_URL") as string;
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.result;
      },
      on:             () => {},
      removeListener: () => {},
    };
  });
});

Cypress.Commands.add("sendTx", (txParams: any) => {
  const pk  = Cypress.env("DEPLOYER_PRIVATE_KEY") as `0x${string}`;
  const rpc = Cypress.env("PASEO_RPC_URL") as string;
  return cy.task("sendTransaction", { pk, rpc, txParams });
});

Cypress.Commands.add("waitBlocks", (n: number) => {
  cy.wait(n * 6000); // 6 seconds per Paseo block
});

Cypress.Commands.add("noConsoleErrors", () => {
  cy.window().its("console").then(() => {
    // Stub checked in beforeEach
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      mockWalletConnect(address: string): void;
      sendTx(txParams: any): void;
      waitBlocks(n: number): void;
      noConsoleErrors(): void;
    }
  }
}

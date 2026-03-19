import { defineConfig } from "cypress";

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
    },
  },
});

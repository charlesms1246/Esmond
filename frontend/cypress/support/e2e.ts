// frontend/cypress/support/e2e.ts
import "./commands";

// Suppress uncaught exceptions from wagmi/viem internals that don't affect tests
Cypress.on("uncaught:exception", (err) => {
  // wagmi hydration warnings and MetaMask SDK module resolution warnings are not test failures
  if (
    err.message.includes("hydration") ||
    err.message.includes("MetaMask") ||
    err.message.includes("async-storage") ||
    err.message.includes("Cannot use namespace") ||
    err.message.includes("lockdown")
  ) {
    return false;
  }
  return true;
});

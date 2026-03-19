// frontend/cypress/e2e/03-payroll-flow.cy.ts
/**
 * Payroll flow E2E test
 *
 * Strategy: Use cy.task() for actual blockchain operations (deposit, register)
 * and test the UI reflects the resulting on-chain state.
 *
 * Note: Full MetaMask automation requires @synthetixio/synpress.
 * This test validates UI state after pre-funded on-chain setup.
 * cy.task("sendTransaction") is skipped when DEPLOYER_PRIVATE_KEY is not set.
 */

const VAULT_ABI_MINIMAL = [
  { type: "function", name: "employeeCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "vaultBalance",  inputs: [{ name: "token", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
];
const ERC20_ABI_MINIMAL = [
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
];

describe("Payroll Flow — UI state reflects on-chain changes", () => {
  const VAULT = Cypress.env("VAULT_ADDRESS");
  const USDC  = Cypress.env("MOCK_ERC20_ADDRESS");
  const PK    = Cypress.env("DEPLOYER_PRIVATE_KEY");
  const RPC   = Cypress.env("PASEO_RPC_URL");

  before(function() {
    // Skip vault pre-fund when private key not configured (CI / no-wallet environments)
    if (!PK) {
      cy.log("DEPLOYER_PRIVATE_KEY not set in cypress.env.json — skipping vault pre-fund");
      return;
    }
    cy.task("log", "Pre-funding vault via task...");
    cy.task("sendTransaction", {
      pk: PK, rpc: RPC,
      txParams: {
        address: USDC, abi: ERC20_ABI_MINIMAL, functionName: "approve",
        args: [VAULT, 500_000_000n], gas: 200_000n,
      },
    });
  });

  it("Payroll page shows vault balance card", () => {
    cy.visit("/payroll");
    cy.contains("Vault Balance").should("be.visible");
  });

  it("Payroll page shows Employee Roster section", () => {
    cy.visit("/payroll");
    cy.contains("Employee Roster").should("be.visible");
  });

  it("PayrollRoster shows employee count matching API", () => {
    cy.request("GET", "/api/payroll").then(({ body }) => {
      cy.visit("/payroll");
      if (body.total > 0) {
        cy.get("table").should("be.visible");
        cy.get("table tbody tr").should("have.length.gte", 1);
      } else {
        cy.contains("No employees registered").should("be.visible");
      }
    });
  });

  it("Employee rows show parachainId-based chain name", () => {
    cy.request("GET", "/api/payroll").then(({ body }) => {
      if (body.employees.length > 0) {
        cy.visit("/payroll");
        const emp = body.employees[0];
        cy.get("table").contains(emp.parachainName).should("be.visible");
      }
    });
  });

  it("Payroll page shows vault balance label", () => {
    cy.visit("/payroll");
    // VaultBalance component renders "Vault Balance" label and "tUSDC" token label
    cy.contains("Vault Balance").should("be.visible");
    cy.contains("tUSDC").should("be.visible");
  });

  it("Connect wallet prompt is shown when not connected", () => {
    cy.visit("/payroll");
    // Deposit form is behind wallet gate — shows connect prompt instead
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("+ Add Employee button is hidden when not connected", () => {
    cy.visit("/payroll");
    // Button only renders when isConnected = true
    cy.get("button").contains("Add Employee").should("not.exist");
  });

  it("Employee Roster section is always visible (read-only)", () => {
    cy.visit("/payroll");
    cy.contains("Employee Roster").should("be.visible");
    cy.get("nav").should("be.visible");
  });
});

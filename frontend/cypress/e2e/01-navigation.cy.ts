// frontend/cypress/e2e/01-navigation.cy.ts

describe("Navigation and page rendering", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("loads the dashboard page", () => {
    cy.url().should("eq", Cypress.config().baseUrl + "/");
    cy.contains("Programmable").should("be.visible");
    cy.contains("Payments").should("be.visible");
    cy.contains("on Polkadot Hub").should("be.visible");
  });

  it("shows all 4 stat cards on dashboard", () => {
    cy.contains("Vault Balance").should("be.visible");
    cy.contains("Employees").should("be.visible");
    cy.contains("Milestones").should("be.visible");
    cy.contains("Plans").should("be.visible");
  });

  it("shows three feature link cards", () => {
    cy.contains("Payroll Vault").should("be.visible");
    cy.contains("Milestone Escrow").should("be.visible");
    cy.contains("Subscriptions").should("be.visible");
  });

  it("shows network badge with correct chain ID", () => {
    // Chain ID is 420420417 (Paseo Asset Hub — confirmed on-chain by AGT-03/AGT-04)
    cy.contains("420420417").should("be.visible");
    cy.contains("Paseo Testnet").should("be.visible");
  });

  it("navigates to /payroll", () => {
    cy.get("nav").contains("Payroll").click();
    cy.url().should("include", "/payroll");
    cy.contains("Payroll Vault").should("be.visible");
    cy.contains("Employee Roster").should("be.visible");
  });

  it("navigates to /escrow", () => {
    cy.get("nav").contains("Milestones").click();
    cy.url().should("include", "/escrow");
    cy.contains("Milestone Escrow").should("be.visible");
  });

  it("navigates to /subscriptions", () => {
    cy.get("nav").contains("Subscriptions").click();
    cy.url().should("include", "/subscriptions");
    cy.contains("Subscription Manager").should("be.visible");
  });

  it("active nav link is highlighted on each page", () => {
    cy.get("nav").contains("Payroll").click();
    // Active link should have pink color — not the inactive grey
    cy.get("nav").contains("Payroll")
      .should("have.css", "color")
      .and("not.eq", "rgb(136, 136, 136)");
  });

  it("shows Connect Wallet button when not connected", () => {
    cy.contains("Connect Wallet").should("be.visible");
  });

  it("/payroll shows connect wallet prompt when not connected", () => {
    cy.visit("/payroll");
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("/escrow shows connect wallet prompt when not connected", () => {
    cy.visit("/escrow");
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("/subscriptions shows connect wallet prompt when not connected", () => {
    cy.visit("/subscriptions");
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("PayrollRoster section is visible without wallet connection", () => {
    cy.visit("/payroll");
    cy.contains("Employee Roster").should("be.visible");
    // Either shows employee table or empty state — both are valid
    cy.get("body").then($body => {
      const hasTable = $body.find("table").length > 0;
      const hasEmpty = $body.text().includes("No employees");
      expect(hasTable || hasEmpty).to.be.true;
    });
  });
});

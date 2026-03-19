// frontend/cypress/e2e/04-milestone-flow.cy.ts

describe("Milestone Escrow Flow", () => {
  it("Escrow page renders milestone grid or empty state", () => {
    cy.visit("/escrow");
    cy.contains("Milestone Escrow").should("be.visible");
    cy.get("body").then($body => {
      const hasGrid  = $body.find(".grid").length > 0;
      const hasEmpty = $body.text().includes("No milestones");
      expect(hasGrid || hasEmpty).to.be.true;
    });
  });

  it("+ New Milestone button is hidden when not connected", () => {
    cy.visit("/escrow");
    // Button only renders when isConnected = true
    cy.contains("New Milestone").should("not.exist");
  });

  it("Connect wallet prompt is shown when not connected", () => {
    cy.visit("/escrow");
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("API route milestones data loads into page within 10 seconds", () => {
    cy.visit("/escrow");
    cy.request("GET", "/api/milestones").then(({ body }) => {
      if (body.total > 0) {
        cy.get(".grid", { timeout: 10_000 }).should("be.visible");
      }
    });
  });

  it("MilestoneCard shows amount in tUSDC", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      if (body.milestones.length > 0) {
        cy.visit("/escrow");
        cy.contains("tUSDC", { timeout: 10_000 }).should("be.visible");
      }
    });
  });

  it("Milestone status badge renders on the page when milestones exist", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      if (body.milestones.length > 0) {
        cy.visit("/escrow");
        cy.get(".rounded-full", { timeout: 10_000 }).should("be.visible");
      }
    });
  });

  it("Page title and subtitle render correctly", () => {
    cy.visit("/escrow");
    cy.contains("Milestone Escrow").should("be.visible");
    cy.contains("Trustless").should("be.visible");
  });
});

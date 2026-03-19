// frontend/cypress/e2e/05-subscription-flow.cy.ts

describe("Subscription Manager Flow", () => {
  it("Subscriptions page loads with tab navigation", () => {
    cy.visit("/subscriptions");
    cy.contains("Subscription Manager").should("be.visible");
    cy.contains("subscriptions").should("be.visible");
    cy.contains("plans").should("be.visible");
  });

  it("Tab switching: clicking plans shows connect wallet prompt when not connected", () => {
    cy.visit("/subscriptions");
    cy.contains("plans").click();
    // Create Billing Plan form only shows when connected — without wallet, shows connect prompt
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("Plans tab: connect wallet prompt is shown for write actions", () => {
    cy.visit("/subscriptions");
    cy.contains("plans").click();
    cy.contains("Connect your wallet").should("be.visible");
    // Create Billing Plan form should NOT be present without wallet
    cy.contains("Create Billing Plan").should("not.exist");
  });

  it("Plans data loads from API into plans tab", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.visit("/subscriptions");
      cy.contains("plans").click();
      if (body.plans.length > 0) {
        cy.get(".grid", { timeout: 10_000 }).should("be.visible");
      } else {
        cy.contains("No plans yet").should("be.visible");
      }
    });
  });

  it("Subscriptions tab: subscription data loads from API", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.visit("/subscriptions");
      if (body.subscriptions.length > 0) {
        cy.get(".grid", { timeout: 10_000 }).should("be.visible");
        cy.contains("tUSDC").should("be.visible");
      } else {
        cy.contains("No active subscriptions").should("be.visible");
      }
    });
  });

  it("SubscriptionCard shows cap progress bar", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      if (body.subscriptions.length > 0) {
        cy.visit("/subscriptions");
        cy.contains("Charged:").should("be.visible");
        cy.contains("Cap:").should("be.visible");
      }
    });
  });

  it("Tab state persists: click plans then subscriptions", () => {
    cy.visit("/subscriptions");
    cy.contains("plans").click();
    // Plans tab active — subscriptions tab content hidden
    cy.contains("No active subscriptions").should("not.exist");
    cy.contains("subscriptions").click();
    // Back on subscriptions tab — connect wallet prompt gone
    cy.contains("Create Billing Plan").should("not.exist");
  });
});

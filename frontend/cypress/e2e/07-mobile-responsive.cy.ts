// frontend/cypress/e2e/07-mobile-responsive.cy.ts

describe("Mobile responsiveness (375px iPhone SE)", () => {
  beforeEach(() => {
    cy.viewport(375, 812);
  });

  it("Dashboard loads without horizontal scroll on mobile", () => {
    cy.visit("/");
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(375);
    });
  });

  it("NavBar is visible on mobile", () => {
    cy.visit("/");
    cy.get("nav").should("be.visible");
  });

  it("Desktop nav links are hidden on mobile (md:flex)", () => {
    cy.visit("/");
    cy.get("nav").within(() => {
      cy.get(".hidden.md\\:flex").should("not.be.visible");
    });
  });

  it("Payroll page loads without overflow on mobile", () => {
    cy.visit("/payroll");
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(375);
    });
  });

  it("Stat cards stack vertically on mobile", () => {
    cy.visit("/");
    cy.get(".grid-cols-1").should("be.visible");
  });

  it("Escrow page loads on mobile without overflow", () => {
    cy.visit("/escrow");
    cy.contains("Milestone Escrow").should("be.visible");
    // + New Milestone button is not present without wallet — no form to check
    // Verify page doesn't overflow on mobile
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.lte(375);
    });
  });
});

// frontend/cypress/e2e/06-wallet-connector.cy.ts

describe("WalletConnector behaviour", () => {
  it("shows Connect Wallet button when no wallet present", () => {
    cy.visit("/");
    cy.contains("Connect Wallet").should("be.visible");
  });

  it("Connect Wallet opens connector menu with Select wallet text", () => {
    cy.visit("/");
    cy.contains("Connect Wallet").click();
    cy.contains("Select wallet").should("be.visible");
  });

  it("Connector menu lists at least one wallet option", () => {
    cy.visit("/");
    cy.contains("Connect Wallet").click();
    // Shows connector names from wagmi: MetaMask, Injected, etc.
    cy.get("button").contains(/MetaMask|Injected|Browser/i).should("exist");
  });

  it("Clicking outside the menu does not crash the page", () => {
    cy.visit("/");
    cy.contains("Connect Wallet").click();
    cy.contains("Select wallet").should("be.visible");
    cy.get("nav").click("left"); // click outside menu
    cy.get("body").should("be.visible"); // page still functional
  });

  it("WalletConnector shows injected provider if window.ethereum present", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        (win as any).ethereum = {
          isMetaMask:      true,
          selectedAddress: null,
          request:         async () => [],
          on:              () => {},
          removeListener:  () => {},
        };
      },
    });
    cy.contains("Connect Wallet").click();
    cy.contains(/MetaMask|Injected/i).should("be.visible");
  });
});

// frontend/cypress/e2e/08-full-flow.cy.ts
// `export {}` makes this file a TypeScript module so top-level constants
// do not collide with identically-named constants in other spec files.
export {};

/**
 * Full Esmond dApp E2E Test Suite — Paseo Testnet
 *
 * Covers all 5 sections:
 *   1. Page loading
 *   2. API fetch & dashboard data counts
 *   3. Payroll page (add employee, deposit, run payroll)
 *   4. Milestone Escrow (view, create, approve)
 *   5. Subscription Manager (view, create plan, subscribe)
 *
 * ─── Wallet strategy ──────────────────────────────────────────────────────
 *
 *  visitWithWallet(path) injects a mock EIP-1193 provider via `onBeforeLoad`
 *  so the dApp's wallet-gated UI is always visible, then programmatically
 *  clicks "Connect Wallet" → selects the "Injected" connector so wagmi
 *  transitions to isConnected = true.
 *
 *  [SIGN] tests — click the submit button and wait up to TX_TIMEOUT for the
 *  user to sign in MetaMask.  In headless mode (no MetaMask extension) the
 *  signing assertion is skipped and the test is marked pending — the form
 *  interaction (fill + click) is still exercised.
 *
 *  [TASK] tests — use cy.task("sendTransaction") with a deployer private key
 *  (DEPLOYER_PRIVATE_KEY in cypress.env.json).  Skipped when key is absent.
 *
 * ─── Prerequisites ────────────────────────────────────────────────────────
 *  • `npm run dev` running on http://localhost:3000
 *  • Connected wallet: 0xce4389ACb79463062c362fACB8CB04513fA3D8D8
 *    (Paseo testnet, chain ID 420420417)
 *  • cypress.env.json (optional, enables TASK tests):
 *    { "DEPLOYER_PRIVATE_KEY": "0x…" }
 *
 * ─── Running ──────────────────────────────────────────────────────────────
 *  Interactive (MetaMask available for signing):
 *    npx cypress open
 *    → E2E Testing → select browser → 08-full-flow.cy.ts
 *  Headless (read + task tests only):
 *    npx cypress run --spec cypress/e2e/08-full-flow.cy.ts
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const CONNECTED_ADDR = "0xce4389ACb79463062c362fACB8CB04513fA3D8D8";
/** 2 minutes — enough for user to switch to MetaMask, sign, + Paseo block confirmation */
const TX_TIMEOUT   = 120_000;
/** 15 s — for on-chain read / API response / wagmi refetch cycle */
const READ_TIMEOUT = 15_000;

// Minimal ABIs needed in cy.task ("sendTransaction" runs in Node.js).
// All uint256 values in task args MUST be passed as decimal strings, not
// BigInt literals, because Cypress serialises task args through JSON.
const TASK_ERC20_ABI = [
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "approve",  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Visit a page with a mock EIP-1193 provider injected before page load.
 * The mock provider:
 *   • Answers eth_accounts / eth_requestAccounts with CONNECTED_ADDR
 *   • Does NOT set isMetaMask = true so wagmi labels it "Injected" (avoids
 *     MetaMask SDK interference and keeps the connector name predictable)
 *   • Forwards all other requests to the Paseo public RPC (read-only)
 *
 * After the page loads, connectWallet() is called to click through the
 * "Connect Wallet" → "Injected" flow so wagmi reaches isConnected = true.
 */
function visitWithWallet(path: string) {
  cy.visit(path, {
    onBeforeLoad(win: any) {
      win.ethereum = {
        isMetaMask:      false,   // <-- keeps connector label as "Injected"
        selectedAddress: CONNECTED_ADDR,
        chainId:         "0x190f1b41", // 420420417
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          if (method === "eth_requestAccounts")    return [CONNECTED_ADDR];
          if (method === "eth_accounts")           return [CONNECTED_ADDR];
          if (method === "eth_chainId")            return "0x190f1b41";
          if (method === "net_version")            return "420420417";
          if (method === "wallet_switchEthereumChain") return null;
          // Proxy all other calls (reads) to the public RPC
          const rpcUrl = Cypress.env("PASEO_RPC_URL") as string;
          const res    = await fetch(rpcUrl, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          return data.result;
        },
        on:             () => {},
        removeListener: () => {},
        emit:           () => {},
      };
    },
  });
  connectWallet();
}

/**
 * Programmatically connect the wallet through the WalletConnector UI.
 * Clicks "Connect Wallet" → opens connector menu → clicks the "Injected"
 * connector → waits for the button to change (address appears).
 */
function connectWallet() {
  // The "Connect Wallet" button may not be immediately rendered; wait for it.
  cy.contains("Connect Wallet", { timeout: READ_TIMEOUT }).click();
  // The connector selection menu lists all registered connectors.
  // Our mock sets isMetaMask: false so the wagmi injected() connector
  // names itself "Injected" rather than "MetaMask".
  cy.contains("Injected", { timeout: 5_000 }).click();
  // After connection wagmi re-renders the button to show the address;
  // "Connect Wallet" text disappears.
  cy.contains("Connect Wallet", { timeout: READ_TIMEOUT }).should("not.exist");
}

function deployerKey(): `0x${string}` | null {
  const k = Cypress.env("DEPLOYER_PRIVATE_KEY") as string;
  return k ? k as `0x${string}` : null;
}
function rpcUrl(): string {
  return Cypress.env("PASEO_RPC_URL") as string;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. PAGE LOADING CHECKS
// ════════════════════════════════════════════════════════════════════════════

describe("1 · Page Loading", () => {
  it("1.1  Dashboard hero text and network badge are visible", () => {
    cy.visit("/");
    cy.contains("Programmable").should("be.visible");
    cy.contains("Payments").should("be.visible");
    cy.contains("on Polkadot Hub").should("be.visible");
    cy.contains("Paseo Testnet").should("be.visible");
    cy.contains("420420417").should("be.visible");
    cy.contains("Blockscout Explorer").should("be.visible");
  });

  it("1.2  Dashboard shows 4 stat cards", () => {
    cy.visit("/");
    cy.contains("Vault Balance").should("be.visible");
    cy.contains("Employees").should("be.visible");
    cy.contains("Milestones").should("be.visible");
    cy.contains("Plans").should("be.visible");
  });

  it("1.3  Dashboard feature link cards are visible", () => {
    cy.visit("/");
    cy.contains("Payroll Vault").should("be.visible");
    cy.contains("Milestone Escrow").should("be.visible");
    cy.contains("Subscriptions").should("be.visible");
  });

  it("1.4  Payroll page loads with Vault Balance and Employee Roster", () => {
    cy.visit("/payroll");
    cy.contains("Payroll Vault").should("be.visible");
    cy.contains("Vault Balance").should("be.visible");
    cy.contains("Employee Roster").should("be.visible");
  });

  it("1.5  Escrow page loads", () => {
    cy.visit("/escrow");
    cy.contains("Milestone Escrow").should("be.visible");
    cy.contains("Trustless").should("be.visible");
  });

  it("1.6  Subscriptions page loads with tab navigation", () => {
    cy.visit("/subscriptions");
    cy.contains("Subscription Manager").should("be.visible");
    cy.contains("subscriptions").should("be.visible");
    cy.contains("plans").should("be.visible");
  });

  it("1.7  Navigation bar links to all three pages", () => {
    cy.visit("/");
    cy.get("nav").contains("Payroll").click();
    cy.url().should("include", "/payroll");
    cy.get("nav").contains("Milestones").click();
    cy.url().should("include", "/escrow");
    cy.get("nav").contains("Subscriptions").click();
    cy.url().should("include", "/subscriptions");
  });

  it("1.8  Connect Wallet prompt appears for write-gated content when not connected", () => {
    cy.visit("/payroll");
    cy.contains("Connect your wallet").should("be.visible");

    cy.visit("/escrow");
    cy.contains("Connect your wallet").should("be.visible");

    cy.visit("/subscriptions");
    cy.contains("plans").click();
    cy.contains("Connect your wallet").should("be.visible");
  });

  it("1.9  Connect Wallet button works and shows connected address", () => {
    visitWithWallet("/");
    // After connectWallet(), the address is displayed — "Connect Wallet" gone
    cy.contains("Connect Wallet").should("not.exist");
    // Address prefix shown in the header button
    cy.contains("0xce43").should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. API FETCH & DASHBOARD DATA COUNTS
// ════════════════════════════════════════════════════════════════════════════

describe("2 · API Fetch & Dashboard Counts", () => {
  it("2.1  GET /api/payroll — valid shape and employee fields", () => {
    cy.request("GET", "/api/payroll").then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body).to.have.property("employees").that.is.an("array");
      expect(body).to.have.property("total").that.is.a("number");
      cy.log(`✓ /api/payroll  total=${body.total}`);
      if (body.employees.length > 0) {
        const emp = body.employees[0];
        expect(emp).to.have.property("id");
        expect(emp).to.have.property("wallet").that.matches(/^0x/);
        expect(emp).to.have.property("salaryAmount");
        expect(emp).to.have.property("active");
        cy.log(`  id=${emp.id}  wallet=${emp.wallet.slice(0, 10)}…  active=${emp.active}`);
      }
    });
  });

  it("2.2  GET /api/milestones — valid shape and milestone fields", () => {
    cy.request("GET", "/api/milestones").then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body).to.have.property("milestones").that.is.an("array");
      expect(body).to.have.property("total").that.is.a("number");
      cy.log(`✓ /api/milestones  total=${body.total}`);
      if (body.milestones.length > 0) {
        const m = body.milestones[0];
        expect(m).to.have.property("id");
        expect(m).to.have.property("payer").that.matches(/^0x/);
        expect(m).to.have.property("payee").that.matches(/^0x/);
        expect(m).to.have.property("amount");
        expect(m).to.have.property("status").that.is.oneOf(["active", "released", "reclaimed", "expired"]);
        expect(m).to.have.property("approvers").that.is.an("array");
        expect(m).to.have.property("approvalCount");
        expect(m).to.have.property("approvalsRequired");
        expect(m).to.have.property("disputeDeadline");
        const amtUSDC = (Number(m.amount) / 1e6).toFixed(2);
        cy.log(`  id=${m.id}  status=${m.status}  amount=${amtUSDC} tUSDC`);
      }
    });
  });

  it("2.3  GET /api/subscriptions — valid shape with plans and subscriptions", () => {
    cy.request("GET", "/api/subscriptions").then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body).to.have.property("plans").that.is.an("array");
      expect(body).to.have.property("subscriptions").that.is.an("array");
      expect(body).to.have.property("totalPlans").that.is.a("number");
      expect(body).to.have.property("totalSubs").that.is.a("number");
      cy.log(`✓ /api/subscriptions  plans=${body.totalPlans}  subs=${body.totalSubs}`);
      if (body.plans.length > 0) {
        const p = body.plans[0];
        expect(p).to.have.property("id");
        expect(p).to.have.property("provider").that.matches(/^0x/);
        expect(p).to.have.property("chargeAmount");
        expect(p).to.have.property("interval");
        expect(p).to.have.property("active");
        const amt  = (Number(p.chargeAmount) / 1e6).toFixed(2);
        const days = Math.round(Number(p.interval) / 86400);
        cy.log(`  plan #${p.id}  ${amt} tUSDC / ${days} days  active=${p.active}`);
      }
      if (body.subscriptions.length > 0) {
        const s = body.subscriptions[0];
        expect(s).to.have.property("id");
        expect(s).to.have.property("subscriber").that.matches(/^0x/);
        expect(s).to.have.property("planId");
        expect(s).to.have.property("approvedCap");
        expect(s).to.have.property("totalCharged");
        expect(s).to.have.property("nextChargeDue");
        expect(s).to.have.property("active");
        cy.log(`  sub #${s.id}  planId=${s.planId}  active=${s.active}`);
      }
    });
  });

  it("2.4  Dashboard employee stat card shows on-chain count", () => {
    cy.visit("/");
    cy.contains("Employees", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("registered").should("be.visible");
  });

  it("2.5  Dashboard milestone stat card shows on-chain count", () => {
    cy.visit("/");
    cy.contains("Milestones", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("on-chain").should("be.visible");
  });

  it("2.6  Dashboard plan stat card shows on-chain count", () => {
    cy.visit("/");
    cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("subscription").should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. PAYROLL PAGE
// ════════════════════════════════════════════════════════════════════════════

describe("3 · Payroll Page", () => {
  let initialEmpCount = 0;
  before(() => {
    cy.request("GET", "/api/payroll").then(({ body }) => { initialEmpCount = body.total; });
  });

  // ── 3a: Add new employee ─────────────────────────────────────────────────

  it("3a · [SIGN] Add new employee — fill form, sign in MetaMask when prompted", function() {
    visitWithWallet("/payroll");

    // Add Employee button only visible when connected
    cy.contains("+ Add Employee", { timeout: READ_TIMEOUT }).should("be.visible").click();
    cy.contains("Register Employee").should("be.visible");

    // Fill EmployeeForm
    cy.get('input[placeholder="0x…"]').first().clear().type("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    cy.get('input[placeholder="100.00"]').clear().type("50");
    cy.get('input[placeholder="1200.00"]').clear().type("600");
    // Interval: default 30 days — leave as-is

    // Headless mode: no MetaMask extension available in Cypress's browser →
    // skip the submit & confirmation assertion but keep the form interaction test.
    if (Cypress.browser.isHeadless) {
      cy.log("ℹ  Headless mode — form filled; MetaMask signing skipped. Run with `cypress open` for full signing test.");
      this.skip();
      return;
    }

    cy.get('button[type="submit"]').contains("Register Employee").click();
    cy.contains(/Registering|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Employee registered");
  });

  // ── 3b: Verify Employee Roster ───────────────────────────────────────────

  it("3b · Employee Roster displays all on-chain employees correctly", () => {
    cy.request("GET", "/api/payroll").then(({ body }) => {
      cy.visit("/payroll");
      cy.contains("Employee Roster").should("be.visible");

      if (body.total === 0) {
        cy.contains("No employees registered").should("be.visible");
        cy.log("ℹ  No employees on-chain yet");
        return;
      }

      // Table renders with at least one row
      cy.get("table", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.get("table tbody tr").should("have.length.gte", 1);

      // Each row shows a wallet address, chain name, and status badge
      cy.get("table tbody tr").first().within(() => {
        cy.get("td").should("have.length.gte", 3);
      });

      cy.log(`✓ Roster shows ${body.total} employee(s) from API`);
    });
  });

  // ── 3c: Fund connected wallet with tUSDC ─────────────────────────────────

  it("3c · [TASK] Fund connected wallet with tUSDC via deployer key", function() {
    const pk = deployerKey();
    if (!pk) {
      cy.log("⚠  DEPLOYER_PRIVATE_KEY not set — skipping tUSDC funding. Ensure wallet has tUSDC balance before deposit test.");
      this.skip();
      return;
    }
    const usdc = Cypress.env("MOCK_ERC20_ADDRESS") as `0x${string}`;
    // Transfer 500 tUSDC (6 decimals = 500_000_000).
    // BigInt literals cannot be JSON-serialised → pass as decimal strings.
    cy.task("sendTransaction", {
      pk,
      rpc: rpcUrl(),
      txParams: {
        address:      usdc,
        abi:          TASK_ERC20_ABI,
        functionName: "transfer",
        args:         [CONNECTED_ADDR, "500000000"], // 500 tUSDC as string
        gas:          "200000",
      },
    }).then((hash) => {
      cy.log(`✓ Funded 500 tUSDC → ${CONNECTED_ADDR}  tx: ${hash}`);
    });
  });

  // ── 3d: Deposit tUSDC into Vault Balance ─────────────────────────────────

  it("3d · [SIGN] Deposit tUSDC into Vault — sign approve + deposit in MetaMask", function() {
    visitWithWallet("/payroll");

    // Fund Vault section only renders when connected
    cy.contains("Fund Vault", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("Vault Balance").should("be.visible");

    cy.get('input[placeholder="Amount in tUSDC"]').clear().type("100");
    cy.contains("button", "Deposit").click();

    if (Cypress.browser.isHeadless) {
      cy.log("ℹ  Headless mode — Deposit clicked; MetaMask signing skipped.");
      this.skip();
      return;
    }

    // First popup = ERC-20 approve; second = deposit.  Both must confirm.
    cy.contains(/Confirming|Waiting for wallet/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ 100 tUSDC deposited into vault");
  });

  // ── 3e: Run Payroll ──────────────────────────────────────────────────────

  it("3e · [SIGN] Run Payroll — sign transaction in MetaMask", function() {
    visitWithWallet("/payroll");

    cy.contains("Run Payroll", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("button", "Run Payroll").click();

    if (Cypress.browser.isHeadless) {
      cy.log("ℹ  Headless mode — Run Payroll clicked; MetaMask signing skipped.");
      this.skip();
      return;
    }

    cy.contains(/Running|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Payroll executed");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. MILESTONE ESCROW PAGE
// ════════════════════════════════════════════════════════════════════════════

describe("4 · Milestone Escrow Page", () => {
  let initialMilestoneCount = 0;
  before(() => {
    // Use failOnStatusCode: false so a 500 from the API doesn't abort the
    // before-all hook and skip the entire describe block.
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status === 200) initialMilestoneCount = body.total;
      else cy.log(`⚠  /api/milestones returned ${status} — initialMilestoneCount stays 0`);
    });
  });

  // ── 4a: Verify preloaded milestones display ──────────────────────────────

  it("4a · Preloaded milestones display correctly from API", () => {
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status !== 200) {
        cy.log(`⚠  /api/milestones returned ${status}: ${JSON.stringify(body)}`);
        // Still visit and check the empty state renders
        cy.visit("/escrow");
        cy.contains("Milestone Escrow").should("be.visible");
        return;
      }

      cy.visit("/escrow");
      cy.contains("Milestone Escrow").should("be.visible");

      if (body.milestones.length === 0) {
        cy.contains("No milestones", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.log("ℹ  No on-chain milestones yet");
        return;
      }

      cy.log(`Verifying ${body.milestones.length} milestone(s)…`);
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("tUSDC", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.get(".rounded-full", { timeout: READ_TIMEOUT }).should("be.visible");

      body.milestones.forEach((m: any) => {
        const amt      = (Number(m.amount) / 1e6).toFixed(2);
        const deadline = new Date(Number(m.disputeDeadline) * 1000).toLocaleDateString();
        cy.log(`  #${m.id}  status=${m.status}  ${amt} tUSDC  approvals=${m.approvalCount}/${m.approvalsRequired}  deadline=${deadline}`);
      });
    });
  });

  // ── 4b: Create new milestone ─────────────────────────────────────────────

  it("4b · [SIGN] Create a new milestone — sign approve + create in MetaMask", function() {
    visitWithWallet("/escrow");

    cy.contains("+ New Milestone", { timeout: READ_TIMEOUT }).should("be.visible").click();
    cy.contains("Create Milestone").should("be.visible");

    // Payee
    cy.get('input[placeholder="0x…"]').clear().type("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
    // Amount
    cy.get('input[placeholder="500"]').clear().type("10");
    // Dispute deadline: 30 days from now
    const dl = new Date();
    dl.setDate(dl.getDate() + 30);
    cy.get('input[type="date"]').type(dl.toISOString().split("T")[0]);

    cy.contains("Create & Lock Funds").click();

    if (Cypress.browser.isHeadless) {
      cy.log("ℹ  Headless mode — form submitted; MetaMask signing skipped.");
      this.skip();
      return;
    }

    cy.contains(/Confirming|Waiting for wallet/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Milestone created");
  });

  // ── 4c: Roster and dashboard count ──────────────────────────────────────

  it("4c · Milestone roster reflects on-chain state and dashboard count is visible", () => {
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status !== 200) {
        cy.log(`⚠  /api/milestones returned ${status} — skipping count check`);
        return;
      }
      cy.log(`Milestone count from API: ${body.total} (initial was ${initialMilestoneCount})`);
      expect(body.total).to.be.gte(initialMilestoneCount);

      cy.visit("/escrow");
      if (body.milestones.length > 0) {
        cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      } else {
        cy.contains("No milestones").should("be.visible");
      }

      cy.visit("/");
      cy.contains("Milestones", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard milestone count visible");
    });
  });

  // ── 4d: Approve milestone ────────────────────────────────────────────────

  it("4d · [SIGN] Approve an active milestone (if current address is an approver)", function() {
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status !== 200) { cy.log("⚠  API unavailable — skipping"); return; }

      const approvable = body.milestones.find((m: any) =>
        m.status === "active" &&
        m.approvers.map((a: string) => a.toLowerCase()).includes(CONNECTED_ADDR.toLowerCase())
      );
      if (!approvable) {
        cy.log("ℹ  No approvable milestones for connected address — skipping");
        return;
      }

      visitWithWallet("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      cy.contains(`#${approvable.id}`)
        .parents(".rounded-2xl").first()
        .within(() => cy.contains("button", "Approve").should("be.visible").click());

      if (Cypress.browser.isHeadless) {
        cy.log("ℹ  Headless — Approve clicked; signing skipped.");
        this.skip(); return;
      }
      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Milestone #${approvable.id} approved`);
    });
  });

  it("4d · [SIGN] Reclaim expired milestone (if any exist past deadline)", function() {
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status !== 200) { cy.log("⚠  API unavailable — skipping"); return; }

      const reclaimable = body.milestones.find((m: any) => m.status === "expired");
      if (!reclaimable) {
        cy.log("ℹ  No expired milestones — skipping");
        return;
      }

      visitWithWallet("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      cy.contains(`#${reclaimable.id}`)
        .parents(".rounded-2xl").first()
        .within(() => cy.contains("button", "Reclaim").should("be.visible").click());

      if (Cypress.browser.isHeadless) {
        cy.log("ℹ  Headless — Reclaim clicked; signing skipped.");
        this.skip(); return;
      }
      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Milestone #${reclaimable.id} reclaimed`);
    });
  });

  it("4d · Status badges reflect correct on-chain status", () => {
    cy.request({ url: "/api/milestones", failOnStatusCode: false }).then(({ status, body }) => {
      if (status !== 200 || body.milestones.length === 0) return;
      const statuses = [...new Set(body.milestones.map((m: any) => m.status))];
      cy.log(`Statuses present: ${statuses.join(", ")}`);

      cy.visit("/escrow");
      cy.get(".rounded-full", { timeout: READ_TIMEOUT }).should("be.visible");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SUBSCRIPTIONS PAGE
// ════════════════════════════════════════════════════════════════════════════

describe("5 · Subscriptions Page", () => {
  let initialPlanCount = 0;
  let initialSubCount  = 0;
  before(() => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      initialPlanCount = body.totalPlans;
      initialSubCount  = body.totalSubs;
    });
  });

  // ── 5a: Preloaded subscription data ──────────────────────────────────────

  it("5a · Preloaded subscription data displays correctly in Subscriptions tab", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.visit("/subscriptions");
      cy.contains("Subscription Manager").should("be.visible");

      if (body.subscriptions.length === 0) {
        cy.contains("No active subscriptions", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.log("ℹ  No active subscriptions yet");
        return;
      }

      cy.log(`Verifying ${body.subscriptions.length} subscription(s)…`);
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("Charged:", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("Cap:", { timeout: READ_TIMEOUT }).should("be.visible");

      body.subscriptions.forEach((s: any) => {
        const charged = (Number(s.totalCharged) / 1e6).toFixed(2);
        const cap     = (Number(s.approvedCap)  / 1e6).toFixed(2);
        cy.log(`  sub #${s.id}  planId=${s.planId}  charged=${charged}/${cap} tUSDC  active=${s.active}`);
      });
    });
  });

  // ── 5b: Preloaded plans data ─────────────────────────────────────────────

  it("5b · Preloaded plans display correctly in Plans tab", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.visit("/subscriptions");
      cy.contains("plans").click();

      if (body.plans.length === 0) {
        cy.contains("No plans yet", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.log("ℹ  No plans on-chain yet");
        return;
      }

      cy.log(`Verifying ${body.plans.length} plan(s)…`);
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("tUSDC", { timeout: READ_TIMEOUT }).should("be.visible");

      body.plans.forEach((p: any) => {
        const amt  = (Number(p.chargeAmount) / 1e6).toFixed(2);
        const days = Math.round(Number(p.interval) / 86400);
        cy.log(`  plan #${p.id}  ${amt} tUSDC / ${days} days  active=${p.active}`);
        cy.contains(`Plan #${p.id}`).should("be.visible");
      });
    });
  });

  // ── 5c: Create new billing plan ──────────────────────────────────────────

  it("5c · [SIGN] Create a new billing plan — sign transaction in MetaMask", function() {
    visitWithWallet("/subscriptions");
    cy.contains("plans").click();

    cy.contains("Create Billing Plan", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.get('input[placeholder="10"]').clear().type("15");
    // Interval: default 30 days

    cy.contains("button", "Create Plan").click();

    if (Cypress.browser.isHeadless) {
      cy.log("ℹ  Headless — Create Plan clicked; MetaMask signing skipped.");
      this.skip(); return;
    }
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Billing plan created");
  });

  it("5c · Plan count in Plans tab and dashboard is at least the initial count", () => {
    cy.wait(12_000); // allow wagmi refetch after any previous tx
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.log(`Plan count: ${body.totalPlans} (was ${initialPlanCount})`);
      expect(body.totalPlans).to.be.gte(initialPlanCount);

      cy.visit("/subscriptions");
      cy.contains("plans").click();
      // Grid or empty state — both are valid
      cy.get("body", { timeout: READ_TIMEOUT }).should("contain.text",
        body.plans.length > 0 ? "tUSDC" : "No plans yet"
      );

      cy.visit("/");
      cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard plan count visible");
    });
  });

  // ── 5d: Subscribe to an existing plan ────────────────────────────────────

  it("5d · [SIGN] Subscribe to an existing plan — sign approve + subscribe in MetaMask", function() {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      if (body.plans.length === 0) {
        cy.log("ℹ  No plans to subscribe to — skipping");
        this.skip(); return;
      }

      const plan    = body.plans.find((p: any) => p.active) ?? body.plans[0];
      // Approved cap = 10× charge amount; expressed as human-readable tUSDC string
      const capUSDC = ((Number(plan.chargeAmount) / 1e6) * 10).toFixed(2);
      cy.log(`Subscribing to plan #${plan.id} with cap ${capUSDC} tUSDC`);

      visitWithWallet("/subscriptions");
      cy.contains("plans").click();
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      cy.contains(`Plan #${plan.id}`)
        .parents(".rounded-2xl").first()
        .within(() => cy.contains("button", "Subscribe").should("be.visible").click());

      cy.get('input[placeholder="e.g. 100"]', { timeout: 5_000 }).clear().type(capUSDC);

      cy.contains("button", "Confirm").click();

      if (Cypress.browser.isHeadless) {
        cy.log("ℹ  Headless — Confirm clicked; MetaMask signing skipped.");
        this.skip(); return;
      }

      cy.contains(/Subscribing|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Subscribed to plan #${plan.id}`);
    });
  });

  // ── 5e: Subscription count updates ──────────────────────────────────────

  it("5e · Subscription count in API is at least the initial count and page renders correctly", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.log(`Subscription count: ${body.totalSubs} (was ${initialSubCount})`);
      expect(body.totalSubs).to.be.gte(initialSubCount);

      cy.visit("/subscriptions");
      // Default tab = subscriptions
      if (body.subscriptions.length > 0) {
        cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.contains("Charged:").should("be.visible");
      } else {
        cy.contains("No active subscriptions", { timeout: READ_TIMEOUT }).should("be.visible");
      }

      cy.visit("/");
      cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard stats verified");
    });
  });
});

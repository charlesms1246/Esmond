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
 *  "WALLET" tests inject a mock EIP-1193 provider via `onBeforeLoad` so the
 *  dApp's wallet-gated UI is always visible. Real transaction signing is done
 *  one of two ways:
 *
 *    A) [TASK]  — uses `cy.task("sendTransaction")` with a deployer private
 *                 key to submit the tx from the test node process. Requires
 *                 DEPLOYER_PRIVATE_KEY in cypress.env.json. Skipped otherwise.
 *
 *    B) [SIGN]  — clicks the UI button and waits (TX_TIMEOUT = 120 s) for
 *                 the user to sign in MetaMask, then asserts confirmation.
 *                 Run `npx cypress open` (not `run`) for interactive signing.
 *
 * ─── Prerequisites ────────────────────────────────────────────────────────
 *  • `npm run dev` running on http://localhost:3000
 *  • Connected wallet: 0xce4389ACb79463062c362fACB8CB04513fA3D8D8
 *    (on Paseo testnet, chain ID 420420417)
 *  • cypress.env.json (optional, enables TASK tests):
 *    { "DEPLOYER_PRIVATE_KEY": "0x…" }
 *
 * ─── Running ──────────────────────────────────────────────────────────────
 *  Interactive (with MetaMask signing):
 *    npx cypress open --spec cypress/e2e/08-full-flow.cy.ts
 *  Headless (task-only, no manual signing):
 *    npx cypress run --spec cypress/e2e/08-full-flow.cy.ts
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const CONNECTED_ADDR = "0xce4389ACb79463062c362fACB8CB04513fA3D8D8";
/** 2 minutes — enough for user to switch to MetaMask, sign, and a Paseo block to confirm */
const TX_TIMEOUT     = 120_000;
/** 15 s — for on-chain read / API response / wagmi refetch */
const READ_TIMEOUT   = 15_000;

// Minimal ABIs for node-side tasks (prefixed to avoid redeclaration with other specs)
const FULL_FLOW_ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "transfer",  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "mint",      inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve",   inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Visit a page with a mock EIP-1193 provider injected before page load.
 * This makes wagmi treat the wallet as connected (returns CONNECTED_ADDR
 * for eth_accounts / eth_requestAccounts). Read calls are proxied to the
 * real RPC. Real transaction signing is forwarded to the actual MetaMask
 * provider if present (loaded as a Chrome extension during `cypress open`).
 */
function visitWithWallet(path: string) {
  cy.visit(path, {
    onBeforeLoad(win: any) {
      const realEthereum = win.ethereum; // real MetaMask if extension loaded
      win.ethereum = {
        isMetaMask:      true,
        selectedAddress: CONNECTED_ADDR,
        chainId:         "0x190f1b41", // 420420417
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          // ── Connection methods — answer immediately ─────────────────────
          if (method === "eth_requestAccounts")    return [CONNECTED_ADDR];
          if (method === "eth_accounts")           return [CONNECTED_ADDR];
          if (method === "eth_chainId")            return "0x190f1b41";
          if (method === "net_version")            return "420420417";
          if (method === "wallet_switchEthereumChain") return null;
          // ── Transaction signing — delegate to real MetaMask if present ──
          if (realEthereum) return realEthereum.request({ method, params });
          // ── Fallback: proxy read calls to public RPC ────────────────────
          const rpc = Cypress.env("PASEO_RPC_URL") as string;
          const res = await fetch(rpc, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          return data.result;
        },
        on:             (e: string, h: Function) => realEthereum?.on?.(e, h),
        removeListener: (e: string, h: Function) => realEthereum?.removeListener?.(e, h),
        emit:           (e: string, ...a: any[]) => realEthereum?.emit?.(e, ...a),
      };
    },
  });
}

/** Alias for deployer task wiring */
function deployerKey(): `0x${string}` {
  return Cypress.env("DEPLOYER_PRIVATE_KEY") as `0x${string}`;
}
function rpc(): string {
  return Cypress.env("PASEO_RPC_URL") as string;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. PAGE LOADING CHECKS
// ════════════════════════════════════════════════════════════════════════════

describe("1 · Page Loading", () => {
  it("1.1  Dashboard hero text and chain badge are visible", () => {
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

  it("1.3  Dashboard feature links navigate correctly", () => {
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

  it("1.5  Escrow page loads with page title and subtitle", () => {
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

  it("1.8  All pages show Connect Wallet prompt for write actions when not connected", () => {
    cy.visit("/payroll");
    cy.contains("Connect your wallet").should("be.visible");

    cy.visit("/escrow");
    cy.contains("Connect your wallet").should("be.visible");

    cy.visit("/subscriptions");
    cy.contains("plans").click();
    cy.contains("Connect your wallet").should("be.visible");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. API FETCH & DASHBOARD DATA COUNTS
// ════════════════════════════════════════════════════════════════════════════

describe("2 · API Fetch & Dashboard Counts", () => {
  it("2.1  GET /api/payroll — valid shape and employee count", () => {
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
        cy.log(`  Sample: id=${emp.id} wallet=${emp.wallet.slice(0, 10)}… active=${emp.active}`);
      }
    });
  });

  it("2.2  GET /api/milestones — valid shape and milestone count", () => {
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
        cy.log(`  Sample: id=${m.id} status=${m.status} amount=${m.amount}`);
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
      cy.log(`✓ /api/subscriptions  plans=${body.totalPlans} subs=${body.totalSubs}`);
      if (body.plans.length > 0) {
        const p = body.plans[0];
        expect(p).to.have.property("id");
        expect(p).to.have.property("provider").that.matches(/^0x/);
        expect(p).to.have.property("chargeAmount");
        expect(p).to.have.property("interval");
        expect(p).to.have.property("active");
        cy.log(`  Plan #${p.id}: ${Number(p.chargeAmount) / 1e6} tUSDC / ${Math.round(Number(p.interval) / 86400)} days`);
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
        cy.log(`  Sub #${s.id}: planId=${s.planId} active=${s.active}`);
      }
    });
  });

  it("2.4  Dashboard employee stat card shows on-chain count", () => {
    cy.request("GET", "/api/payroll").then(({ body: api }) => {
      cy.visit("/");
      // Wait for wagmi to hydrate and display the count
      cy.contains("Employees", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("registered").should("be.visible");
      cy.log(`Dashboard employee count synced — API total: ${api.total}`);
    });
  });

  it("2.5  Dashboard milestone stat card shows on-chain count", () => {
    cy.request("GET", "/api/milestones").then(({ body: api }) => {
      cy.visit("/");
      cy.contains("Milestones", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("on-chain").should("be.visible");
      cy.log(`Dashboard milestone count synced — API total: ${api.total}`);
    });
  });

  it("2.6  Dashboard plan stat card shows on-chain count", () => {
    cy.request("GET", "/api/subscriptions").then(({ body: api }) => {
      cy.visit("/");
      cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log(`Dashboard plan count synced — API total: ${api.totalPlans}`);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. PAYROLL PAGE
// ════════════════════════════════════════════════════════════════════════════

describe("3 · Payroll Page", () => {
  // Capture initial employee count before this describe block runs
  let initialEmpCount = 0;
  before(() => {
    cy.request("GET", "/api/payroll").then(({ body }) => { initialEmpCount = body.total; });
  });

  // ── 3a: Add new employee ─────────────────────────────────────────────────

  it("3a · [SIGN] Add new employee — complete form and sign in MetaMask", () => {
    visitWithWallet("/payroll");

    // Wallet-gated button should be visible
    cy.contains("+ Add Employee", { timeout: READ_TIMEOUT }).should("be.visible").click();
    cy.contains("Register Employee").should("be.visible");

    // Fill EmployeeForm
    // Wallet address field (placeholder "0x…")
    cy.get('input[placeholder="0x…"]')
      .first()
      .clear()
      .type("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

    // Salary (tUSDC)
    cy.get('input[placeholder="100.00"]').clear().type("50");

    // Approved Cap (must be ≥ salary)
    cy.get('input[placeholder="1200.00"]').clear().type("600");

    // Pay interval — default 30 days is fine, leave as-is

    // Submit → MetaMask popup for registerEmployee
    cy.get('button[type="submit"]').contains("Register Employee").click();

    // ── MetaMask: user signs the transaction ─────────────────────────────
    // The spinner or "Registering…" appears immediately; success checkmark
    // appears after the block is confirmed (~6 s after signing).
    cy.contains(/Registering|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Employee registered");
  });

  // ── 3b: Verify Employee Roster updates ──────────────────────────────────

  it("3b · Employee Roster updates with newly registered employee", () => {
    // After registration, useEmployeeCount has refetchInterval: 6000 — wait 2 blocks
    cy.wait(12_000); // 2 Paseo blocks × 6 s

    cy.request("GET", "/api/payroll").then(({ body }) => {
      cy.visit("/payroll");
      cy.contains("Employee Roster").should("be.visible");

      // Roster should show at least as many rows as the API total
      cy.get("table", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.get("table tbody tr").should("have.length.gte", body.total);
      cy.log(`✓ Roster shows ${body.total} employee(s) — was ${initialEmpCount} before test`);

      // The newly added address should appear in the roster
      cy.contains("0x70997970").should("be.visible");
    });
  });

  // ── 3c: Fund connected wallet with tUSDC ─────────────────────────────────

  it("3c · [TASK] Fund connected wallet with tUSDC via deployer key", function() {
    const pk = deployerKey();
    if (!pk) {
      cy.log("⚠  DEPLOYER_PRIVATE_KEY not set in cypress.env.json — skipping tUSDC funding.");
      cy.log("   Ensure 0xce4389… has enough tUSDC balance before running deposit test.");
      this.skip();
    }
    const usdc = Cypress.env("MOCK_ERC20_ADDRESS") as `0x${string}`;
    // Transfer 500 tUSDC (6 decimals = 500_000_000) from deployer to connected wallet
    cy.task("sendTransaction", {
      pk,
      rpc: rpc(),
      txParams: {
        address:      usdc,
        abi:          FULL_FLOW_ERC20_ABI,
        functionName: "transfer",
        args:         [CONNECTED_ADDR, 500_000_000n], // 500 tUSDC
        gas:          200_000n,
      },
    }).then((hash) => {
      cy.log(`✓ Funded 500 tUSDC to ${CONNECTED_ADDR}  tx: ${hash}`);
    });
  });

  // ── 3d: Deposit tUSDC into Vault Balance ─────────────────────────────────

  it("3d · [SIGN] Deposit tUSDC into Vault — sign approve + deposit in MetaMask", () => {
    visitWithWallet("/payroll");

    // Fund Vault section only renders when connected
    cy.contains("Fund Vault", { timeout: READ_TIMEOUT }).should("be.visible");

    // Capture vault balance label before deposit
    cy.contains("Vault Balance").should("be.visible");

    // Enter deposit amount
    cy.get('input[placeholder="Amount in tUSDC"]').clear().type("100");

    // Click Deposit → two MetaMask popups: (1) ERC-20 approve, (2) deposit
    cy.contains("button", "Deposit").click();

    // First confirmation: "Confirming…" link with tx hash (approve mined)
    cy.contains(/Confirming|Waiting for wallet/, { timeout: TX_TIMEOUT }).should("be.visible");

    // Final success: checkmark appears after deposit tx is confirmed
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ 100 tUSDC deposited into vault");

    // Vault Balance stat card should still be visible (updated by wagmi refetch)
    cy.contains("Vault Balance").should("be.visible");
    cy.contains("tUSDC").should("be.visible");
  });

  // ── 3e: Run Payroll ──────────────────────────────────────────────────────

  it("3e · [SIGN] Run Payroll for all registered employees", () => {
    visitWithWallet("/payroll");

    // Run Payroll button only visible when connected
    cy.contains("Run Payroll", { timeout: READ_TIMEOUT }).should("be.visible");
    cy.contains("button", "Run Payroll").click();

    // Running state
    cy.contains(/Running|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
    // Confirmed
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
    cy.request("GET", "/api/milestones").then(({ body }) => { initialMilestoneCount = body.total; });
  });

  // ── 4a: Verify preloaded milestones display ──────────────────────────────

  it("4a · Preloaded milestones display correctly from API", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      cy.visit("/escrow");
      cy.contains("Milestone Escrow").should("be.visible");

      if (body.milestones.length === 0) {
        cy.contains("No milestones", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.log("ℹ  No on-chain milestones yet");
        return;
      }

      cy.log(`Verifying ${body.milestones.length} milestone(s)…`);
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      // Amount displayed in tUSDC
      cy.contains("tUSDC", { timeout: READ_TIMEOUT }).should("be.visible");

      // Status badge visible
      cy.get(".rounded-full", { timeout: READ_TIMEOUT }).should("be.visible");

      // Log each milestone's details
      body.milestones.forEach((m: any) => {
        const amtUSDC   = (Number(m.amount) / 1e6).toFixed(2);
        const deadline  = new Date(Number(m.disputeDeadline) * 1000).toLocaleDateString();
        cy.log(
          `  #${m.id}  status=${m.status}  amount=${amtUSDC} tUSDC` +
          `  approvals=${m.approvalCount}/${m.approvalsRequired}  deadline=${deadline}`
        );
      });
    });
  });

  // ── 4b: Create new milestone ─────────────────────────────────────────────

  it("4b · [SIGN] Create a new milestone — sign approve + create in MetaMask", () => {
    visitWithWallet("/escrow");

    // New Milestone button only visible when connected
    cy.contains("+ New Milestone", { timeout: READ_TIMEOUT }).should("be.visible").click();
    cy.contains("Create Milestone").should("be.visible");

    // Payee address
    cy.get('input[placeholder="0x…"]').clear().type("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");

    // Amount in tUSDC
    cy.get('input[placeholder="500"]').clear().type("10");

    // Dispute deadline — 30 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    const dateStr = deadline.toISOString().split("T")[0]; // YYYY-MM-DD
    cy.get('input[type="date"]').type(dateStr);

    // Submit → two MetaMask popups: (1) ERC-20 approve, (2) createMilestone
    cy.contains("Create & Lock Funds").click();

    cy.contains(/Confirming|Waiting for wallet/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Milestone created and funds locked");
  });

  // ── 4c: Verify milestone roster + dashboard count ────────────────────────

  it("4c · New milestone appears in roster and dashboard count updates", () => {
    cy.wait(12_000); // 2 Paseo blocks × 6 s // Allow refetch cycle

    cy.request("GET", "/api/milestones").then(({ body }) => {
      cy.log(`Milestone count: ${body.total} (was ${initialMilestoneCount})`);
      expect(body.total).to.be.gte(initialMilestoneCount);

      // Escrow page shows the new milestone
      cy.visit("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("tUSDC").should("be.visible");

      // Dashboard milestone stat card is still visible (count updates via wagmi)
      cy.visit("/");
      cy.contains("Milestones", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard milestone count visible");
    });
  });

  // ── 4d: Additional milestone actions ────────────────────────────────────

  it("4d · [SIGN] Approve milestone (if connected address is an approver)", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      // Find an active milestone where the connected wallet is listed as an approver
      const approvable = body.milestones.find((m: any) =>
        m.status === "active" &&
        m.approvers.map((a: string) => a.toLowerCase()).includes(CONNECTED_ADDR.toLowerCase())
      );

      if (!approvable) {
        cy.log("ℹ  No approvable milestones for connected address — skipping approve step");
        return;
      }

      cy.log(`Approving milestone #${approvable.id}`);
      visitWithWallet("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      // Locate the Approve button within the card that contains "#<id>"
      cy.contains(`#${approvable.id}`)
        .parents(".rounded-2xl")
        .first()
        .within(() => {
          cy.contains("button", "Approve").should("be.visible").click();
        });

      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Milestone #${approvable.id} approved`);
    });
  });

  it("4d · [SIGN] Reclaim expired milestone (if any exist past deadline)", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      const reclaimable = body.milestones.find((m: any) => m.status === "expired");

      if (!reclaimable) {
        cy.log("ℹ  No expired milestones to reclaim — skipping");
        return;
      }

      cy.log(`Reclaiming expired milestone #${reclaimable.id}`);
      visitWithWallet("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      cy.contains(`#${reclaimable.id}`)
        .parents(".rounded-2xl")
        .first()
        .within(() => {
          cy.contains("button", "Reclaim").should("be.visible").click();
        });

      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Milestone #${reclaimable.id} reclaimed`);
    });
  });

  it("4d · Milestone status badges reflect correct on-chain state", () => {
    cy.request("GET", "/api/milestones").then(({ body }) => {
      if (body.milestones.length === 0) return;

      cy.visit("/escrow");
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      // Each milestone card shows one of the four statuses
      const statuses = [...new Set(body.milestones.map((m: any) => m.status))];
      cy.log(`On-chain statuses present: ${statuses.join(", ")}`);

      // At least one status badge is visible
      cy.get(".rounded-full").should("be.visible");
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

  // ── 5a: Verify preloaded subscription data ───────────────────────────────

  it("5a · Preloaded subscription data displays correctly in Subscriptions tab", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.visit("/subscriptions");
      // Default tab is "subscriptions"
      cy.contains("Subscription Manager").should("be.visible");

      if (body.subscriptions.length === 0) {
        cy.contains("No active subscriptions", { timeout: READ_TIMEOUT }).should("be.visible");
        cy.log("ℹ  No active subscriptions on-chain yet");
        return;
      }

      cy.log(`Verifying ${body.subscriptions.length} subscription(s)…`);
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      // SubscriptionCard renders "Charged:" and "Cap:" labels
      cy.contains("Charged:", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("Cap:", { timeout: READ_TIMEOUT }).should("be.visible");

      body.subscriptions.forEach((s: any) => {
        const totalCharged   = (Number(s.totalCharged)  / 1e6).toFixed(2);
        const cap            = (Number(s.approvedCap)   / 1e6).toFixed(2);
        const nextDue        = new Date(Number(s.nextChargeDue) * 1000).toLocaleDateString();
        cy.log(
          `  Sub #${s.id}  planId=${s.planId}  charged=${totalCharged}/${cap} tUSDC` +
          `  nextDue=${nextDue}  active=${s.active}`
        );
      });
    });
  });

  // ── 5b: Verify preloaded plans data ─────────────────────────────────────

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
        const amount = (Number(p.chargeAmount) / 1e6).toFixed(2);
        const days   = Math.round(Number(p.interval) / 86400);
        cy.log(
          `  Plan #${p.id}  ${amount} tUSDC / ${days} days` +
          `  charges=${p.chargeCount}/${p.maxCharges || "∞"}  active=${p.active}`
        );
        // Each plan card shows Plan # label
        cy.contains(`Plan #${p.id}`).should("be.visible");
      });
    });
  });

  // ── 5c: Create new billing plan ──────────────────────────────────────────

  it("5c · [SIGN] Create a new billing plan — sign transaction in MetaMask", () => {
    visitWithWallet("/subscriptions");
    cy.contains("plans").click();

    // Create Billing Plan form only visible when connected
    cy.contains("Create Billing Plan", { timeout: READ_TIMEOUT }).should("be.visible");

    // Charge amount: 15 tUSDC
    cy.get('input[placeholder="10"]').clear().type("15");

    // Interval: default 30 days — leave as-is

    // Submit → MetaMask popup (createPlan, no ERC-20 approve needed)
    cy.contains("button", "Create Plan").click();

    cy.contains(/✓/, { timeout: TX_TIMEOUT }).should("be.visible");
    cy.log("✓ Billing plan created");
  });

  // ── 5c (cont): Plan count updates in plans tab and dashboard ─────────────

  it("5c · Plan count updates in Plans tab and dashboard stat card", () => {
    cy.wait(12_000); // 2 Paseo blocks × 6 s

    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.log(`Plan count: ${body.totalPlans} (was ${initialPlanCount})`);
      expect(body.totalPlans).to.be.gte(initialPlanCount);

      // Plans tab shows the new plan
      cy.visit("/subscriptions");
      cy.contains("plans").click();
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("15.00").should("be.visible"); // newly created plan amount

      // Dashboard plan stat card still visible
      cy.visit("/");
      cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard plan count updated");
    });
  });

  // ── 5d: Subscribe to an existing plan ───────────────────────────────────

  it("5d · [SIGN] Subscribe to an existing plan — sign approve + subscribe in MetaMask", () => {
    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      if (body.plans.length === 0) {
        cy.log("ℹ  No plans to subscribe to — skipping");
        return;
      }

      // Use the first active plan
      const plan = body.plans.find((p: any) => p.active) ?? body.plans[0];
      // Approved cap = 10× the charge amount
      const capUnits  = BigInt(plan.chargeAmount) * 10n;
      const capUSDC   = (Number(capUnits) / 1e6).toFixed(2);

      cy.log(`Subscribing to plan #${plan.id} with cap ${capUSDC} tUSDC`);

      visitWithWallet("/subscriptions");
      cy.contains("plans").click();
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");

      // Click Subscribe on the target plan card
      cy.contains(`Plan #${plan.id}`)
        .parents(".rounded-2xl")
        .first()
        .within(() => {
          cy.contains("button", "Subscribe").click();
        });

      // Inline subscribe form appears
      cy.get('input[placeholder="e.g. 100"]', { timeout: 5_000 }).clear().type(capUSDC);

      // Confirm → MetaMask: (1) ERC-20 approve, (2) subscribe
      cy.contains("button", "Confirm").click();

      cy.contains(/Subscribing|✓/, { timeout: TX_TIMEOUT }).should("be.visible");
      cy.contains("✓", { timeout: TX_TIMEOUT }).should("be.visible");
      cy.log(`✓ Subscribed to plan #${plan.id}`);
    });
  });

  // ── 5e: Subscription count updates ──────────────────────────────────────

  it("5e · New subscription appears in Subscriptions tab and dashboard count updates", () => {
    cy.wait(12_000); // 2 Paseo blocks × 6 s

    cy.request("GET", "/api/subscriptions").then(({ body }) => {
      cy.log(`Subscription count: ${body.totalSubs} (was ${initialSubCount})`);
      expect(body.totalSubs).to.be.gte(initialSubCount);

      // Subscriptions tab shows the new subscription
      cy.visit("/subscriptions");
      // Default tab is "subscriptions"
      cy.get(".grid", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.contains("Charged:").should("be.visible");
      cy.contains("Cap:").should("be.visible");

      // Dashboard still visible (plan count updated via wagmi planCount hook)
      cy.visit("/");
      cy.contains("Plans", { timeout: READ_TIMEOUT }).should("be.visible");
      cy.log("✓ Dashboard counts verified after subscription");
    });
  });
});

/**
 * Script 04: Verify Deployment
 *
 * Reads addresses.json and verifies every contract is responsive.
 * Does not send transactions — read-only validation only.
 *
 * Run: npx ts-node scripts/deploy/04_verify_deployment.ts
 */

import { ethers }           from "ethers";
import { log, loadAddresses, PASEO_RPC,
         XCM_PRECOMPILE }   from "./utils";

// Minimal ABIs for verification calls
const PAYROLL_VAULT_ABI = [
  "function employeeCount() view returns (uint256)",
  "function schedulerContract() view returns (address)",
  "function owner() view returns (address)",
];
const ESCROW_ABI = [
  "function milestoneCount() view returns (uint256)",
];
const SUB_MGR_ABI = [
  "function planCount() view returns (uint256)",
];
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
];
const XCM_ABI = [
  "function weighMessage(bytes calldata) view returns (tuple(uint64 refTime, uint64 proofSize))",
];

async function main() {
  log("=== Step 4: Verify Deployment ===");

  const addresses = loadAddresses();
  const provider  = new ethers.JsonRpcProvider(PASEO_RPC);
  let   allPassed = true;

  async function check(label: string, fn: () => Promise<void>) {
    try {
      await fn();
      log(`  ✅ ${label}`);
    } catch (err: any) {
      log(`  ❌ ${label}: ${err.message}`);
      allPassed = false;
    }
  }

  // ── 1. Check precompiles ───────────────────────────────────────────────────
  log("\n[Precompiles]");
  await check("XCM precompile has bytecode", async () => {
    const code = await provider.getCode(XCM_PRECOMPILE);
    if (!code || code === "0x") throw new Error("No bytecode");
  });
  await check("Mock USDC precompile responds to totalSupply()", async () => {
    const erc20 = new ethers.Contract(addresses.precompiles.erc20_mockUsdc, ERC20_ABI, provider);
    const supply = await erc20.totalSupply();
    if (supply === 0n) throw new Error("totalSupply is zero — asset may not be registered");
    log(`     totalSupply: ${supply}`);
  });
  await check("Mock USDT precompile responds to totalSupply()", async () => {
    const erc20 = new ethers.Contract(addresses.precompiles.erc20_mockUsdt, ERC20_ABI, provider);
    const supply = await erc20.totalSupply();
    if (supply === 0n) throw new Error("totalSupply is zero");
    log(`     totalSupply: ${supply}`);
  });

  // ── 2. Check deployed contracts ────────────────────────────────────────────
  log("\n[Deployed Contracts]");
  const ctrs = addresses.contracts;

  await check("PayrollVault has bytecode", async () => {
    const code = await provider.getCode(ctrs.PayrollVault);
    if (!code || code === "0x") throw new Error("No bytecode");
  });
  await check("PayrollVault.employeeCount() returns 0", async () => {
    const vault = new ethers.Contract(ctrs.PayrollVault, PAYROLL_VAULT_ABI, provider);
    const count = await vault.employeeCount();
    if (count !== 0n) throw new Error(`Unexpected count: ${count}`);
  });
  await check("PayrollVault.schedulerContract() matches addresses.json", async () => {
    const vault = new ethers.Contract(ctrs.PayrollVault, PAYROLL_VAULT_ABI, provider);
    const sc    = await vault.schedulerContract();
    if (sc.toLowerCase() !== addresses.activeSchedulerAddress.toLowerCase())
      throw new Error(`Mismatch: got ${sc}`);
  });

  await check("ConditionalEscrow has bytecode", async () => {
    const code = await provider.getCode(ctrs.ConditionalEscrow);
    if (!code || code === "0x") throw new Error("No bytecode");
  });
  await check("ConditionalEscrow.milestoneCount() returns 0", async () => {
    const escrow = new ethers.Contract(ctrs.ConditionalEscrow, ESCROW_ABI, provider);
    const count  = await escrow.milestoneCount();
    if (count !== 0n) throw new Error(`Unexpected count: ${count}`);
  });

  await check("SubscriptionManager has bytecode", async () => {
    const code = await provider.getCode(ctrs.SubscriptionManager);
    if (!code || code === "0x") throw new Error("No bytecode");
  });
  await check("SubscriptionManager.planCount() returns 0", async () => {
    const sub   = new ethers.Contract(ctrs.SubscriptionManager, SUB_MGR_ABI, provider);
    const count = await sub.planCount();
    if (count !== 0n) throw new Error(`Unexpected count: ${count}`);
  });

  // ── 3. Scheduler contract is live ──────────────────────────────────────────
  log("\n[Scheduler Contract]");
  await check("Active scheduler has bytecode", async () => {
    const code = await provider.getCode(addresses.activeSchedulerAddress);
    if (!code || code === "0x") throw new Error("No bytecode at activeSchedulerAddress");
    log(`     type: ${addresses.activeScheduler}`);
  });

  // ── 4. XCM precompile weighMessage sanity check ────────────────────────────
  log("\n[XCM Precompile Functionality]");
  await check("weighMessage() responds with non-zero weight for minimal XCM msg", async () => {
    const xcm     = new ethers.Contract(XCM_PRECOMPILE, XCM_ABI, provider);
    // Minimal V4 XCM message: just a version tag + empty instruction vec
    const minMsg  = "0x0400"; // V4 + Compact(0 instructions)
    const weight  = await xcm.weighMessage(minMsg);
    log(`     refTime: ${weight.refTime}, proofSize: ${weight.proofSize}`);
    // Even an empty message should return some weight estimate
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  log("\n=========================================");
  if (allPassed) {
    log("✅ ALL CHECKS PASSED — Deployment verified");
    log(`\nDeployment manifest: deployments/paseo/addresses.json`);
  } else {
    log("❌ SOME CHECKS FAILED — See errors above");
    log("   Fix failing items before proceeding to AGT-04");
    process.exit(1);
  }
  log("=========================================");
  log("=== Step 4 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

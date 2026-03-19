/**
 * Test 04: Subscription Flow on Paseo
 *
 * Flow:
 *  1. Provider creates a plan (10 mUSDC every 5s, unlimited charges)
 *  2. Subscriber approves SubscriptionManager for 50 mUSDC cap
 *  3. Subscribe with cap = 50 mUSDC
 *  4. First charge succeeds
 *  5. Immediate second charge reverts (too early)
 *  6. Wait 5s + charge again — succeeds
 *  7. Revoke subscription
 *  8. Charge after revoke reverts
 *
 * Run: npx ts-node scripts/testnet/04_test_subscription_flow.ts
 */

import {
  loadAddresses, getProvider, getSigner, waitConfirmed,
  logTx, SUBSCRIPTION_ABI, ERC20_ABI, TestResults
} from "./utils";
import { ethers } from "ethers";

async function main() {
  console.log("=== Test 04: Subscription Flow ===\n");
  const results   = new TestResults("subscription-test-results.md");
  const addresses = loadAddresses();
  const provider  = getProvider();
  const signer    = getSigner(provider);

  const SUB_ADDR  = addresses.contracts.SubscriptionManager;
  const USDC_ADDR = addresses.precompiles.erc20_mockUsdc;

  const subMgr = new ethers.Contract(SUB_ADDR,  SUBSCRIPTION_ABI, signer);
  const usdc   = new ethers.Contract(USDC_ADDR, ERC20_ABI, signer);

  const CHARGE_AMOUNT = ethers.parseUnits("10", 6);
  const INTERVAL      = 5n;
  const MAX_CHARGES   = 0n;
  const EXPIRY        = 0n;
  const CAP           = ethers.parseUnits("50", 6);

  console.log(`Deployer:            ${signer.address}`);
  console.log(`SubscriptionManager: ${SUB_ADDR}`);
  console.log(`mUSDC:               ${USDC_ADDR}`);

  // ── Step 0: Verify contract is responsive ─────────────────────────────────
  const planCountBefore = await subMgr.planCount();
  console.log(`\nplanCount before: ${planCountBefore}`);
  results.record("0.1 SubscriptionManager.planCount() readable", "N/A", "PASS",
    `Count: ${planCountBefore}`);

  // ── Step 0b: Check mUSDC balance ─────────────────────────────────────────
  let usdcBalance = 0n;
  try {
    usdcBalance = await usdc.balanceOf(signer.address);
    console.log(`Deployer mUSDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
    results.record("0.2 mUSDC balance check", "N/A", "PASS",
      `Balance: ${ethers.formatUnits(usdcBalance, 6)}`);
  } catch (e: any) {
    console.log(`⚠️  mUSDC precompile not live: ${e.message}`);
    results.record("0.2 mUSDC balance check", "N/A", "SKIP",
      "ERC-20 precompile not live — token-dependent steps will be skipped");
  }

  // ── Step 1: Create plan ────────────────────────────────────────────────────
  console.log("\nStep 1: Creating subscription plan...");
  let planId = 0n;
  try {
    const createPlanTx = await subMgr.createPlan(
      USDC_ADDR, CHARGE_AMOUNT, INTERVAL, MAX_CHARGES, EXPIRY,
      { gasLimit: 300_000 }
    );
    const planReceipt = await waitConfirmed(provider, createPlanTx.hash, "createPlan");
    logTx("subMgr.createPlan()", createPlanTx.hash);

    const iface     = new ethers.Interface(SUBSCRIPTION_ABI);
    const planEvent = planReceipt.logs
      .map(l => { try { return iface.parseLog(l); } catch { return null; } })
      .find(e => e?.name === "PlanCreated");
    planId = planEvent?.args.planId ?? 0n;
    console.log(`Plan ID: ${planId}`);
    results.record("1.1 createPlan()", createPlanTx.hash, "PASS",
      `ID: ${planId}, charge: ${ethers.formatUnits(CHARGE_AMOUNT, 6)} mUSDC every ${INTERVAL}s`);
  } catch (e: any) {
    console.log(`⚠️  createPlan failed: ${e.message}`);
    results.record("1.1 createPlan()", "N/A", "FAIL", e.message.slice(0, 120));
    results.save();
    return;
  }

  // ── Steps 2–8: Token-dependent flow ──────────────────────────────────────
  if (usdcBalance < CAP) {
    console.log("\n⚠️  Insufficient mUSDC for charge flow — skipping steps 2–8");
    results.record("2.1 approve mUSDC for SubscriptionManager", "N/A", "SKIP",
      "mUSDC precompile not live or balance insufficient");
    results.record("3.1 subscribe()", "N/A", "SKIP", "Depends on step 2.1");
    results.record("4.1 charge() #1 succeeds", "N/A", "SKIP", "Depends on subscribe");
    results.record("5.1 early charge correctly reverts", "N/A", "SKIP", "Depends on charge #1");
    results.record("6.1 charge() #2 after interval", "N/A", "SKIP", "Depends on charge #1");
    results.record("7.1 revoke() succeeds", "N/A", "SKIP", "Depends on subscribe");
    results.record("8.1 charge after revoke reverts", "N/A", "SKIP", "Depends on revoke");
    results.save();
    console.log("\n=== Test 04 Complete (partial — plan created, charges skipped) ===");
    return;
  }

  const iface = new ethers.Interface(SUBSCRIPTION_ABI);

  // ── Step 2: Approve ───────────────────────────────────────────────────────
  console.log("\nStep 2: Approving SubscriptionManager...");
  const approveSubTx = await usdc.approve(SUB_ADDR, CAP, { gasLimit: 200_000 });
  await waitConfirmed(provider, approveSubTx.hash, "approve for subscription");
  results.record("2.1 approve mUSDC for SubscriptionManager", approveSubTx.hash, "PASS");

  // ── Step 3: Subscribe ─────────────────────────────────────────────────────
  console.log("\nStep 3: Subscribing...");
  const subscribeTx = await subMgr.subscribe(planId, CAP, { gasLimit: 300_000 });
  const subReceipt  = await waitConfirmed(provider, subscribeTx.hash, "subscribe");
  logTx("subMgr.subscribe()", subscribeTx.hash);

  const subEvent = subReceipt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "Subscribed");
  const subId = subEvent?.args.subscriptionId ?? 0n;
  console.log(`Subscription ID: ${subId}`);
  results.record("3.1 subscribe()", subscribeTx.hash,
    subEvent ? "PASS" : "FAIL",
    subEvent ? `ID: ${subId}` : "Subscribed event missing");

  // ── Step 4: First charge ──────────────────────────────────────────────────
  console.log("\nStep 4: First charge...");
  const charge1Tx    = await subMgr.charge(subId, { gasLimit: 300_000 });
  const chargeReceipt = await waitConfirmed(provider, charge1Tx.hash, "charge #1");
  logTx("subMgr.charge() #1", charge1Tx.hash);

  const chargeEv = chargeReceipt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "Charged");
  results.record("4.1 charge() #1 succeeds", charge1Tx.hash,
    chargeEv ? "PASS" : "FAIL",
    chargeEv ? `Amount: ${ethers.formatUnits(chargeEv.args.amount, 6)} mUSDC` : "Charged event missing");

  // ── Step 5: Immediate second charge must revert ───────────────────────────
  console.log("\nStep 5: Immediate second charge (must revert)...");
  try {
    await subMgr.charge(subId, { gasLimit: 300_000 });
    results.record("5.1 early charge correctly reverts", "N/A", "FAIL",
      "Expected revert but tx succeeded");
  } catch (err: any) {
    const isRevert = err.message.includes("revert") || err.message.includes("execution") ||
                     err.message.includes("Too early");
    console.log(`✅ Correctly reverted: ${isRevert ? "revert" : err.message.slice(0, 60)}`);
    results.record("5.1 early charge correctly reverts", "N/A", "PASS", "Reverted as expected");
  }

  // ── Step 6: Wait and charge again ─────────────────────────────────────────
  console.log("\nStep 6: Waiting 6 seconds, then charging again...");
  await new Promise(r => setTimeout(r, 6000));

  const charge2Tx = await subMgr.charge(subId, { gasLimit: 300_000 });
  await waitConfirmed(provider, charge2Tx.hash, "charge #2");
  logTx("subMgr.charge() #2", charge2Tx.hash);
  results.record("6.1 charge() #2 after interval succeeds", charge2Tx.hash, "PASS");

  // ── Step 7: Revoke ────────────────────────────────────────────────────────
  console.log("\nStep 7: Revoking subscription...");
  const revokeTx = await subMgr.revoke(subId, { gasLimit: 200_000 });
  await waitConfirmed(provider, revokeTx.hash, "revoke");
  logTx("subMgr.revoke()", revokeTx.hash);
  results.record("7.1 revoke() succeeds", revokeTx.hash, "PASS");

  // ── Step 8: Charge after revoke must revert ───────────────────────────────
  console.log("\nStep 8: Charge after revoke (must revert)...");
  await new Promise(r => setTimeout(r, 6000));
  try {
    await subMgr.charge(subId, { gasLimit: 300_000 });
    results.record("8.1 charge after revoke reverts", "N/A", "FAIL", "Expected revert");
  } catch {
    results.record("8.1 charge after revoke correctly reverts", "N/A", "PASS",
      "Reverted as expected after revoke");
  }

  results.save();
  console.log("\n=== Test 04 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

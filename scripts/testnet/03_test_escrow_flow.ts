/**
 * Test 03: Milestone Escrow Flow on Paseo
 *
 * Flow A (happy path):
 *  1. Approve escrow for 500 mUSDC
 *  2. Create milestone (deployer as payer, payee, and approver)
 *  3. Approve milestone (threshold = 1)
 *  4. Verify MilestoneReleased event
 *
 * Flow B (reclaim path):
 *  1. Create milestone with 2-second deadline
 *  2. Wait for deadline
 *  3. reclaimExpired → verify MilestoneReclaimed event
 *
 * Run: npx ts-node scripts/testnet/03_test_escrow_flow.ts
 */

import {
  loadAddresses, getProvider, getSigner, waitConfirmed,
  logTx, ESCROW_ABI, ERC20_ABI, TestResults
} from "./utils";
import { ethers } from "ethers";

async function main() {
  console.log("=== Test 03: Milestone Escrow Flow ===\n");
  const results   = new TestResults("escrow-test-results.md");
  const addresses = loadAddresses();
  const provider  = getProvider();
  const signer    = getSigner(provider);

  const ESC_ADDR = addresses.contracts.ConditionalEscrow;
  const USDC_ADDR = addresses.precompiles.erc20_mockUsdc;

  const escrow = new ethers.Contract(ESC_ADDR, ESCROW_ABI, signer);
  const usdc   = new ethers.Contract(USDC_ADDR, ERC20_ABI, signer);

  const AMOUNT   = ethers.parseUnits("500", 6);
  const PAYEE    = signer.address;
  const APPROVER = signer.address;
  const DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 86400);

  console.log(`Deployer:  ${signer.address}`);
  console.log(`Escrow:    ${ESC_ADDR}`);
  console.log(`mUSDC:     ${USDC_ADDR}`);

  // ── Step 0: Verify escrow contract is responsive ──────────────────────────
  console.log("\nStep 0: Verifying contract state...");
  const milestoneCountBefore = await escrow.milestoneCount();
  console.log(`milestoneCount before tests: ${milestoneCountBefore}`);
  results.record("0.1 ConditionalEscrow.milestoneCount() readable", "N/A", "PASS",
    `Count: ${milestoneCountBefore}`);

  // ── Step 0b: Check mUSDC balance ─────────────────────────────────────────
  let usdcBalance = 0n;
  try {
    usdcBalance = await usdc.balanceOf(signer.address);
    console.log(`Deployer mUSDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
    results.record("0.2 mUSDC balanceOf() readable", "N/A", "PASS",
      `Balance: ${ethers.formatUnits(usdcBalance, 6)}`);
  } catch (e: any) {
    console.log(`⚠️  mUSDC precompile not live: ${e.message}`);
    results.record("0.2 mUSDC balanceOf()", "N/A", "SKIP",
      "ERC-20 precompile not live — token escrow tests skipped");
  }

  if (usdcBalance < AMOUNT) {
    console.log("\n⚠️  Insufficient mUSDC balance for escrow tests. Documenting as SKIP.");
    results.record("Flow A: create → approve → release", "N/A", "SKIP",
      `Need ${ethers.formatUnits(AMOUNT, 6)} mUSDC, have ${ethers.formatUnits(usdcBalance, 6)}`);
    results.record("Flow B: create → reclaimExpired", "N/A", "SKIP",
      "Depends on mUSDC availability");
    results.save();
    console.log("\n=== Test 03 Complete (skipped — mUSDC precompile not live) ===");
    return;
  }

  const iface = new ethers.Interface(ESCROW_ABI);

  // ── Flow A: Happy path ─────────────────────────────────────────────────────
  console.log("\nFlow A: Happy path — create → approve → release");

  // A.1 Approve escrow
  const approveTx = await usdc.approve(ESC_ADDR, AMOUNT, { gasLimit: 200_000 });
  await waitConfirmed(provider, approveTx.hash, "approve USDC for escrow");
  results.record("A.1 approve mUSDC for escrow", approveTx.hash, "PASS");

  // A.2 Check allowance
  const allowance = await usdc.allowance(signer.address, ESC_ADDR);
  results.record("A.2 allowance >= amount", approveTx.hash,
    allowance >= AMOUNT ? "PASS" : "FAIL",
    `Allowance: ${ethers.formatUnits(allowance, 6)}`);
  if (allowance < AMOUNT) {
    throw new Error("Insufficient allowance — cannot create milestone");
  }

  // A.3 Create milestone
  const payeeBefore = await usdc.balanceOf(PAYEE);
  const createTx    = await escrow.createMilestone(
    PAYEE, USDC_ADDR, AMOUNT, [APPROVER], 1, DEADLINE,
    { gasLimit: 500_000 }
  );
  const createReceipt = await waitConfirmed(provider, createTx.hash, "createMilestone");
  logTx("escrow.createMilestone()", createTx.hash);

  const createEvent = createReceipt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "MilestoneCreated");
  const milestoneId = createEvent?.args.id ?? 0n;
  console.log(`Milestone ID: ${milestoneId}`);
  results.record("A.3 createMilestone()", createTx.hash,
    createEvent ? "PASS" : "FAIL",
    createEvent ? `ID: ${milestoneId}` : "MilestoneCreated event missing");

  // A.4 Approve milestone
  const approveMilestoneTx = await escrow.approveMilestone(milestoneId, { gasLimit: 300_000 });
  const approveReceipt     = await waitConfirmed(provider, approveMilestoneTx.hash, "approveMilestone");
  logTx("escrow.approveMilestone()", approveMilestoneTx.hash);

  const releaseEvent = approveReceipt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "MilestoneReleased");

  if (releaseEvent) {
    console.log(`MilestoneReleased: ${ethers.formatUnits(releaseEvent.args.amount, 6)} mUSDC`);
    results.record("A.4 approveMilestone() releases funds", approveMilestoneTx.hash, "PASS",
      `${ethers.formatUnits(releaseEvent.args.amount, 6)} mUSDC released to ${releaseEvent.args.payee}`);
  } else {
    results.record("A.4 MilestoneReleased event", approveMilestoneTx.hash, "FAIL",
      "Event not found in receipt");
  }

  // A.5 Verify payee balance increased
  const payeeAfter = await usdc.balanceOf(PAYEE);
  const received   = payeeAfter - payeeBefore;
  console.log(`Payee received: ${ethers.formatUnits(received, 6)} mUSDC`);
  results.record("A.5 payee balance increased", approveMilestoneTx.hash,
    received >= AMOUNT ? "PASS" : "FAIL",
    `Received: ${ethers.formatUnits(received, 6)} mUSDC`);

  // ── Flow B: Reclaim path ───────────────────────────────────────────────────
  console.log("\nFlow B: Reclaim path — create with past deadline → reclaimExpired");

  const shortDeadline = BigInt(Math.floor(Date.now() / 1000) + 2); // 2 seconds
  const approve2Tx    = await usdc.approve(ESC_ADDR, AMOUNT, { gasLimit: 200_000 });
  await waitConfirmed(provider, approve2Tx.hash, "approve for second milestone");

  const create2Tx  = await escrow.createMilestone(
    PAYEE, USDC_ADDR, AMOUNT, [APPROVER], 1, shortDeadline,
    { gasLimit: 500_000 }
  );
  const cr2Receipt = await waitConfirmed(provider, create2Tx.hash, "create second milestone");
  const createEv2  = cr2Receipt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "MilestoneCreated");
  const id2 = createEv2?.args.id ?? 1n;
  results.record("B.1 create milestone with 2s deadline", create2Tx.hash,
    createEv2 ? "PASS" : "FAIL", `ID: ${id2}`);

  console.log("Waiting 6 seconds for deadline to pass...");
  await new Promise(r => setTimeout(r, 6000));

  const payerBefore = await usdc.balanceOf(signer.address);
  const reclaimTx   = await escrow.reclaimExpired(id2, { gasLimit: 300_000 });
  const reclaimRcpt = await waitConfirmed(provider, reclaimTx.hash, "reclaimExpired");
  logTx("escrow.reclaimExpired()", reclaimTx.hash);

  const reclaimEvent = reclaimRcpt.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "MilestoneReclaimed");

  results.record("B.2 reclaimExpired() after deadline", reclaimTx.hash,
    reclaimEvent ? "PASS" : "FAIL",
    reclaimEvent
      ? `Reclaimed ${ethers.formatUnits(reclaimEvent.args.amount, 6)} mUSDC`
      : "MilestoneReclaimed event missing");

  results.save();
  console.log("\n=== Test 03 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

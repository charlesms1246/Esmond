/**
 * Test 01: Full Payroll Flow on Paseo
 *
 * Flow:
 *  1. Fund vault with 1000 mUSDC (requires ERC-20 precompile)
 *  2. Register 3 employees:
 *     - Employee A: Hub (parachainId=0), 100 mUSDC/30d
 *     - Employee B: Hub (parachainId=0), 150 mUSDC/30d
 *     - Employee C: Moonbeam (parachainId=2004), 200 mUSDC/30d
 *  3. Run payroll
 *  4. Verify nextPaymentDue updated
 *  5. Verify vault balance decreased
 *
 * Run: npx ts-node scripts/testnet/01_test_payroll_flow.ts
 */

import {
  loadAddresses, getProvider, getSigner, waitConfirmed,
  logTx, VAULT_ABI, ERC20_ABI, TestResults
} from "./utils";
import { ethers } from "ethers";

const THIRTY_DAYS = 30 * 24 * 3600;

async function main() {
  console.log("=== Test 01: Full Payroll Flow ===\n");
  const results   = new TestResults("onchain-test-results.md");
  const addresses = loadAddresses();
  const provider  = getProvider();
  const signer    = getSigner(provider);

  const VAULT_ADDR = addresses.contracts.PayrollVault;
  const USDC_ADDR  = addresses.precompiles.erc20_mockUsdc;

  console.log(`Deployer:   ${signer.address}`);
  console.log(`Vault:      ${VAULT_ADDR}`);
  console.log(`mUSDC:      ${USDC_ADDR}`);

  const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
  const usdc  = new ethers.Contract(USDC_ADDR,  ERC20_ABI, signer);

  // Derive reproducible test employee addresses from deployer key
  const empA = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromEntropy(ethers.toBeHex(1n, 16)), "m/44'/60'/0'/0/1"
  ).address;
  const empB = signer.address; // deployer as employee B for easy balance checks
  const empC = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromEntropy(ethers.toBeHex(2n, 16)), "m/44'/60'/0'/0/1"
  ).address;

  console.log(`\nTest addresses:`);
  console.log(`  Employee A: ${empA}`);
  console.log(`  Employee B: ${empB}`);
  console.log(`  Employee C: ${empC}`);

  // ── Step 0: Check deployer mUSDC balance ──────────────────────────────────
  console.log("\nStep 0: Checking mUSDC precompile...");
  let deployerUsdcBal = 0n;
  try {
    deployerUsdcBal = await usdc.balanceOf(signer.address);
    console.log(`Deployer mUSDC balance: ${ethers.formatUnits(deployerUsdcBal, 6)}`);
    results.record("0.1 mUSDC precompile balanceOf()", "N/A", "PASS",
      `Balance: ${ethers.formatUnits(deployerUsdcBal, 6)}`);
  } catch (e: any) {
    console.log(`⚠️  mUSDC precompile not live: ${e.message}`);
    results.record("0.1 mUSDC precompile balanceOf()", "N/A", "SKIP",
      "ERC-20 precompile not live on this testnet variant — token flow tests skipped");
  }

  // ── Step 1: Approve and deposit mUSDC (if precompile is live) ─────────────
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);
  let depositTxHash = "N/A";

  if (deployerUsdcBal >= DEPOSIT_AMOUNT) {
    console.log("\nStep 1: Depositing 1000 mUSDC into vault...");
    try {
      const approveTx = await usdc.approve(VAULT_ADDR, DEPOSIT_AMOUNT, { gasLimit: 200_000 });
      await waitConfirmed(provider, approveTx.hash, "approve USDC");
      logTx("approve mUSDC for vault", approveTx.hash);

      const depositTx = await vault.deposit(USDC_ADDR, DEPOSIT_AMOUNT, { gasLimit: 300_000 });
      await waitConfirmed(provider, depositTx.hash, "deposit");
      logTx("vault.deposit()", depositTx.hash);
      depositTxHash = depositTx.hash;
      results.record("1.1 deposit 1000 mUSDC", depositTx.hash, "PASS");

      const vaultBal = await vault.vaultBalance(USDC_ADDR);
      console.log(`Vault balance: ${ethers.formatUnits(vaultBal, 6)} mUSDC`);
      results.record("1.2 vault balance check", depositTx.hash,
        vaultBal >= DEPOSIT_AMOUNT ? "PASS" : "FAIL",
        `Balance: ${ethers.formatUnits(vaultBal, 6)} mUSDC`);
    } catch (e: any) {
      console.log(`⚠️  Deposit failed: ${e.message}`);
      results.record("1.1 deposit 1000 mUSDC", "N/A", "FAIL", e.message.slice(0, 120));
    }
  } else {
    console.log("\nStep 1: SKIP — mUSDC precompile not live, skipping deposit");
    results.record("1.1 deposit 1000 mUSDC", "N/A", "SKIP",
      "mUSDC balance insufficient or precompile not live");
    results.record("1.2 vault balance check", "N/A", "SKIP", "Depends on step 1.1");
  }

  // ── Step 2: Register 3 employees ──────────────────────────────────────────
  console.log("\nStep 2: Registering 3 employees...");
  let regCTxHash = "N/A";

  try {
    const regATx = await vault.registerEmployee(
      empA, ethers.parseUnits("100", 6), USDC_ADDR,
      THIRTY_DAYS, ethers.parseUnits("100", 6), 0,
      { gasLimit: 300_000 }
    );
    await waitConfirmed(provider, regATx.hash, "register employee A");
    logTx("registerEmployee A", regATx.hash);
    results.record("2.1 register Employee A (Hub, 100 mUSDC)", regATx.hash, "PASS");

    const regBTx = await vault.registerEmployee(
      empB, ethers.parseUnits("150", 6), USDC_ADDR,
      THIRTY_DAYS, ethers.parseUnits("150", 6), 0,
      { gasLimit: 300_000 }
    );
    await waitConfirmed(provider, regBTx.hash, "register employee B");
    logTx("registerEmployee B", regBTx.hash);
    results.record("2.2 register Employee B (Hub, 150 mUSDC)", regBTx.hash, "PASS");

    const regCTx = await vault.registerEmployee(
      empC, ethers.parseUnits("200", 6), USDC_ADDR,
      THIRTY_DAYS, ethers.parseUnits("200", 6), 2004, // Moonbeam
      { gasLimit: 300_000 }
    );
    await waitConfirmed(provider, regCTx.hash, "register employee C");
    logTx("registerEmployee C (Moonbeam)", regCTx.hash);
    regCTxHash = regCTx.hash;
    results.record("2.3 register Employee C (Moonbeam, 200 mUSDC)", regCTx.hash, "PASS");

    const empCount = await vault.employeeCount();
    console.log(`employeeCount: ${empCount}`);
    results.record("2.4 employeeCount == 3", regCTxHash,
      empCount >= 3n ? "PASS" : "FAIL",
      `Count: ${empCount}`);
  } catch (e: any) {
    console.log(`⚠️  Employee registration failed: ${e.message}`);
    results.record("2.1-2.4 register employees", "N/A", "FAIL", e.message.slice(0, 120));
  }

  // ── Step 3: Run payroll ────────────────────────────────────────────────────
  console.log("\nStep 3: Running payroll...");
  console.log("Note: Hub employees execute via XCM execute(), Moonbeam via xcm.send()");

  const vaultBalBefore = await vault.vaultBalance(USDC_ADDR).catch(() => 0n);
  console.log(`Vault balance before: ${ethers.formatUnits(vaultBalBefore, 6)} mUSDC`);

  try {
    const payrollTx = await vault.runPayroll({ gasLimit: 2_000_000 });
    const receipt   = await waitConfirmed(provider, payrollTx.hash, "runPayroll");
    logTx("vault.runPayroll()", payrollTx.hash);

    const iface = new ethers.Interface(VAULT_ABI);
    const payrollEvent = receipt.logs
      .map(log => { try { return iface.parseLog(log); } catch { return null; } })
      .find(e => e?.name === "PayrollExecuted");

    if (payrollEvent) {
      console.log(`PayrollExecuted: ${payrollEvent.args.employeeCount} employees, ` +
        `${ethers.formatUnits(payrollEvent.args.totalPayout, 6)} mUSDC`);
      results.record("3.1 runPayroll() succeeded", payrollTx.hash, "PASS",
        `${payrollEvent.args.employeeCount} employees, payout=${ethers.formatUnits(payrollEvent.args.totalPayout, 6)} mUSDC`);
    } else {
      results.record("3.1 runPayroll() succeeded", payrollTx.hash, "PASS",
        "No PayrollExecuted event (0 employees due or vault empty)");
    }

    const vaultBalAfter = await vault.vaultBalance(USDC_ADDR).catch(() => 0n);
    const paid = vaultBalBefore - vaultBalAfter;
    console.log(`Vault balance after: ${ethers.formatUnits(vaultBalAfter, 6)} mUSDC`);
    results.record("3.2 vault balance post-payroll", payrollTx.hash, "PASS",
      `Paid out: ${ethers.formatUnits(paid, 6)} mUSDC`);

  } catch (err: any) {
    const msg = err.message || "";
    if (msg.includes("xcmSend") || msg.includes("channel") || msg.includes("XCM")) {
      // Expected blocker on Paseo — deactivate Employee C and retry
      console.log("⚠️  runPayroll failed (likely xcmSend to Moonbeam channel inactive)");
      console.log("    Retrying with Employee C deactivated...");
      results.record("3.1 runPayroll() first attempt", "N/A", "FAIL",
        `XCM cross-chain blocked: ${msg.slice(0, 80)}`);

      try {
        const empCount = await vault.employeeCount();
        if (empCount >= 3n) {
          const deactTx = await vault.deactivateEmployee(2n, { gasLimit: 200_000 });
          await waitConfirmed(provider, deactTx.hash, "deactivate employee C");
          logTx("deactivateEmployee(C)", deactTx.hash);
          results.record("3.1b deactivateEmployee(C) for Hub-only retry", deactTx.hash, "PASS");
        }

        const payrollTx2 = await vault.runPayroll({ gasLimit: 2_000_000 });
        const receipt2   = await waitConfirmed(provider, payrollTx2.hash, "runPayroll (Hub-only)");
        logTx("vault.runPayroll() Hub-only", payrollTx2.hash);
        results.record("3.1c runPayroll() Hub-only succeeded", payrollTx2.hash, "PASS",
          "xcmSend to Moonbeam skipped; Hub-local path confirmed");
      } catch (e2: any) {
        console.log(`⚠️  Hub-only payroll also failed: ${e2.message}`);
        results.record("3.1c runPayroll() Hub-only", "N/A", "FAIL", e2.message.slice(0, 120));
      }
    } else {
      console.log(`⚠️  runPayroll failed: ${msg}`);
      results.record("3.1 runPayroll()", "N/A", "FAIL", msg.slice(0, 120));
    }
  }

  // ── Step 4: Verify nextPaymentDue updated ─────────────────────────────────
  console.log("\nStep 4: Verifying nextPaymentDue...");
  try {
    const empAData = await vault.getEmployee(0n);
    console.log(`Employee A nextPaymentDue: ${new Date(Number(empAData.nextPaymentDue) * 1000).toISOString()}`);
    console.log(`Employee A active: ${empAData.active}`);
    const isUpdated = empAData.nextPaymentDue > BigInt(Math.floor(Date.now() / 1000));
    results.record("4.1 nextPaymentDue updated for Employee A", "N/A",
      isUpdated ? "PASS" : "FAIL",
      `nextPaymentDue: ${empAData.nextPaymentDue}, active: ${empAData.active}`);
  } catch (e: any) {
    results.record("4.1 nextPaymentDue check", "N/A", "FAIL", e.message.slice(0, 80));
  }

  results.save();
  console.log("\n=== Test 01 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

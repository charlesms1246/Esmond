/**
 * Script 03: Deploy Solidity Contracts to Paseo
 *
 * Deploys in order:
 *   1. PayrollVault (needs schedulerAddress from addresses.json)
 *   2. ConditionalEscrow
 *   3. SubscriptionManager
 *
 * Run: npx hardhat run scripts/deploy/03_deploy_solidity_contracts.ts --network paseo
 *
 * Reference: docs/TESTNET_WORKAROUNDS.md#WA-06 (gas limits)
 */

import { ethers }             from "hardhat";
import { log, logContract, saveAddresses,
         loadAddresses, verifyPrecompile,
         XCM_PRECOMPILE, PASEO_RPC } from "./utils";

async function main() {
  log("=== Step 3: Deploy Solidity Contracts to Paseo ===");

  const [deployer] = await ethers.getSigners();
  log(`Deployer: ${deployer.address}`);

  // ── Read active scheduler address ─────────────────────────────────────────
  const addresses = loadAddresses();
  const schedulerAddress = addresses.activeSchedulerAddress;
  if (!schedulerAddress || schedulerAddress === "NOT_DEPLOYED") {
    throw new Error("activeSchedulerAddress not found in addresses.json — run Script 02 first");
  }
  log(`Using scheduler: ${addresses.activeScheduler} @ ${schedulerAddress}`);

  // ── Verify precompiles are live before deploying ───────────────────────────
  const provider = new ethers.JsonRpcProvider(PASEO_RPC);
  await verifyPrecompile(provider, XCM_PRECOMPILE, "XCM");
  await verifyPrecompile(provider, addresses.precompiles?.erc20_mockUsdc, "Mock USDC ERC-20");
  await verifyPrecompile(provider, addresses.precompiles?.erc20_mockUsdt, "Mock USDT ERC-20");

  // ── 1. Deploy PayrollVault ─────────────────────────────────────────────────
  log("\nDeploying PayrollVault.sol...");
  const VaultFactory = await ethers.getContractFactory("PayrollVault");
  const vault        = await VaultFactory.deploy(schedulerAddress, {
    gasLimit: 3_000_000,
  });
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  log(`✅ PayrollVault deployed at: ${vaultAddr}`);
  logContract("PayrollVault", vaultAddr);

  // Verify constructor set schedulerContract correctly
  const storedScheduler = await (vault as any).schedulerContract();
  if (storedScheduler.toLowerCase() !== schedulerAddress.toLowerCase()) {
    throw new Error(`Scheduler address mismatch: expected ${schedulerAddress}, got ${storedScheduler}`);
  }
  log(`✅ schedulerContract verified: ${storedScheduler}`);

  // ── 2. Deploy ConditionalEscrow ────────────────────────────────────────────
  log("\nDeploying ConditionalEscrow.sol...");
  const EscrowFactory = await ethers.getContractFactory("ConditionalEscrow");
  const escrow        = await EscrowFactory.deploy({ gasLimit: 2_000_000 });
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  log(`✅ ConditionalEscrow deployed at: ${escrowAddr}`);
  logContract("ConditionalEscrow", escrowAddr);

  // ── 3. Deploy SubscriptionManager ─────────────────────────────────────────
  log("\nDeploying SubscriptionManager.sol...");
  const SubFactory = await ethers.getContractFactory("SubscriptionManager");
  const subMgr     = await SubFactory.deploy({ gasLimit: 2_000_000 });
  await subMgr.waitForDeployment();
  const subAddr = await subMgr.getAddress();
  log(`✅ SubscriptionManager deployed at: ${subAddr}`);
  logContract("SubscriptionManager", subAddr);

  // ── Save all addresses ─────────────────────────────────────────────────────
  saveAddresses({
    contracts: {
      ...(addresses.contracts || {}),
      PayrollVault:        vaultAddr,
      ConditionalEscrow:   escrowAddr,
      SubscriptionManager: subAddr,
    },
    step3_completed: new Date().toISOString(),
  });

  // ── Print deployment summary ───────────────────────────────────────────────
  log("\n========== DEPLOYMENT SUMMARY ==========");
  log(`Network:             Paseo (chainId: 420420422)`);
  log(`Deployer:            ${deployer.address}`);
  log(`Scheduler (active):  ${addresses.activeScheduler} @ ${schedulerAddress}`);
  log(`PayrollVault:        ${vaultAddr}`);
  log(`ConditionalEscrow:   ${escrowAddr}`);
  log(`SubscriptionManager: ${subAddr}`);
  log(`XCM Precompile:      ${XCM_PRECOMPILE}`);
  log(`Mock USDC Precompile:${addresses.precompiles?.erc20_mockUsdc}`);
  log(`Blockscout:          https://blockscout-passet-hub.parity-testnet.parity.io`);
  log("========================================\n");
  log("=== Step 3 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * Script 02: Deploy Rust PayrollScheduler via pallet_revive
 *
 * Two-step deployment:
 *   A. Upload PolkaVM bytecode → get code hash
 *   B. Instantiate contract    → get contract address
 *
 * Also deploys PayrollSchedulerFallback.sol via Hardhat.
 *
 * If pallet_revive upload fails, falls back to Solidity-only deployment
 * and sets activeScheduler = "PayrollSchedulerFallback".
 *
 * Run: npx ts-node scripts/deploy/02_deploy_rust_scheduler.ts
 *
 * Reference: docs/TESTNET_WORKAROUNDS.md#WA-03
 */

import * as fs                  from "fs";
import * as path                from "path";
import { createClient }         from "polkadot-api";
import { getWsProvider }        from "polkadot-api/ws-provider/node";
import { getPolkadotSigner }    from "polkadot-api/signer";
import { ethers }               from "hardhat";
import { log, logContract, saveAddresses,
         loadAddresses, PASEO_WS, sleep } from "./utils";

const POLKAVM_ARTIFACT = path.join(
  __dirname,
  "../../rust-contracts/payroll-scheduler/target/release/payroll_scheduler.polkavm"
);

async function deployRustScheduler(): Promise<string | null> {
  log("Attempting pallet_revive deployment of PayrollScheduler.rs...");

  // Check compiled artifact exists
  if (!fs.existsSync(POLKAVM_ARTIFACT)) {
    log("⚠️  PolkaVM artifact not found. Was 'revive build --release' run?");
    log(`   Expected: ${POLKAVM_ARTIFACT}`);
    return null;
  }

  const bytecode  = fs.readFileSync(POLKAVM_ARTIFACT);
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const wallet     = new ethers.Wallet(privateKey);

  const provider = getWsProvider(PASEO_WS);
  const client   = createClient(provider);
  const api      = client.getUnsafeApi();
  const signer   = getPolkadotSigner(
    ethers.getBytes(privateKey),
    "Ecdsa",
    async (data) => ethers.getBytes(wallet.signingKey.sign(data).serialized)
  );

  try {
    // ── A. Upload code ──────────────────────────────────────────────────────
    log("Uploading PolkaVM bytecode via revive.uploadCode...");
    const uploadTx = api.tx.Revive.upload_code({
      code:                  bytecode,
      storage_deposit_limit: null,
      determinism:           { type: "Enforced" },
    });
    const uploadResult = await uploadTx.signAndSubmit(signer);
    log(`✅ Code uploaded. Hash: ${uploadResult.txHash}`);

    // Extract code_hash from events
    const codeHash = uploadResult.events
      .find((e: any) => e.type === "Revive" && e.value.type === "CodeStored")
      ?.value.value.code_hash;

    if (!codeHash) throw new Error("CodeStored event not found — upload may have failed");
    log(`   Code hash: ${codeHash}`);
    await sleep(6000);

    // ── B. Instantiate ──────────────────────────────────────────────────────
    log("Instantiating PayrollScheduler via revive.instantiate...");

    // GAS_LIMIT: use generous limit for scheduler instantiation
    // The contract has no constructor logic — limit can be low
    const GAS_LIMIT = { ref_time: 500_000_000n, proof_size: 65_536n };

    const instantiateTx = api.tx.Revive.instantiate({
      value:                 0n,
      gas_limit:             GAS_LIMIT,
      storage_deposit_limit: null,
      code_hash:             codeHash,
      data:                  new Uint8Array(0),   // empty constructor
      salt:                  null,
    });
    const instantiateResult = await instantiateTx.signAndSubmit(signer);
    log(`✅ Instantiated. Hash: ${instantiateResult.txHash}`);

    // Extract contract address from Instantiated event
    const contractAddr = instantiateResult.events
      .find((e: any) => e.type === "Revive" && e.value.type === "Instantiated")
      ?.value.value.contract;

    if (!contractAddr) throw new Error("Instantiated event not found");

    // pallet_revive uses substrate H160 — convert if needed
    const evmAddr = contractAddr.startsWith("0x") ? contractAddr
      : "0x" + Buffer.from(contractAddr).toString("hex");

    log(`✅ PayrollScheduler deployed at: ${evmAddr}`);
    await sleep(6000);

    client.destroy();
    return evmAddr;

  } catch (err: any) {
    log(`⚠️  pallet_revive deployment failed: ${err.message}`);
    log("   Will use PayrollSchedulerFallback instead.");
    client.destroy();
    return null;
  }
}

async function deployFallbackScheduler(): Promise<string> {
  log("Deploying PayrollSchedulerFallback.sol via Hardhat...");
  const Factory  = await ethers.getContractFactory("PayrollSchedulerFallback");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  log(`✅ PayrollSchedulerFallback deployed at: ${addr}`);
  logContract("PayrollSchedulerFallback", addr);
  return addr;
}

async function main() {
  log("=== Step 2: Deploy PayrollScheduler ===");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  // Try Rust first; fall back to Solidity if unavailable
  const rustAddr     = await deployRustScheduler();
  const fallbackAddr = await deployFallbackScheduler();

  const activeAddr   = rustAddr ?? fallbackAddr;
  const activeLabel  = rustAddr ? "PayrollScheduler" : "PayrollSchedulerFallback";

  if (rustAddr) {
    log(`\n✅ Using RUST PayrollScheduler: ${rustAddr}`);
  } else {
    log(`\n⚠️  Using SOLIDITY fallback: ${fallbackAddr}`);
    log("   This is functionally equivalent. Document in BLOCKERS.md if Rust deployment failed.");
  }

  saveAddresses({
    contracts: {
      ...(loadAddresses().contracts || {}),
      PayrollScheduler:         rustAddr     ?? "NOT_DEPLOYED",
      PayrollSchedulerFallback: fallbackAddr,
    },
    activeScheduler: activeLabel,
    activeSchedulerAddress: activeAddr,
    step2_completed: new Date().toISOString(),
  });

  log("=== Step 2 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

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

import * as fs                           from "fs";
import * as path                         from "path";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { ethers }                        from "hardhat";
import { log, logContract, saveAddresses,
         loadAddresses, PASEO_WS, sleep } from "./utils";

const POLKAVM_ARTIFACT = path.join(
  __dirname,
  "../../rust-contracts/payroll-scheduler/target/release/payroll_scheduler.polkavm"
);

async function deployRustScheduler(): Promise<string | null> {
  log("Attempting pallet_revive deployment of PayrollScheduler.rs...");

  if (!fs.existsSync(POLKAVM_ARTIFACT)) {
    log("⚠️  PolkaVM artifact not found. Was 'revive build --release' run?");
    log(`   Expected: ${POLKAVM_ARTIFACT}`);
    return null;
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const bytecode   = fs.readFileSync(POLKAVM_ARTIFACT);

  log(`Connecting to Paseo via WebSocket: ${PASEO_WS}`);
  const wsProvider = new WsProvider(PASEO_WS);
  const api        = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;

  const keyring = new Keyring({ type: "ecdsa" });
  const pair    = keyring.addFromUri(privateKey);

  try {
    // ── A. Upload code ──────────────────────────────────────────────────────
    log("Uploading PolkaVM bytecode via revive.uploadCode...");
    let codeHash: string | null = null;

    await new Promise<void>((resolve, reject) => {
      (api.tx as any).revive
        .uploadCode(bytecode, null, "Enforced")
        .signAndSend(pair, ({ status, events, dispatchError }: any) => {
          if (dispatchError) {
            reject(new Error(`uploadCode failed: ${dispatchError.toString()}`));
            return;
          }
          if (status.isInBlock || status.isFinalized) {
            // Extract CodeStored event
            for (const { event } of events) {
              if (api.events.revive?.CodeStored?.is(event) ||
                  (event.section === "revive" && event.method === "CodeStored")) {
                codeHash = event.data[0]?.toString() ?? event.data.toHex?.();
                log(`✅ Code uploaded. Hash: ${codeHash}`);
              }
            }
            resolve();
          }
        });
    });

    if (!codeHash) throw new Error("CodeStored event not found — upload may have failed");
    await sleep(6000);

    // ── B. Instantiate ──────────────────────────────────────────────────────
    log("Instantiating PayrollScheduler via revive.instantiate...");
    const GAS_LIMIT = { refTime: 500_000_000, proofSize: 65_536 };
    let contractAddr: string | null = null;

    await new Promise<void>((resolve, reject) => {
      (api.tx as any).revive
        .instantiate(0, GAS_LIMIT, null, codeHash, "0x", null)
        .signAndSend(pair, ({ status, events, dispatchError }: any) => {
          if (dispatchError) {
            reject(new Error(`instantiate failed: ${dispatchError.toString()}`));
            return;
          }
          if (status.isInBlock || status.isFinalized) {
            for (const { event } of events) {
              if (event.section === "revive" && event.method === "Instantiated") {
                contractAddr = event.data[1]?.toString();
                log(`✅ Instantiated at: ${contractAddr}`);
              }
            }
            resolve();
          }
        });
    });

    if (!contractAddr) throw new Error("Instantiated event not found");
    await sleep(6000);
    await api.disconnect();
    return contractAddr;

  } catch (err: any) {
    log(`⚠️  pallet_revive deployment failed: ${err.message}`);
    log("   Will use PayrollSchedulerFallback instead.");
    await api.disconnect();
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

  const rustAddr     = await deployRustScheduler();
  const fallbackAddr = await deployFallbackScheduler();

  const activeAddr  = rustAddr ?? fallbackAddr;
  const activeLabel = rustAddr ? "PayrollScheduler" : "PayrollSchedulerFallback";

  if (rustAddr) {
    log(`\n✅ Using RUST PayrollScheduler: ${rustAddr}`);
  } else {
    log(`\n⚠️  Using SOLIDITY fallback: ${fallbackAddr}`);
    log("   Document in BLOCKERS.md if Rust deployment failed.");
  }

  saveAddresses({
    contracts: {
      ...(loadAddresses().contracts || {}),
      PayrollScheduler:         rustAddr     ?? "NOT_DEPLOYED",
      PayrollSchedulerFallback: fallbackAddr,
    },
    activeScheduler:        activeLabel,
    activeSchedulerAddress: activeAddr,
    step2_completed:        new Date().toISOString(),
  });

  log("=== Step 2 Complete ===");
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * Script 06: Redeploy PayrollVault and set up employees
 *
 * What it does:
 *   1. Deploys a fresh PayrollVault (fixed: direct ERC-20 transfer for Hub employees)
 *   2. Updates deployments/paseo/addresses.json
 *   3. Mints MockERC20 tokens to the deployer
 *   4. Deposits tokens into the new vault
 *   5. Registers the two specified employees (Hub-local, parachainId=0)
 *   6. Prints the new vault address for .env.local update
 *
 * Run: npx hardhat run scripts/deploy/06_redeploy_vault_and_setup.ts --network paseo
 */

import { ethers }  from "hardhat";
import { log, logContract, logTx, saveAddresses, loadAddresses, waitForTx } from "./utils";

const THIRTY_DAYS   = BigInt(30 * 24 * 3600);
const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6);   // 10 000 tUSDC into vault
const SALARY_A       = ethers.parseUnits("500",   6);   // 500 tUSDC / 30 days
const SALARY_B       = ethers.parseUnits("500",   6);

const EMP_A = "0x2E83Cf8877F7CAAe7F702c05fe10E05048D7Ded5";
const EMP_B = "0xce4389ACb79463062c362fACB8CB04513fA3D8D8";

const MOCK_ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const VAULT_WRITE_ABI = [
  "function deposit(address token, uint256 amount) external",
  "function registerEmployee(address wallet, uint256 salary, address token, uint256 interval, uint256 cap, uint32 parachainId) external returns (uint256)",
  "function employeeCount() view returns (uint256)",
  "function vaultBalance(address token) view returns (uint256)",
];

async function main() {
  log("=== Script 06: Redeploy PayrollVault + Setup ===");

  const [deployer] = await ethers.getSigners();
  log(`Deployer: ${deployer.address}`);

  const addresses      = loadAddresses();
  const schedulerAddr  = addresses.activeSchedulerAddress as string;
  const mockErc20Addr  = addresses.mockErc20 as string;

  if (!schedulerAddr || schedulerAddr === "NOT_DEPLOYED") {
    throw new Error("activeSchedulerAddress missing from addresses.json — run scripts 01-05 first");
  }
  if (!mockErc20Addr) {
    throw new Error("mockErc20 address missing from addresses.json — run script 05 first");
  }

  const provider = deployer.provider!;

  // ── 1. Deploy fresh PayrollVault ──────────────────────────────────────────
  log("\nStep 1: Deploying PayrollVault...");
  const VaultFactory = await ethers.getContractFactory("PayrollVault");
  const vault        = await VaultFactory.deploy(schedulerAddr, { gasLimit: 3_000_000 });
  await vault.waitForDeployment();
  const vaultAddr    = await vault.getAddress();
  log(`✅ PayrollVault deployed: ${vaultAddr}`);
  logContract("PayrollVault", vaultAddr);

  // ── 2. Update addresses.json ──────────────────────────────────────────────
  log("\nStep 2: Updating addresses.json...");
  saveAddresses({
    contracts: { ...addresses.contracts, PayrollVault: vaultAddr },
    step6_completed: new Date().toISOString(),
  });

  // ── 3. Mint MockERC20 to deployer ─────────────────────────────────────────
  log("\nStep 3: Minting MockERC20 tokens...");
  const token = new ethers.Contract(mockErc20Addr, MOCK_ERC20_ABI, deployer);

  const mintTx = await (token as any).mint(deployer.address, DEPOSIT_AMOUNT + SALARY_A + SALARY_B, {
    gasLimit: 200_000,
  });
  await waitForTx(provider, mintTx.hash, "mint MockERC20");
  const bal = await (token as any).balanceOf(deployer.address);
  log(`Deployer MockERC20 balance: ${ethers.formatUnits(bal, 6)}`);

  // ── 4. Approve + Deposit into vault ──────────────────────────────────────
  log("\nStep 4: Funding vault...");
  const approveTx = await (token as any).approve(vaultAddr, DEPOSIT_AMOUNT, { gasLimit: 200_000 });
  await waitForTx(provider, approveTx.hash, "approve vault");

  const vaultContract = new ethers.Contract(vaultAddr, VAULT_WRITE_ABI, deployer);
  const depositTx     = await (vaultContract as any).deposit(mockErc20Addr, DEPOSIT_AMOUNT, { gasLimit: 300_000 });
  await waitForTx(provider, depositTx.hash, "vault.deposit");
  logTx("vault.deposit", depositTx.hash);

  const vaultBal = await (vaultContract as any).vaultBalance(mockErc20Addr);
  log(`Vault balance: ${ethers.formatUnits(vaultBal, 6)} tUSDC`);

  // ── 5. Register employees ──────────────────────────────────────────────
  log("\nStep 5: Registering employees...");

  const regATx = await (vaultContract as any).registerEmployee(
    EMP_A, SALARY_A, mockErc20Addr, THIRTY_DAYS, SALARY_A, 0,
    { gasLimit: 300_000 }
  );
  await waitForTx(provider, regATx.hash, "registerEmployee A");
  logTx("registerEmployee A", regATx.hash);
  log(`✅ Employee A registered: ${EMP_A}`);

  const regBTx = await (vaultContract as any).registerEmployee(
    EMP_B, SALARY_B, mockErc20Addr, THIRTY_DAYS, SALARY_B, 0,
    { gasLimit: 300_000 }
  );
  await waitForTx(provider, regBTx.hash, "registerEmployee B");
  logTx("registerEmployee B", regBTx.hash);
  log(`✅ Employee B registered: ${EMP_B}`);

  const empCount = await (vaultContract as any).employeeCount();
  log(`employeeCount: ${empCount}`);

  // ── Summary ──────────────────────────────────────────────────────────────
  log("\n========== SETUP COMPLETE ==========");
  log(`New PayrollVault:  ${vaultAddr}`);
  log(`Scheduler:         ${schedulerAddr}`);
  log(`MockERC20 token:   ${mockErc20Addr}`);
  log(`Employee A:        ${EMP_A}  salary=${ethers.formatUnits(SALARY_A, 6)} tUSDC`);
  log(`Employee B:        ${EMP_B}  salary=${ethers.formatUnits(SALARY_B, 6)} tUSDC`);
  log(`Vault funded:      ${ethers.formatUnits(vaultBal, 6)} tUSDC`);
  log("");
  log("ACTION REQUIRED — update frontend/.env.local:");
  log(`  NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS=${vaultAddr}`);
  log("=====================================");
}

main().catch(err => { console.error(err); process.exit(1); });

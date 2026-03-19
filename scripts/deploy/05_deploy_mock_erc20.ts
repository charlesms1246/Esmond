/**
 * Script 05: Deploy MockERC20 to Paseo and mint to deployer.
 *
 * Used to unblock integration tests when the Asset Hub ERC-20 precompile
 * for asset IDs 1984/1337 has zero supply (admin is a 3rd-party account).
 *
 * Run: hardhat run scripts/deploy/05_deploy_mock_erc20.ts --network paseo
 *
 * Updates deployments/paseo/addresses.json with:
 *   mockErc20: <deployed address>
 */

import { ethers } from "hardhat";
import { saveAddresses } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} PAS\n`);

  // ── Deploy MockERC20 ────────────────────────────────────────────────────────
  const factory = await ethers.getContractFactory("MockERC20", {
    // Contract is in test/mocks/ — Hardhat finds it automatically since it scans sources
  });

  console.log("Deploying MockERC20 (tUSDC, 6 decimals)...");
  const mock = await factory.deploy("Test USDC", "tUSDC", 6);
  await mock.waitForDeployment();
  const mockAddr = await mock.getAddress();
  console.log(`✅ MockERC20 deployed at: ${mockAddr}`);

  // ── Mint 10,000,000 tUSDC to deployer ───────────────────────────────────────
  const MINT_AMOUNT = ethers.parseUnits("10000000", 6); // 10M tUSDC
  console.log(`\nMinting ${ethers.formatUnits(MINT_AMOUNT, 6)} tUSDC to deployer...`);
  const tx = await mock.mint(deployer.address, MINT_AMOUNT);
  await tx.wait();
  const balance = await mock.balanceOf(deployer.address);
  console.log(`✅ Deployer tUSDC balance: ${ethers.formatUnits(balance, 6)} tUSDC`);

  // ── Save to addresses.json ──────────────────────────────────────────────────
  saveAddresses({ mockErc20: mockAddr });
  console.log(`\n✅ Address saved to deployments/paseo/addresses.json`);
  console.log(`\nUpdate INTEGRATION_TOKEN env var or pass --mock-erc20 flag to use this in integration tests.`);
  console.log(`MockERC20 address: ${mockAddr}`);
}

main().catch(err => { console.error(err); process.exit(1); });

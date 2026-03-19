/**
 * Script 01: Register Mock Assets on Paseo Asset Hub
 *
 * Uses @polkadot/api to call Assets pallet extrinsics:
 *   1. assets.create(id, admin, minBalance)
 *   2. assets.setMetadata(id, name, symbol, decimals)
 *   3. assets.mint(id, beneficiary, amount)
 *
 * Run: npx ts-node scripts/deploy/01_register_mock_assets.ts
 *
 * Reference: docs/TESTNET_WORKAROUNDS.md#WA-01
 */

import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { ethers }                           from "ethers";
import { log, saveAddresses, PASEO_WS,
         MOCK_USDC_ASSET_ID, MOCK_USDT_ASSET_ID,
         MOCK_USDC_PRECOMPILE, MOCK_USDT_PRECOMPILE,
         PASEO_RPC, sleep }                from "./utils";

// ─── Asset definitions ────────────────────────────────────────────────────────
const ASSETS = [
  {
    id:         MOCK_USDC_ASSET_ID,
    name:       "Mock USDC",
    symbol:     "mUSDC",
    decimals:   6,
    precompile: MOCK_USDC_PRECOMPILE,
    mintAmount: 10_000_000_000_000n,  // 10,000,000 mUSDC (6 decimals)
  },
  {
    id:         MOCK_USDT_ASSET_ID,
    name:       "Mock USDT",
    symbol:     "mUSDT",
    decimals:   6,
    precompile: MOCK_USDT_PRECOMPILE,
    mintAmount: 10_000_000_000_000n,
  },
];

async function main() {
  log("=== Step 1: Register Mock Assets on Paseo ===");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  // ── Connect via @polkadot/api ─────────────────────────────────────────────
  log(`Connecting to Paseo via WebSocket: ${PASEO_WS}`);
  const wsProvider = new WsProvider(PASEO_WS);
  const api        = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;
  log(`✅ Connected. Chain: ${(await api.rpc.system.chain()).toString()}`);

  // ── Derive deployer keypair from EVM private key ──────────────────────────
  // On Paseo Asset Hub, Ethereum secp256k1 keys can sign Substrate extrinsics
  // using the "ethereum" keypair type (same key, Ethereum-compatible signing)
  const keyring = new Keyring({ type: "ecdsa" });
  const pair    = keyring.addFromUri(privateKey);
  log(`Deployer SS58 address: ${pair.address}`);

  const evmWallet = new ethers.Wallet(privateKey);
  log(`Deployer EVM address:  ${evmWallet.address}`);

  // ── Process each asset ────────────────────────────────────────────────────
  for (const asset of ASSETS) {
    log(`\nProcessing asset: ${asset.symbol} (ID: ${asset.id})`);

    // Check if already registered
    const existing = await (api.query.assets as any).asset(asset.id);
    const assetInfo = existing.toJSON();

    if (!assetInfo) {
      // Asset does not exist — create it
      log(`Creating ${asset.symbol}...`);
      await new Promise<void>((resolve, reject) => {
        (api.tx.assets as any)
          .create(asset.id, pair.address, 1)
          .signAndSend(pair, ({ status, dispatchError }: any) => {
            if (dispatchError) {
              reject(new Error(`create failed: ${dispatchError.toString()}`));
            } else if (status.isInBlock || status.isFinalized) {
              log(`✅ ${asset.symbol} created in block ${status.isInBlock ? status.asInBlock : status.asFinalized}`);
              resolve();
            }
          });
      });
      await sleep(6000);

      // Set metadata (only if we just created the asset — we're the admin)
      log(`Setting metadata for ${asset.symbol}...`);
      await new Promise<void>((resolve) => {
        (api.tx.assets as any)
          .setMetadata(asset.id, asset.name, asset.symbol, asset.decimals)
          .signAndSend(pair, ({ status, dispatchError }: any) => {
            if (dispatchError) {
              const errStr = dispatchError.isModule
                ? api.registry.findMetaError(dispatchError.asModule).docs.join(" ")
                : dispatchError.toString();
              log(`⚠️  setMetadata error: ${errStr}`);
              resolve();
            } else if (status.isInBlock || status.isFinalized) {
              log(`✅ Metadata set for ${asset.symbol}`);
              resolve();
            }
          });
      });
      await sleep(6000);

      // Mint supply to deployer (only if we just created the asset)
      log(`Minting ${asset.mintAmount} ${asset.symbol} to deployer...`);
      await new Promise<void>((resolve) => {
        (api.tx.assets as any)
          .mint(asset.id, pair.address, asset.mintAmount)
          .signAndSend(pair, ({ status, dispatchError }: any) => {
            if (dispatchError) {
              const errStr = dispatchError.isModule
                ? api.registry.findMetaError(dispatchError.asModule).docs.join(" ")
                : dispatchError.toString();
              log(`⚠️  mint error: ${errStr}`);
              resolve();
            } else if (status.isInBlock || status.isFinalized) {
              log(`✅ Minted ${asset.mintAmount} ${asset.symbol}`);
              resolve();
            }
          });
      });
      await sleep(6000);
    } else {
      log(`✅ ${asset.symbol} already registered (admin: ${assetInfo.admin ?? "unknown"}) — skipping substrate ops`);
    }

    // ── Verify via ERC-20 precompile ────────────────────────────────────────
    log(`Verifying ${asset.symbol} via ERC-20 precompile at ${asset.precompile}...`);
    const ethProvider = new ethers.JsonRpcProvider(PASEO_RPC);
    const erc20Abi    = [
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
    ];
    try {
      const erc20   = new ethers.Contract(asset.precompile, erc20Abi, ethProvider);
      const supply  = await erc20.totalSupply();
      const balance = await erc20.balanceOf(evmWallet.address);
      log(`  totalSupply:       ${supply.toString()}`);
      log(`  deployer balance:  ${balance.toString()}`);
      if (supply > 0n) {
        log(`✅ ${asset.symbol} precompile verified live and funded`);
      } else {
        log(`⚠️  ${asset.symbol} precompile shows zero supply — asset may need time to propagate`);
      }
    } catch (e: any) {
      log(`⚠️  ERC-20 precompile check failed: ${e.message}`);
    }
  }

  // ── Save results ──────────────────────────────────────────────────────────
  saveAddresses({
    network:     "paseo",
    chainId:     420420417,
    deployedAt:  new Date().toISOString(),
    precompiles: {
      xcm:            "0x00000000000000000000000000000000000A0000",
      erc20_mockUsdc: MOCK_USDC_PRECOMPILE,
      erc20_mockUsdt: MOCK_USDT_PRECOMPILE,
    },
    assetIds: {
      mockUsdc: MOCK_USDC_ASSET_ID,
      mockUsdt: MOCK_USDT_ASSET_ID,
    },
    deployerAddress:  evmWallet.address,
    step1_completed:  new Date().toISOString(),
  });

  log("\n=== Step 1 Complete ===");
  await api.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

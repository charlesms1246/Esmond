/**
 * Script 01: Register Mock Assets on Paseo Asset Hub
 *
 * Uses PAPI to call Assets pallet extrinsics:
 *   1. assets.create(id, admin, minBalance)
 *   2. assets.setMetadata(id, name, symbol, decimals)
 *   3. assets.mint(id, beneficiary, amount)
 *
 * Run: npx ts-node scripts/deploy/01_register_mock_assets.ts
 *
 * Reference: docs/TESTNET_WORKAROUNDS.md#WA-01
 */

import { createClient, Binary } from "polkadot-api";
import { getWsProvider }        from "polkadot-api/ws-provider";
import { getPolkadotSigner }    from "polkadot-api/signer";
import { ethers }               from "ethers";
import { log, saveAddresses, PASEO_WS,
         MOCK_USDC_ASSET_ID, MOCK_USDT_ASSET_ID,
         MOCK_USDC_PRECOMPILE, MOCK_USDT_PRECOMPILE,
         PASEO_RPC, sleep }  from "./utils";

// ─── Asset definitions ────────────────────────────────────────────────────────
const ASSETS = [
  {
    id:       MOCK_USDC_ASSET_ID,
    name:     "Mock USDC",
    symbol:   "mUSDC",
    decimals: 6,
    precompile: MOCK_USDC_PRECOMPILE,
    mintAmount: 10_000_000_000_000n, // 10,000,000 mUSDC (6 decimals)
  },
  {
    id:       MOCK_USDT_ASSET_ID,
    name:     "Mock USDT",
    symbol:   "mUSDT",
    decimals: 6,
    precompile: MOCK_USDT_PRECOMPILE,
    mintAmount: 10_000_000_000_000n,
  },
];

async function main() {
  log("=== Step 1: Register Mock Assets on Paseo ===");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  // ── Connect via PAPI ──────────────────────────────────────────────────────
  log(`Connecting to Paseo via WebSocket: ${PASEO_WS}`);
  const provider = getWsProvider(PASEO_WS);
  const client   = createClient(provider);

  // Get chain-specific typed API
  // Note: use 'asset_hub_paseo' descriptor when running npx papi add
  // For simplicity in scripts, use the unsafe API with known pallet names
  const api = client.getUnsafeApi();

  // ── Derive deployer account ───────────────────────────────────────────────
  // Convert EVM private key → Substrate keypair (same key, different encoding)
  const wallet = new ethers.Wallet(privateKey);
  log(`Deployer EVM address: ${wallet.address}`);

  // For substrate transactions, we need a polkadot signer
  // Use "Ecdsa" key type for MetaMask-compatible secp256k1 keys
  const signer = getPolkadotSigner(
    ethers.getBytes(privateKey),
    "Ecdsa",
    async (data) => {
      const sig = wallet.signingKey.sign(data);
      return ethers.getBytes(sig.serialized);
    }
  );

  // ── Process each asset ────────────────────────────────────────────────────
  for (const asset of ASSETS) {
    log(`\nProcessing asset: ${asset.symbol} (ID: ${asset.id})`);

    // Check if already registered (idempotent)
    try {
      const existing = await api.query.Assets.Asset.getValue(asset.id);
      if (existing) {
        log(`✅ ${asset.symbol} already registered — skipping create`);
      }
    } catch {
      // Asset does not exist — create it
      log(`Creating ${asset.symbol}...`);
      const createTx = api.tx.Assets.create({
        id:          asset.id,
        admin:       { type: "Id", value: wallet.address },
        min_balance: 1n,
      });
      const createResult = await createTx.signAndSubmit(signer);
      log(`✅ ${asset.symbol} created. Hash: ${createResult.txHash}`);
      await sleep(6000); // Wait for finalization
    }

    // Set metadata (idempotent — overwrite if needed)
    // name/symbol are SCALE BoundedVec<u8> — must be Binary, not plain strings
    log(`Setting metadata for ${asset.symbol}...`);
    const metaTx = api.tx.Assets.set_metadata({
      id:       asset.id,
      name:     Binary.fromText(asset.name),
      symbol:   Binary.fromText(asset.symbol),
      decimals: asset.decimals,
    });
    const metaResult = await metaTx.signAndSubmit(signer);
    log(`✅ Metadata set. Hash: ${metaResult.txHash}`);
    await sleep(6000);

    // Mint supply to deployer
    log(`Minting ${asset.mintAmount} ${asset.symbol} to deployer...`);
    const mintTx = api.tx.Assets.mint({
      id:           asset.id,
      beneficiary:  { type: "Id", value: wallet.address },
      amount:       asset.mintAmount,
    });
    const mintResult = await mintTx.signAndSubmit(signer);
    log(`✅ Minted. Hash: ${mintResult.txHash}`);
    await sleep(6000);

    // ── Verify via ERC-20 precompile ────────────────────────────────────────
    log(`Verifying ${asset.symbol} via ERC-20 precompile at ${asset.precompile}...`);
    const ethProvider = new ethers.JsonRpcProvider(PASEO_RPC);
    const erc20Abi    = ["function totalSupply() view returns (uint256)",
                         "function balanceOf(address) view returns (uint256)"];
    const erc20       = new ethers.Contract(asset.precompile, erc20Abi, ethProvider);
    const supply      = await erc20.totalSupply();
    const balance     = await erc20.balanceOf(wallet.address);
    log(`  totalSupply: ${supply.toString()}`);
    log(`  deployer balance: ${balance.toString()}`);
    if (supply === 0n) throw new Error(`${asset.symbol} precompile shows zero supply — asset registration failed`);
    log(`✅ ${asset.symbol} precompile verified live and funded`);
  }

  // ── Save results ──────────────────────────────────────────────────────────
  saveAddresses({
    network: "paseo",
    chainId: 420420422,
    deployedAt: new Date().toISOString(),
    precompiles: {
      xcm:            "0x00000000000000000000000000000000000A0000",
      erc20_mockUsdc: MOCK_USDC_PRECOMPILE,
      erc20_mockUsdt: MOCK_USDT_PRECOMPILE,
    },
    assetIds: {
      mockUsdc: MOCK_USDC_ASSET_ID,
      mockUsdt: MOCK_USDT_ASSET_ID,
    },
    deployerAddress: wallet.address,
    step1_completed: new Date().toISOString(),
  });

  log("\n=== Step 1 Complete ===");
  client.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });

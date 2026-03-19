/**
 * Utility: Mint mock tokens to the deployer address.
 * Run whenever the deployer's mUSDC/mUSDT balance is depleted between test runs.
 *
 * Run: npx ts-node scripts/deploy/mint_tokens.ts
 */

import * as dotenv from "dotenv";
import * as path   from "path";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PASEO_WS = process.env.PASEO_WS_URL || "wss://passet-hub-rpc.polkadot.io";
const MINT_AMOUNT = 10_000_000_000_000n; // 10,000,000 mUSDC (6 decimals)

const ASSETS = [
  { id: 1984, symbol: "mUSDC", mintAmount: MINT_AMOUNT },
  { id: 1337, symbol: "mUSDT", mintAmount: MINT_AMOUNT },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const wsProvider = new WsProvider(PASEO_WS);
  const api        = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;
  console.log(`Connected: ${(await api.rpc.system.chain()).toString()}`);

  const keyring = new Keyring({ type: "ecdsa" });
  const pair    = keyring.addFromUri(privateKey);

  const evmWallet = new ethers.Wallet(privateKey);
  console.log(`Deployer EVM : ${evmWallet.address}`);
  console.log(`Deployer SS58: ${pair.address}\n`);

  for (const asset of ASSETS) {
    console.log(`Minting ${asset.mintAmount} of asset ${asset.id} (${asset.symbol}) to deployer...`);
    await new Promise<void>((resolve) => {
      (api.tx.assets as any)
        .mint(asset.id, pair.address, asset.mintAmount)
        .signAndSend(pair, ({ status, dispatchError }: any) => {
          if (dispatchError) {
            const errStr = dispatchError.isModule
              ? api.registry.findMetaError(dispatchError.asModule).docs.join(" ")
              : dispatchError.toString();
            console.warn(`⚠️  mint error for ${asset.symbol}: ${errStr}`);
            resolve();
          } else if (status.isInBlock || status.isFinalized) {
            console.log(`✅ Minted ${asset.mintAmount} ${asset.symbol} in block`);
            resolve();
          }
        });
    });
    await sleep(6000);
  }

  await api.disconnect();
  console.log("\nDone. Re-run the integration tests.");
}

main().catch(err => { console.error(err); process.exit(1); });

// scripts/deploy/utils.ts
import * as dotenv from "dotenv";
import * as path   from "path";
import * as fs     from "fs";
import type { JsonRpcProvider, TransactionReceipt } from "ethers";

// Load .env from project root — required for ts-node scripts (hardhat run loads it via hardhat.config.ts)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ─── Network constants ────────────────────────────────────────────────────────
export const PASEO_CHAIN_ID = 420420417;

// Paseo Asset Hub EVM RPC (Ethereum-compatible JSON-RPC, chainId 420420417)
export const PASEO_EVM_RPC  = process.env.PASEO_RPC_URL || "https://eth-rpc-testnet.polkadot.io/";
// Keep PASEO_RPC as an alias for backwards compatibility with script 03/04
export const PASEO_RPC      = PASEO_EVM_RPC;

// Paseo Asset Hub native Substrate WebSocket (for @polkadot/api and PAPI)
export const PASEO_WS       = process.env.PASEO_WS_URL  || "wss://passet-hub-rpc.polkadot.io";

export const BLOCKSCOUT_URL = "https://blockscout-passet-hub.parity-testnet.parity.io";

// ─── Precompile addresses (do not modify) ─────────────────────────────────────
// XCM precompile — from polkadot-sdk pallet-xcm
export const XCM_PRECOMPILE       = "0x00000000000000000000000000000000000A0000";

// ERC-20 precompile formula: bytes4(0xFFFFFFFF) ++ bytes12(0x00) ++ bytes4(assetId)
// assetId 1984 (0x7C0) → 29 leading zeros + 7C0  = correct 20-byte address
export const MOCK_USDC_PRECOMPILE = "0xFFFFFFFF000000000000000000000000000007C0";
// assetId 1337 (0x539) → 29 leading zeros + 539  = correct 20-byte address
export const MOCK_USDT_PRECOMPILE = "0xFFFFFFFF00000000000000000000000000000539";

export const MOCK_USDC_ASSET_ID   = 1984;
export const MOCK_USDT_ASSET_ID   = 1337;

// ─── Addresses registry ───────────────────────────────────────────────────────
const ADDRESSES_PATH = path.join(__dirname, "../../deployments/paseo/addresses.json");

export function loadAddresses(): Record<string, any> {
  if (!fs.existsSync(ADDRESSES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8"));
}

export function saveAddresses(data: Record<string, any>): void {
  const dir = path.dirname(ADDRESSES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = loadAddresses();
  const merged   = { ...existing, ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(merged, null, 2));
  console.log(`✅ addresses.json updated: ${ADDRESSES_PATH}`);
}

// ─── Logging helpers ──────────────────────────────────────────────────────────
export function log(msg: string)        { console.log(`[DEPLOY] ${msg}`); }
export function logTx(label: string, hash: string) {
  console.log(`[TX] ${label}: ${BLOCKSCOUT_URL}/tx/${hash}`);
}
export function logContract(label: string, addr: string) {
  console.log(`[CONTRACT] ${label}: ${BLOCKSCOUT_URL}/address/${addr}`);
}

// ─── Wait for receipt with timeout ───────────────────────────────────────────
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function waitForTx(
  provider: JsonRpcProvider,
  hash: string,
  label: string,
  timeoutMs = 60_000
): Promise<TransactionReceipt> {
  log(`Waiting for ${label} (${hash.slice(0, 10)}...)...`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) {
      if (receipt.status === 0) throw new Error(`${label} REVERTED: ${hash}`);
      log(`✅ ${label} confirmed in block ${receipt.blockNumber}`);
      logTx(label, hash);
      return receipt;
    }
    await sleep(3000);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms: ${hash}`);
}

// ─── Verify precompile is live ────────────────────────────────────────────────
export async function verifyPrecompile(
  provider: JsonRpcProvider,
  address: string,
  label: string
): Promise<void> {
  const code = await provider.getCode(address);
  if (code === "0x" || code === "") {
    throw new Error(`${label} precompile at ${address} has no bytecode — not live on this network`);
  }
  log(`✅ ${label} precompile confirmed live at ${address}`);
}

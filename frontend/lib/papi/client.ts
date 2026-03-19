// frontend/lib/papi/client.ts
/**
 * Polkadot-API (PAPI) client for substrate-level queries.
 *
 * Used for:
 *  - Asset balance queries (via Assets pallet)
 *  - Event subscriptions (transfer events, payroll events)
 *  - Block number tracking
 *
 * NOT used for contract calls — those go through wagmi/viem.
 *
 * Reference: https://papi.how/getting-started
 */

import { createClient }          from "polkadot-api";
import { getWsProvider }         from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";

const WS_URL = process.env.NEXT_PUBLIC_PASEO_WS_URL || "wss://asset-hub-paseo-rpc.n.dwellir.com";

// Singleton client — created once per browser session
let _client: ReturnType<typeof createClient> | null = null;

export function getPapiClient() {
  if (typeof window === "undefined") return null; // SSR guard
  if (_client) return _client;

  const provider = withPolkadotSdkCompat(getWsProvider(WS_URL));
  _client = createClient(provider);
  return _client;
}

export function destroyPapiClient() {
  if (_client) {
    _client.destroy();
    _client = null;
  }
}

// ─── Unsafe API accessor ─────────────────────────────────────────────────
// Use the unsafe API for generic pallet queries without generated descriptors.
// For production, run: npx papi add paseo -n asset_hub_paseo && npx papi
export function getPapiUnsafeApi() {
  const client = getPapiClient();
  if (!client) return null;
  return client.getUnsafeApi();
}

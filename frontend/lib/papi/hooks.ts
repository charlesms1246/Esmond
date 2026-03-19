// frontend/lib/papi/hooks.ts
/**
 * PAPI React hooks for real-time chain data.
 *
 * useAssetBalance  — live balance of an Asset Hub asset for an address
 * useBlockNumber   — current best finalized block number
 * useVaultBalance  — convenience: mUSDC balance of PayrollVault
 * useTransferEvents — recent events from Blockscout API fallback
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getPapiClient }                    from "./client";
import { ASSET_IDS }                        from "../contracts/addresses";

// ─── useAssetBalance ──────────────────────────────────────────────────────
/**
 * Subscribe to an Asset Hub asset balance for a given address via PAPI.
 * Returns balance in base units (e.g. 6 decimals for mUSDC).
 * Auto-refreshes every 6 seconds (approx 1 block on Paseo).
 */
export function useAssetBalance(
  assetId: number | null,
  address: string | null | undefined
): { balance: bigint; isLoading: boolean; error: string | null } {
  const [balance,   setBalance]   = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!assetId || !address) return;
    const client = getPapiClient();
    if (!client) return;

    setIsLoading(true);
    try {
      const api     = client.getUnsafeApi();
      // Assets.Account storage query: (assetId, address) → AccountData
      const account = await api.query.Assets.Account.getValue(assetId, address);
      setBalance(account?.balance ?? 0n);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [assetId, address]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 6000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, isLoading, error };
}

// ─── useBlockNumber ───────────────────────────────────────────────────────
/**
 * Subscribe to the latest finalized block number.
 */
export function useBlockNumber(): { blockNumber: number | null } {
  const [blockNumber, setBlockNumber] = useState<number | null>(null);

  useEffect(() => {
    const client = getPapiClient();
    if (!client) return;
    const sub = client.finalizedBlock$.subscribe(block => {
      setBlockNumber(block.number);
    });
    return () => sub.unsubscribe();
  }, []);

  return { blockNumber };
}

// ─── useVaultBalance ─────────────────────────────────────────────────────
/**
 * Convenience hook: mUSDC balance of the PayrollVault contract.
 * Combines useAssetBalance with the vault address.
 */
export function useVaultBalance(vaultAddress: string | null | undefined) {
  return useAssetBalance(ASSET_IDS.MOCK_USDC, vaultAddress ?? null);
}

// ─── useTransferEvents ───────────────────────────────────────────────────
/**
 * Fetch recent contract events from Blockscout API.
 * Used for payroll history display.
 * Falls back gracefully if Blockscout is slow or unavailable.
 */
export function useTransferEvents(contractAddress: string | null | undefined, limit = 10) {
  const [events,    setEvents]    = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const BLOCKSCOUT_API = "https://blockscout-testnet.polkadot.io/api/v2";

  const fetchEvents = useCallback(async () => {
    if (!contractAddress) return;
    setIsLoading(true);
    try {
      const url = `${BLOCKSCOUT_API}/addresses/${contractAddress}/logs?limit=${limit}`;
      const res = await fetch(url, { next: { revalidate: 12 } }); // revalidate ~2 blocks
      if (!res.ok) throw new Error(`Blockscout API ${res.status}`);
      const data = await res.json();
      setEvents(data.items ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      // Don't clear existing events on error — stale data is better than empty
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, limit]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 12000); // every ~2 blocks
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, isLoading, error };
}

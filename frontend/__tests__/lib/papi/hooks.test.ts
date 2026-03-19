// frontend/__tests__/lib/papi/hooks.test.ts

import { renderHook, act } from "@testing-library/react";
import { useAssetBalance, useBlockNumber } from "@/lib/papi/hooks";

// polkadot-api is auto-mocked from __mocks__/polkadot-api.ts

describe("useAssetBalance", () => {
  it("returns 0 when address is null", () => {
    const { result } = renderHook(() => useAssetBalance(1984, null));
    expect(result.current.balance).toBe(0n);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns balance when assetId and address are provided", async () => {
    const { result } = renderHook(() =>
      useAssetBalance(1984, "0xDeployer000000000000000000000000000000001")
    );
    // Wait for async fetch
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(result.current.balance).toBe(5_000_000n); // from mock
  });

  it("returns 0 when assetId is null", () => {
    const { result } = renderHook(() =>
      useAssetBalance(null, "0xDeployer000000000000000000000000000000001")
    );
    expect(result.current.balance).toBe(0n);
  });
});

describe("useBlockNumber", () => {
  it("returns block number from PAPI subscription", async () => {
    const { result } = renderHook(() => useBlockNumber());
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(result.current.blockNumber).toBe(1000); // from mock
  });
});

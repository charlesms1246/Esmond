// frontend/__tests__/hooks/useSubscriptionManager.test.ts

import { renderHook, act } from "@testing-library/react";
import { useCreatePlan, useSubscribe, useCharge, useRevoke } from "@/hooks/useSubscriptionManager";
import { useWriteContract } from "wagmi";

const MOCK_TX = "0xTxHash000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const TOKEN   = "0xFFFFFFFF000000000000000000000000000007C0" as `0x${string}`;

describe("useCreatePlan", () => {
  it("calls createPlan with correct args", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useCreatePlan());
    await act(async () => {
      await result.current.createPlan({
        token: TOKEN, chargeAmount: 10_000_000n,
        interval: 2592000n, maxCharges: 0n, expiry: 0n,
      });
    });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "createPlan",
        args: [TOKEN, 10_000_000n, 2592000n, 0n, 0n],
      })
    );
    expect(result.current.txStatus.status).toBe("success");
  });
});

describe("useSubscribe", () => {
  it("calls approve then subscribe (two-step)", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useSubscribe());
    await act(async () => {
      await result.current.subscribe({ planId: 0n, approvedCap: 50_000_000n, token: TOKEN });
    });

    // Call 1: approve
    expect(mockWrite.mock.calls[0][0].functionName).toBe("approve");
    expect(mockWrite.mock.calls[0][0].args[1]).toBe(50_000_000n); // amount = cap

    // Call 2: subscribe
    expect(mockWrite.mock.calls[1][0].functionName).toBe("subscribe");
    expect(mockWrite.mock.calls[1][0].args).toEqual([0n, 50_000_000n]);
  });
});

describe("useCharge", () => {
  it("calls charge with correct subscription id", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useCharge());
    await act(async () => { await result.current(1n); });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "charge", args: [1n] })
    );
  });
});

describe("useRevoke", () => {
  it("calls revoke with correct subscription id", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useRevoke());
    await act(async () => { await result.current(3n); });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "revoke", args: [3n] })
    );
  });
});

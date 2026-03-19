// frontend/__tests__/hooks/useConditionalEscrow.test.ts

import { renderHook, act } from "@testing-library/react";
import { useCreateMilestone, useApproveMilestone, useReclaimExpired } from "@/hooks/useConditionalEscrow";
import { useWriteContract } from "wagmi";

const MOCK_TX = "0xTxHash000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const TOKEN   = "0xFFFFFFFF000000000000000000000000000007C0" as `0x${string}`;

describe("useCreateMilestone", () => {
  it("calls approve then createMilestone (two-step)", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useCreateMilestone());

    await act(async () => {
      await result.current.createMilestone({
        payee:             "0xPayee00000000000000000000000000000000001" as `0x${string}`,
        token:             TOKEN,
        amount:            500_000_000n,
        approvers:         ["0xApprover0000000000000000000000000000001" as `0x${string}`],
        approvalsRequired: 1n,
        disputeDeadline:   BigInt(Math.floor(Date.now() / 1000) + 86400),
      });
    });

    // Call 1: approve
    expect(mockWrite.mock.calls[0][0].functionName).toBe("approve");
    // Call 2: createMilestone
    expect(mockWrite.mock.calls[1][0].functionName).toBe("createMilestone");
    expect(result.current.txStatus.status).toBe("success");
  });

  it("transitions through idle → pending → success", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useCreateMilestone());
    expect(result.current.txStatus.status).toBe("idle");

    await act(async () => {
      await result.current.createMilestone({
        payee:             "0xPayee00000000000000000000000000000000001" as `0x${string}`,
        token:             TOKEN,
        amount:            500_000_000n,
        approvers:         ["0xApprover0000000000000000000000000000001" as `0x${string}`],
        approvalsRequired: 1n,
        disputeDeadline:   BigInt(Date.now() + 86400),
      });
    });

    expect(result.current.txStatus.status).toBe("success");
  });
});

describe("useApproveMilestone", () => {
  it("calls approveMilestone with correct milestone id", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useApproveMilestone());
    await act(async () => { await result.current(0n); });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "approveMilestone", args: [0n] })
    );
  });
});

describe("useReclaimExpired", () => {
  it("calls reclaimExpired with correct milestone id", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX);
    (useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync: mockWrite });

    const { result } = renderHook(() => useReclaimExpired());
    await act(async () => { await result.current(2n); });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "reclaimExpired", args: [2n] })
    );
  });
});

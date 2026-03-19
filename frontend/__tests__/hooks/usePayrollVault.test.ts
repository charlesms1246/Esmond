// frontend/__tests__/hooks/usePayrollVault.test.ts

import { renderHook, act } from "@testing-library/react";
import {
  useEmployeeCount, useEmployee, useVaultTokenBalance,
  useDeposit, useRegisterEmployee, useRunPayroll,
} from "@/hooks/usePayrollVault";
import { useReadContract, useWriteContract } from "wagmi";

// wagmi is auto-mocked from __mocks__/wagmi.ts

const MOCK_TX_HASH = "0xTxHash000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const MOCK_TOKEN   = "0xFFFFFFFF000000000000000000000000000007C0" as `0x${string}`;
const MOCK_AMOUNT  = 1_000_000n;

describe("useEmployeeCount", () => {
  it("returns data from useReadContract", () => {
    (useReadContract as jest.Mock).mockReturnValueOnce({
      data: 3n, isLoading: false, error: null,
    });
    const { result } = renderHook(() => useEmployeeCount());
    expect(result.current.data).toBe(3n);
  });

  it("returns loading state", () => {
    (useReadContract as jest.Mock).mockReturnValueOnce({
      data: undefined, isLoading: true, error: null,
    });
    const { result } = renderHook(() => useEmployeeCount());
    expect(result.current.isLoading).toBe(true);
  });
});

describe("useEmployee", () => {
  it("is disabled when id is undefined", () => {
    renderHook(() => useEmployee(undefined));
    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) })
    );
  });

  it("is enabled when id is provided", () => {
    renderHook(() => useEmployee(0n));
    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getEmployee",
        args: [0n],
      })
    );
  });
});

describe("useVaultTokenBalance", () => {
  it("polls every 6 seconds via refetchInterval", () => {
    renderHook(() => useVaultTokenBalance(MOCK_TOKEN));
    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: 6000 }),
      })
    );
  });
});

describe("useDeposit", () => {
  it("calls approve then deposit and returns success status", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX_HASH);
    (useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: mockWrite,
    });

    const { result } = renderHook(() => useDeposit());
    expect(result.current.txStatus.status).toBe("idle");

    await act(async () => {
      await result.current.deposit(MOCK_TOKEN, MOCK_AMOUNT);
    });

    // Should have been called twice: once for approve, once for deposit
    expect(mockWrite).toHaveBeenCalledTimes(2);

    // First call: approve
    expect(mockWrite.mock.calls[0][0]).toMatchObject({
      functionName: "approve",
      args: [expect.any(String), MOCK_AMOUNT],
    });

    // Second call: deposit
    expect(mockWrite.mock.calls[1][0]).toMatchObject({
      functionName: "deposit",
      args: [MOCK_TOKEN, MOCK_AMOUNT],
    });

    expect(result.current.txStatus.status).toBe("success");
    expect((result.current.txStatus as any).hash).toBe(MOCK_TX_HASH);
  });

  it("sets error status when transaction fails", async () => {
    const mockWrite = jest.fn().mockRejectedValue({
      shortMessage: "User rejected",
    });
    (useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: mockWrite,
    });

    const { result } = renderHook(() => useDeposit());

    await act(async () => {
      try { await result.current.deposit(MOCK_TOKEN, MOCK_AMOUNT); }
      catch {}
    });

    expect(result.current.txStatus.status).toBe("error");
    expect((result.current.txStatus as any).error).toBe("User rejected");
  });
});

describe("useRegisterEmployee", () => {
  it("calls registerEmployee with correct args", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX_HASH);
    (useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: mockWrite,
    });

    const { result } = renderHook(() => useRegisterEmployee());

    await act(async () => {
      await result.current.registerEmployee({
        wallet:      "0x1234567890123456789012345678901234567890",
        salary:      100_000_000n,
        token:       MOCK_TOKEN,
        interval:    2_592_000n,
        cap:         100_000_000n,
        parachainId: 0,
      });
    });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "registerEmployee",
        args: expect.arrayContaining([
          "0x1234567890123456789012345678901234567890",
          100_000_000n,
          MOCK_TOKEN,
          2_592_000n,
          100_000_000n,
          0,
        ]),
      })
    );
    expect(result.current.txStatus.status).toBe("success");
  });
});

describe("useRunPayroll", () => {
  it("uses gasLimit 2_000_000n for XCM overhead", async () => {
    const mockWrite = jest.fn().mockResolvedValue(MOCK_TX_HASH);
    (useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: mockWrite,
    });

    const { result } = renderHook(() => useRunPayroll());

    await act(async () => { await result.current.runPayroll(); });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "runPayroll",
        gas:          2_000_000n,
      })
    );
  });
});

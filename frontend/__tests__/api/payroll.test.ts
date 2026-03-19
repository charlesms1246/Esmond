// frontend/__tests__/api/payroll.test.ts
/**
 * Tests for GET /api/payroll route handler.
 * Mocks viem createPublicClient to avoid live chain calls.
 */

import { GET } from "@/app/api/payroll/route";

// Mock viem
jest.mock("viem", () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn()
      .mockResolvedValueOnce(2n)          // employeeCount = 2
      .mockResolvedValueOnce({            // employee 0
        wallet:         "0xEmployee100000000000000000000000000000001",
        salaryAmount:   100_000_000n,
        payToken:       "0xFFFFFFFF000000000000000000000000000007C0",
        payInterval:    2592000n,
        nextPaymentDue: 1700000000n,
        approvedCap:    100_000_000n,
        parachainId:    0,
        active:         true,
      })
      .mockResolvedValueOnce({            // employee 1
        wallet:         "0xEmployee200000000000000000000000000000002",
        salaryAmount:   200_000_000n,
        payToken:       "0xFFFFFFFF000000000000000000000000000007C0",
        payInterval:    2592000n,
        nextPaymentDue: 1700000000n,
        approvedCap:    200_000_000n,
        parachainId:    2004,
        active:         true,
      }),
  })),
  http:        jest.fn(() => "mock-transport"),
  defineChain: jest.fn((c: any) => c),
}));

describe("GET /api/payroll", () => {
  it("returns employees array with correct structure", async () => {
    const response = await GET();
    const data     = await response.json();

    expect(data.total).toBe(2);
    expect(data.employees).toHaveLength(2);
  });

  it("converts bigint fields to strings for JSON serialisation", async () => {
    const response = await GET();
    const data     = await response.json();
    const emp      = data.employees[0];

    expect(typeof emp.salaryAmount).toBe("string");
    expect(typeof emp.payInterval).toBe("string");
    expect(emp.salaryAmount).toBe("100000000");
  });

  it("includes parachainName for each employee", async () => {
    const response = await GET();
    const data     = await response.json();

    expect(data.employees[0].parachainName).toBe("Polkadot Hub");
    expect(data.employees[1].parachainName).toBe("Moonbeam");
  });

  it("returns 500 with error message on chain failure", async () => {
    const { createPublicClient } = require("viem");
    (createPublicClient as jest.Mock).mockReturnValueOnce({
      readContract: jest.fn().mockRejectedValue(new Error("RPC connection refused")),
    });

    const response = await GET();
    const data     = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toContain("RPC connection refused");
  });
});

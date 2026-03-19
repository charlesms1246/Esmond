// frontend/__tests__/api/milestones.test.ts

import { GET } from "@/app/api/milestones/route";

jest.mock("viem", () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn().mockResolvedValue(1n),  // milestoneCount = 1
    getContractEvents: jest.fn().mockResolvedValue([
      {
        args: {
          id:     0n,
          payer:  "0xPayer000000000000000000000000000000000001",
          payee:  "0xPayee000000000000000000000000000000000001",
          amount: 500_000_000n,
        },
      },
    ]),
  })),
  http:        jest.fn(() => "mock-transport"),
  defineChain: jest.fn((c: any) => c),
}));

describe("GET /api/milestones", () => {
  it("returns milestones array", async () => {
    const response = await GET();
    const data     = await response.json();

    expect(data.total).toBe(1);
    expect(data.milestones).toHaveLength(1);
  });

  it("milestone amount is stringified bigint", async () => {
    const response = await GET();
    const data     = await response.json();
    expect(typeof data.milestones[0].amount).toBe("string");
    expect(data.milestones[0].amount).toBe("500000000");
  });

  it("returns 500 on RPC error", async () => {
    const { createPublicClient } = require("viem");
    (createPublicClient as jest.Mock).mockReturnValueOnce({
      readContract:      jest.fn().mockRejectedValue(new Error("timeout")),
      getContractEvents: jest.fn().mockRejectedValue(new Error("timeout")),
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

// frontend/__tests__/api/subscriptions.test.ts

import { GET } from "@/app/api/subscriptions/route";

jest.mock("viem", () => ({
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn()
      .mockResolvedValueOnce(1n)   // planCount
      .mockResolvedValueOnce(2n),  // subscriptionCount
    getContractEvents: jest.fn()
      .mockResolvedValueOnce([{    // PlanCreated events
        args: {
          planId:       0n,
          provider:     "0xProvider00000000000000000000000000000001",
          token:        "0xFFFFFFFF000000000000000000000000000007C0",
          chargeAmount: 10_000_000n,
          interval:     2592000n,
        },
      }])
      .mockResolvedValueOnce([{    // Subscribed events
        args: {
          subscriptionId: 0n,
          subscriber:     "0xSubscriber0000000000000000000000000000001",
          planId:         0n,
          approvedCap:    120_000_000n,
        },
      }]),
  })),
  http:        jest.fn(() => "mock-transport"),
  defineChain: jest.fn((c: any) => c),
}));

describe("GET /api/subscriptions", () => {
  it("returns plans and subscriptions", async () => {
    const response = await GET();
    const data     = await response.json();

    expect(data.totalPlans).toBe(1);
    expect(data.totalSubs).toBe(2);
    expect(data.plans).toHaveLength(1);
    expect(data.subscriptions).toHaveLength(1);
  });

  it("chargeAmount is stringified bigint", async () => {
    const response = await GET();
    const data     = await response.json();
    expect(typeof data.plans[0].chargeAmount).toBe("string");
    expect(data.plans[0].chargeAmount).toBe("10000000");
  });

  it("returns 500 on error", async () => {
    const { createPublicClient } = require("viem");
    (createPublicClient as jest.Mock).mockReturnValueOnce({
      readContract:      jest.fn().mockRejectedValue(new Error("fail")),
      getContractEvents: jest.fn().mockRejectedValue(new Error("fail")),
    });
    const response = await GET();
    expect(response.status).toBe(500);
  });
});

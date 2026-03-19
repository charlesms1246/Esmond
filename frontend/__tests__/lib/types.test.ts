// frontend/__tests__/lib/types.test.ts
/**
 * Structural tests for TypeScript type definitions.
 * These verify the DTO serialisation contract (bigint → string).
 */

import type { EmployeeDTO, MilestoneDTO, SubscriptionDTO, TxStatus } from "@/lib/types";

describe("DTO types — bigint-to-string serialisation contract", () => {
  it("EmployeeDTO uses strings for numeric fields", () => {
    const dto: EmployeeDTO = {
      id:             "0",
      wallet:         "0x1234567890123456789012345678901234567890",
      salaryAmount:   "100000000",
      payToken:       "0xFFFFFFFF000000000000000000000000000007C0",
      payInterval:    "2592000",
      nextPaymentDue: "1700000000",
      approvedCap:    "100000000",
      parachainId:    0,
      parachainName:  "Polkadot Hub",
      active:         true,
    };
    expect(typeof dto.salaryAmount).toBe("string");
    expect(typeof dto.payInterval).toBe("string");
    expect(typeof dto.parachainId).toBe("number");
  });

  it("MilestoneDTO status union is correct", () => {
    const statuses: MilestoneDTO["status"][] = ["active", "released", "reclaimed", "expired"];
    expect(statuses).toHaveLength(4);
  });

  it("TxStatus union covers all states", () => {
    const idle:    TxStatus = { status: "idle" };
    const pending: TxStatus = { status: "pending", hash: "0x1" };
    const success: TxStatus = { status: "success", hash: "0x1" };
    const error:   TxStatus = { status: "error",   error: "msg" };
    expect(idle.status).toBe("idle");
    expect(pending.status).toBe("pending");
    expect(success.status).toBe("success");
    expect(error.status).toBe("error");
  });
});

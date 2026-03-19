// frontend/app/api/milestones/route.ts
/**
 * GET /api/milestones
 * Returns all milestones from ConditionalEscrow using getMilestone(id) view calls.
 * Reads each milestone by index (0..count-1) — avoids eth_getLogs block-range limits.
 */

import { NextResponse }             from "next/server";
import { createPublicClient, http } from "viem";
import { paseo }                    from "@/lib/wagmi/config";
import { CONDITIONAL_ESCROW_ABI }   from "@/lib/contracts/abis";
import { getContractAddresses }     from "@/lib/contracts/addresses";
import type { MilestoneDTO }        from "@/lib/types";

export async function GET() {
  try {
    const client = createPublicClient({ chain: paseo, transport: http() });
    const addr   = getContractAddresses().ConditionalEscrow;

    const count = await client.readContract({
      address: addr, abi: CONDITIONAL_ESCROW_ABI, functionName: "milestoneCount",
    }) as bigint;

    const limit = Number(count) > 50 ? 50 : Number(count);

    // Fetch each milestone by index in parallel
    const milestonePromises = Array.from({ length: limit }, (_, i) =>
      client.readContract({
        address:      addr,
        abi:          CONDITIONAL_ESCROW_ABI,
        functionName: "getMilestone",
        args:         [BigInt(i)],
      })
    );
    const milestones = await Promise.all(milestonePromises) as any[];

    const now = BigInt(Math.floor(Date.now() / 1000));

    const dtos: MilestoneDTO[] = milestones.map((m: any, i: number) => {
      let status: MilestoneDTO["status"] = "active";
      if (m.released)  status = "released";
      else if (m.reclaimed) status = "reclaimed";
      else if (m.disputeDeadline > 0n && m.disputeDeadline < now) status = "expired";

      return {
        id:                String(i),
        payer:             m.payer,
        payee:             m.payee,
        token:             m.token,
        amount:            String(m.amount),
        approvers:         [...m.approvers],
        approvalsRequired: String(m.approvalsRequired),
        approvalCount:     String(m.approvalCount),
        disputeDeadline:   String(m.disputeDeadline),
        status,
      };
    });

    return NextResponse.json(
      { milestones: dtos, total: Number(count) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// frontend/app/api/milestones/route.ts
/**
 * GET /api/milestones
 * Returns all milestones from ConditionalEscrow on-chain state.
 * Uses event logs since ConditionalEscrow doesn't expose getMilestone() view.
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

    // Fetch all relevant events in parallel
    const [createdLogs, releasedLogs, reclaimedLogs] = await Promise.all([
      client.getContractEvents({
        address: addr, abi: CONDITIONAL_ESCROW_ABI,
        eventName: "MilestoneCreated", fromBlock: "earliest", toBlock: "latest",
      }),
      client.getContractEvents({
        address: addr, abi: CONDITIONAL_ESCROW_ABI,
        eventName: "MilestoneReleased", fromBlock: "earliest", toBlock: "latest",
      }),
      client.getContractEvents({
        address: addr, abi: CONDITIONAL_ESCROW_ABI,
        eventName: "MilestoneReclaimed", fromBlock: "earliest", toBlock: "latest",
      }),
    ]);

    const releasedIds  = new Set(releasedLogs.map((l: any)  => String(l.args.id)));
    const reclaimedIds = new Set(reclaimedLogs.map((l: any) => String(l.args.id)));

    const dtos: MilestoneDTO[] = createdLogs.map((log: any) => {
      const id  = String(log.args.id);
      let status: MilestoneDTO["status"] = "active";
      if (releasedIds.has(id))       status = "released";
      else if (reclaimedIds.has(id)) status = "reclaimed";

      return {
        id,
        payer:             log.args.payer,
        payee:             log.args.payee,
        token:             log.args.token ?? "",
        amount:            String(log.args.amount),
        approvers:         [],  // not in event — payer fallback used in UI
        approvalsRequired: "1",
        approvalCount:     releasedIds.has(id) ? "1" : "0",
        disputeDeadline:   "0",
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

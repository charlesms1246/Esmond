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

function milestoneStatus(released: boolean, reclaimed: boolean, disputeDeadline: bigint): MilestoneDTO["status"] {
  if (released)  return "released";
  if (reclaimed) return "reclaimed";
  if (BigInt(Math.floor(Date.now() / 1000)) > disputeDeadline && disputeDeadline > 0n) return "expired";
  return "active";
}

export async function GET() {
  try {
    const client = createPublicClient({ chain: paseo, transport: http() });
    const addr   = getContractAddresses().ConditionalEscrow;

    const count = await client.readContract({
      address: addr, abi: CONDITIONAL_ESCROW_ABI, functionName: "milestoneCount",
    }) as bigint;

    // Fetch MilestoneCreated events — contract doesn't expose getMilestone() view
    const logs = await client.getContractEvents({
      address:   addr,
      abi:       CONDITIONAL_ESCROW_ABI,
      eventName: "MilestoneCreated",
      fromBlock: "earliest",
      toBlock:   "latest",
    });

    const dtos: MilestoneDTO[] = logs.map((log: any) => ({
      id:                String(log.args.id),
      payer:             log.args.payer,
      payee:             log.args.payee,
      token:             log.args.token ?? "",
      amount:            String(log.args.amount),
      approvers:         [],    // not in event — fetch from contract storage if needed
      approvalsRequired: "1",
      approvalCount:     "0",
      disputeDeadline:   "0",
      status:            "active", // approximate — full data needs getMilestone()
    }));

    return NextResponse.json({ milestones: dtos, total: Number(count) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

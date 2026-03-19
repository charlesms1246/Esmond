// frontend/app/api/subscriptions/route.ts
/**
 * GET /api/subscriptions
 * Returns subscription plans and active subscriptions from SubscriptionManager on-chain state.
 */

import { NextResponse }               from "next/server";
import { createPublicClient, http }   from "viem";
import { paseo }                      from "@/lib/wagmi/config";
import { SUBSCRIPTION_MANAGER_ABI }   from "@/lib/contracts/abis";
import { getContractAddresses }       from "@/lib/contracts/addresses";

export async function GET() {
  try {
    const client = createPublicClient({ chain: paseo, transport: http() });
    const addr   = getContractAddresses().SubscriptionManager;

    const [planCount, subCount] = await Promise.all([
      client.readContract({ address: addr, abi: SUBSCRIPTION_MANAGER_ABI, functionName: "planCount" }),
      client.readContract({ address: addr, abi: SUBSCRIPTION_MANAGER_ABI, functionName: "subscriptionCount" }),
    ]) as [bigint, bigint];

    // Fetch plan creation events.
    // .catch(() => []) guards against RPC block-range limits on Paseo testnet.
    const planLogs = await client.getContractEvents({
      address:   addr,
      abi:       SUBSCRIPTION_MANAGER_ABI,
      eventName: "PlanCreated",
      fromBlock: "earliest",
      toBlock:   "latest",
    }).catch(() => [] as any[]);

    // Fetch subscription events
    const subLogs = await client.getContractEvents({
      address:   addr,
      abi:       SUBSCRIPTION_MANAGER_ABI,
      eventName: "Subscribed",
      fromBlock: "earliest",
      toBlock:   "latest",
    }).catch(() => [] as any[]);

    return NextResponse.json(
      {
        plans: planLogs.map((l: any) => ({
          id:           String(l.args.planId),
          provider:     l.args.provider,
          token:        l.args.token,
          chargeAmount: String(l.args.chargeAmount),
          interval:     String(l.args.interval),
        })),
        subscriptions: subLogs.map((l: any) => ({
          id:          String(l.args.subscriptionId),
          subscriber:  l.args.subscriber,
          planId:      String(l.args.planId),
          approvedCap: String(l.args.approvedCap),
        })),
        totalPlans: Number(planCount),
        totalSubs:  Number(subCount),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

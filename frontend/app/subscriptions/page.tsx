"use client";

import { useEffect, useState }  from "react";
import { useAccount }           from "wagmi";
import { SubscriptionCard }     from "@/components/SubscriptionCard";
import { TxStatusBadge }        from "@/components/TxStatusBadge";
import { useCreatePlan, useSubscribe } from "@/hooks/useSubscriptionManager";
import { MOCK_ERC20_ADDRESS }   from "@/lib/contracts/addresses";
import { parseUnits }           from "viem";

export default function SubscriptionsPage() {
  const { address, isConnected } = useAccount();
  const [data,    setData]    = useState<any>({ plans: [], subscriptions: [] });
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<"plans" | "subscriptions">("subscriptions");

  const { createPlan, txStatus: planStatus } = useCreatePlan();
  const { subscribe,  txStatus: subStatus }  = useSubscribe();

  // Plan creation form state
  const [planCharge,   setPlanCharge]   = useState("");
  const [planInterval, setPlanInterval] = useState("30");

  // Subscribe inline form state
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [capInput,          setCapInput]           = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/subscriptions")
      .then(r => r.json())
      .then(d => setData({ plans: d.plans ?? [], subscriptions: d.subscriptions ?? [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planStatus.status, subStatus.status]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planCharge) return;
    await createPlan({
      token:        MOCK_ERC20_ADDRESS,
      chargeAmount: parseUnits(planCharge, 6),
      interval:     BigInt(Number(planInterval) * 24 * 3600),
      maxCharges:   0n,
      expiry:       0n,
    }).catch(() => {});
  }

  async function handleSubscribe(planId: string) {
    if (!capInput) return;
    await subscribe({
      planId:      BigInt(planId),
      approvedCap: parseUnits(capInput, 6),
      token:       MOCK_ERC20_ADDRESS,
    }).catch(() => {});
    setSubscribingPlanId(null);
    setCapInput("");
  }

  const inputClass = "w-full rounded-lg border px-3 py-2.5 text-sm";
  const inputStyle = { background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Subscription Manager</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Recurring retainers with subscriber-controlled caps
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
           style={{ background: "var(--bg-card)" }}>
        {(["subscriptions", "plans"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
                  style={tab === t
                    ? { background: "var(--dot-pink-dim)", color: "var(--dot-pink)" }
                    : { color: "var(--text-secondary)" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Create Plan form — wallet required */}
      {tab === "plans" && isConnected && (
        <form onSubmit={handleCreatePlan}
              className="rounded-2xl border p-6 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <h2 className="font-semibold">Create Billing Plan</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Charge Amount (tUSDC)</label>
              <input type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} style={inputStyle}
                     placeholder="10" value={planCharge} onChange={e => setPlanCharge(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Interval (days)</label>
              <input type="number" min="1" className={`${inputClass} mt-1.5`} style={inputStyle}
                     value={planInterval} onChange={e => setPlanInterval(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <TxStatusBadge status={planStatus} />
            <button type="submit" disabled={planStatus.status === "pending"}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--dot-pink)" }}>
              Create Plan
            </button>
          </div>
        </form>
      )}

      {tab === "plans" && !isConnected && (
        <div className="rounded-2xl border p-4 text-center text-sm text-[var(--text-muted)]"
             style={{ borderColor: "var(--border-subtle)" }}>
          Connect your wallet to create plans or subscribe.
        </div>
      )}

      {/* Content — visible to all */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : tab === "subscriptions" ? (
        data.subscriptions.length === 0 ? (
          <div className="py-16 text-center rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <p className="text-[var(--text-secondary)]">No active subscriptions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.subscriptions.map((s: any) => {
              const plan = data.plans.find((p: any) => p.id === s.planId) ?? {};
              return (
                <SubscriptionCard key={s.id}
                  subscriptionId={s.id}                       planId={s.planId}
                  chargeAmount={plan.chargeAmount ?? "0"}     interval={plan.interval ?? "0"}
                  nextChargeDue={s.nextChargeDue ?? "0"}      totalCharged={s.totalCharged ?? "0"}
                  approvedCap={s.approvedCap ?? "0"}          active={s.active !== false}
                  isProvider={!!address && plan.provider?.toLowerCase() === address.toLowerCase()}
                  isSubscriber={!!address && s.subscriber?.toLowerCase() === address.toLowerCase()}
                />
              );
            })}
          </div>
        )
      ) : (
        /* Plans tab */
        data.plans.length === 0 ? (
          <div className="py-16 text-center rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <p className="text-[var(--text-secondary)]">No plans yet. Create one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.plans.map((p: any) => (
              <div key={p.id} className="rounded-2xl border p-5 flex flex-col gap-3"
                   style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Plan #{p.id}</p>
                  <p className="text-xl font-bold">
                    {p.chargeAmount ? (Number(p.chargeAmount) / 1e6).toFixed(2) : "—"}{" "}
                    <span className="text-sm font-medium" style={{ color: "var(--dot-pink)" }}>tUSDC</span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    every {p.interval ? Math.round(Number(p.interval) / 3600 / 24) : "?"} days
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                    {p.provider?.slice(0, 8)}…
                  </p>
                </div>

                {/* Subscribe inline form */}
                {isConnected && subscribingPlanId === p.id ? (
                  <div className="flex flex-col gap-2 pt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    <label className="text-xs text-[var(--text-secondary)]">Approved Cap (tUSDC)</label>
                    <input type="number" min="0" step="0.01" placeholder="e.g. 100"
                           value={capInput} onChange={e => setCapInput(e.target.value)}
                           className="w-full rounded-lg border px-3 py-2 text-sm"
                           style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                    <TxStatusBadge status={subStatus} />
                    <div className="flex gap-2">
                      <button onClick={() => { setSubscribingPlanId(null); setCapInput(""); }}
                              className="flex-1 py-1.5 rounded-lg text-xs border"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        Cancel
                      </button>
                      <button onClick={() => handleSubscribe(p.id)}
                              disabled={subStatus.status === "pending" || !capInput}
                              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                              style={{ background: "var(--dot-pink)" }}>
                        {subStatus.status === "pending" ? "Subscribing…" : "Confirm"}
                      </button>
                    </div>
                  </div>
                ) : isConnected ? (
                  <button onClick={() => { setSubscribingPlanId(p.id); setCapInput(""); }}
                          className="w-full py-2 rounded-lg text-sm font-medium text-white mt-auto"
                          style={{ background: "var(--dot-pink)" }}>
                    Subscribe
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

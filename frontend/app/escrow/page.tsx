"use client";

import { useEffect, useState }   from "react";
import { useAccount }            from "wagmi";
import { MilestoneCard }         from "@/components/MilestoneCard";
import { TxStatusBadge }         from "@/components/TxStatusBadge";
import { useCreateMilestone }    from "@/hooks/useConditionalEscrow";
import { MOCK_ERC20_ADDRESS }    from "@/lib/contracts/addresses";
import { parseUnits, isAddress } from "viem";
import type { MilestoneDTO }     from "@/lib/types";

export default function EscrowPage() {
  const { address, isConnected } = useAccount();
  const [milestones, setMilestones] = useState<MilestoneDTO[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const [payee,    setPayee]    = useState("");
  const [amount,   setAmount]   = useState("");
  const [deadline, setDeadline] = useState("");

  const { createMilestone, txStatus } = useCreateMilestone();

  useEffect(() => {
    setLoading(true);
    fetch("/api/milestones")
      .then(r => r.json())
      .then(d => setMilestones(d.milestones ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [txStatus.status]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(payee) || !amount || !deadline) return;
    const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    await createMilestone({
      payee:             payee as `0x${string}`,
      token:             MOCK_ERC20_ADDRESS,
      amount:            parseUnits(amount, 6),
      approvers:         [address as `0x${string}`],
      approvalsRequired: 1n,
      disputeDeadline:   deadlineTs,
    }).catch(() => {});
  }

  const inputClass = "w-full rounded-lg border px-3 py-2.5 text-sm";
  const inputStyle = { background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-gradient text-3xl font-bold">Milestone Escrow</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Trustless deliverable-based conditional payments
          </p>
        </div>
        {isConnected && (
          <button onClick={() => setShowForm(v => !v)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "var(--dot-pink)" }}>
            + New Milestone
          </button>
        )}
      </div>

      {/* Create form — wallet required */}
      {isConnected && showForm && (
        <form onSubmit={handleCreate}
              className="rounded-2xl border p-6 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--dot-pink)" }}>
          <h2 className="font-semibold">Create Milestone</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Payee Address</label>
              <input className={`${inputClass} mt-1.5 font-mono`} style={inputStyle}
                     placeholder="0x…" value={payee} onChange={e => setPayee(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Amount (tUSDC)</label>
              <input type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} style={inputStyle}
                     placeholder="500" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Dispute Deadline</label>
              <input type="date" className={`${inputClass} mt-1.5`} style={inputStyle}
                     value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <TxStatusBadge status={txStatus} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                      className="px-4 py-2 rounded-lg text-sm border"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button type="submit" disabled={txStatus.status === "pending"}
                      className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--dot-pink)" }}>
                Create & Lock Funds
              </button>
            </div>
          </div>
        </form>
      )}

      {!isConnected && (
        <div className="rounded-2xl border p-4 text-center text-sm text-[var(--text-muted)]"
             style={{ borderColor: "var(--border-subtle)" }}>
          Connect your wallet to create milestones.
        </div>
      )}

      {/* Milestone list — visible to all */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div className="py-16 text-center rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <p className="text-[var(--text-secondary)]">No milestones yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {milestones.map(m => (
            <MilestoneCard key={m.id} {...m}
              id={BigInt(m.id)}
              isApprover={
                !!address && (
                  m.approvers.map(a => a.toLowerCase()).includes(address.toLowerCase()) ||
                  // Fallback: payer is approver when approvers list is empty (event-based API limitation)
                  (m.approvers.length === 0 && m.payer.toLowerCase() === address.toLowerCase())
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

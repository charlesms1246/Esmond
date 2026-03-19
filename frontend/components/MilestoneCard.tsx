"use client";

import { useApproveMilestone, useReclaimExpired } from "@/hooks/useConditionalEscrow";
import { formatUnits }   from "viem";
import { TxStatusBadge } from "./TxStatusBadge";
import { useState }      from "react";
import type { TxStatus } from "@/lib/types";

interface Props {
  id:                bigint;
  payer:             string;
  payee:             string;
  amount:            string;
  status:            "active" | "released" | "reclaimed" | "expired";
  disputeDeadline:   string;
  approvalCount:     string;
  approvalsRequired: string;
  isApprover:        boolean;
}

export function MilestoneCard({
  id, payer, payee, amount, status,
  disputeDeadline, approvalCount, approvalsRequired, isApprover,
}: Props) {
  const approveFn  = useApproveMilestone();
  const reclaimFn  = useReclaimExpired();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const amountFormatted = formatUnits(BigInt(amount), 6);
  const deadline        = new Date(Number(disputeDeadline) * 1000);
  const isPastDeadline  = deadline < new Date();

  const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    active:    { bg: "rgba(59,130,246,0.1)",  text: "var(--info)",    label: "Active"    },
    released:  { bg: "rgba(34,197,94,0.1)",   text: "var(--success)", label: "Released"  },
    reclaimed: { bg: "rgba(239,68,68,0.1)",   text: "var(--error)",   label: "Reclaimed" },
    expired:   { bg: "rgba(245,158,11,0.1)",  text: "var(--warning)", label: "Expired"   },
  };
  const style = STATUS_STYLES[status];

  async function handleApprove() {
    setTxStatus({ status: "pending" });
    try {
      const hash = await approveFn(id);
      setTxStatus({ status: "success", hash });
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
    }
  }

  async function handleReclaim() {
    setTxStatus({ status: "pending" });
    try {
      const hash = await reclaimFn(id);
      setTxStatus({ status: "success", hash });
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
    }
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4"
         style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Milestone #{String(id)}</p>
          <p className="text-2xl font-bold">
            {amountFormatted}{" "}
            <span className="text-sm font-medium" style={{ color: "var(--dot-pink)" }}>tUSDC</span>
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: style.bg, color: style.text }}>
          {style.label}
        </span>
      </div>

      {/* Parties */}
      <div className="space-y-1 text-xs">
        <p><span className="text-[var(--text-muted)]">Payer: </span>
           <span className="font-mono">{payer.slice(0, 8)}…{payer.slice(-4)}</span></p>
        <p><span className="text-[var(--text-muted)]">Payee: </span>
           <span className="font-mono">{payee.slice(0, 8)}…{payee.slice(-4)}</span></p>
        <p><span className="text-[var(--text-muted)]">Approvals: </span>
           <span>{approvalCount}/{approvalsRequired}</span></p>
        <p><span className="text-[var(--text-muted)]">Deadline: </span>
           <span style={{ color: isPastDeadline ? "var(--warning)" : "var(--text-secondary)" }}>
             {deadline.toLocaleDateString()}
           </span></p>
      </div>

      {/* Actions */}
      {status === "active" && (
        <div className="flex flex-col gap-2 pt-1">
          <TxStatusBadge status={txStatus} />
          <div className="flex gap-2">
            {isApprover && (
              <button onClick={handleApprove} disabled={txStatus.status === "pending"}
                      className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--dot-pink)" }}>
                Approve
              </button>
            )}
            {isPastDeadline && (
              <button onClick={handleReclaim} disabled={txStatus.status === "pending"}
                      className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                Reclaim
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

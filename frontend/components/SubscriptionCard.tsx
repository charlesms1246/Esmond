"use client";

import { useCharge, useRevoke }  from "@/hooks/useSubscriptionManager";
import { formatUnits }           from "viem";
import { TxStatusBadge }         from "./TxStatusBadge";
import { useState }              from "react";
import type { TxStatus }         from "@/lib/types";

interface Props {
  subscriptionId: string;
  planId:         string;
  chargeAmount:   string;
  interval:       string;
  nextChargeDue:  string;
  totalCharged:   string;
  approvedCap:    string;
  active:         boolean;
  isProvider:     boolean;
  isSubscriber:   boolean;
}

export function SubscriptionCard({
  subscriptionId, planId, chargeAmount, interval,
  nextChargeDue, totalCharged, approvedCap,
  active, isProvider, isSubscriber,
}: Props) {
  const chargeFn = useCharge();
  const revokeFn = useRevoke();
  const [txStatus, setTxStatus] = useState<TxStatus>({ status: "idle" });

  const chargeFormatted  = formatUnits(BigInt(chargeAmount), 6);
  const capFormatted     = formatUnits(BigInt(approvedCap), 6);
  const chargedFormatted = formatUnits(BigInt(totalCharged), 6);
  const nextDue          = new Date(Number(nextChargeDue) * 1000);
  const isChargeDue      = nextDue <= new Date();
  const capNum           = Number(approvedCap);
  const progress         = capNum > 0 ? (Number(totalCharged) / capNum) * 100 : 0;

  async function handleCharge() {
    setTxStatus({ status: "pending" });
    try {
      const hash = await chargeFn(BigInt(subscriptionId));
      setTxStatus({ status: "success", hash });
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
    }
  }

  async function handleRevoke() {
    setTxStatus({ status: "pending" });
    try {
      const hash = await revokeFn(BigInt(subscriptionId));
      setTxStatus({ status: "success", hash });
    } catch (err: any) {
      setTxStatus({ status: "error", error: err.shortMessage ?? err.message });
    }
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4"
         style={{ background: "var(--bg-card)", borderColor: "var(--border)", opacity: active ? 1 : 0.5 }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            Subscription #{subscriptionId} · Plan #{planId}
          </p>
          <p className="text-xl font-bold mt-1">
            {chargeFormatted}{" "}
            <span className="text-sm font-medium" style={{ color: "var(--dot-pink)" }}>tUSDC</span>
            <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">
              / {Math.round(Number(interval) / 3600 / 24)}d
            </span>
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={active
                ? { background: "rgba(34,197,94,0.1)", color: "var(--success)" }
                : { background: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
          {active ? "Active" : "Revoked"}
        </span>
      </div>

      {/* Cap progress bar */}
      <div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1.5">
          <span>Charged: {chargedFormatted} tUSDC</span>
          <span>Cap: {capFormatted} tUSDC</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{
                 width:      `${Math.min(progress, 100)}%`,
                 background: progress > 80 ? "var(--warning)" : "var(--dot-pink)",
               }} />
        </div>
      </div>

      {/* Next charge */}
      <p className="text-xs" style={{ color: isChargeDue ? "var(--warning)" : "var(--text-muted)" }}>
        {isChargeDue ? "⚡ Charge due now" : `Next charge: ${nextDue.toLocaleDateString()}`}
      </p>

      {/* Actions */}
      {active && (
        <div className="flex flex-col gap-2">
          <TxStatusBadge status={txStatus} />
          <div className="flex gap-2">
            {isProvider && isChargeDue && (
              <button onClick={handleCharge} disabled={txStatus.status === "pending"}
                      className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--dot-pink)" }}>
                Charge
              </button>
            )}
            {isSubscriber && (
              <button onClick={handleRevoke} disabled={txStatus.status === "pending"}
                      className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      style={{ background: "var(--bg-card-hover)", color: "var(--error)", border: "1px solid var(--border)" }}>
                Revoke
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

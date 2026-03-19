"use client";

import type { TxStatus } from "@/lib/types";

interface Props {
  status:        TxStatus;
  explorerBase?: string;
}

const EXPLORER = "https://blockscout-passet-hub.parity-testnet.parity.io";

export function TxStatusBadge({ status, explorerBase = EXPLORER }: Props) {
  if (status.status === "idle") return null;

  if (status.status === "pending") return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <span className="animate-spin inline-block w-4 h-4 border-2 rounded-full"
            style={{ borderColor: "var(--dot-pink)", borderTopColor: "transparent" }} />
      {status.hash
        ? <a href={`${explorerBase}/tx/${status.hash}`} target="_blank" rel="noopener noreferrer"
             className="underline">Confirming…</a>
        : "Waiting for wallet…"}
    </div>
  );

  if (status.status === "success") return (
    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--success)" }}>
      <span>✓</span>
      <a href={`${explorerBase}/tx/${status.hash}`} target="_blank" rel="noopener noreferrer"
         className="underline font-mono">
        {status.hash.slice(0, 10)}…
      </a>
    </div>
  );

  if (status.status === "error") return (
    <div className="text-sm" style={{ color: "var(--error)" }}>
      ✗ {status.error}
    </div>
  );

  return null;
}

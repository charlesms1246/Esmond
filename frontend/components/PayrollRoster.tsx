"use client";

import { useEmployeeCount, useEmployee } from "@/hooks/usePayrollVault";
import { PARACHAIN_NAMES }              from "@/lib/contracts/addresses";
import { formatUnits }                  from "viem";
import type { Employee }                from "@/lib/types";

function EmployeeRow({ id }: { id: bigint }) {
  const { data: emp, isLoading } = useEmployee(id);

  if (isLoading) return (
    <tr>
      <td colSpan={6} className="px-4 py-3">
        <div className="animate-pulse h-4 rounded" style={{ background: "var(--bg-card)" }} />
      </td>
    </tr>
  );
  if (!emp) return null;

  const e          = emp as unknown as Employee;
  const nextDue    = new Date(Number(e.nextPaymentDue) * 1000);
  const isDue      = nextDue <= new Date();
  const chainName  = PARACHAIN_NAMES[e.parachainId as keyof typeof PARACHAIN_NAMES]
                     ?? `Chain ${e.parachainId}`;

  return (
    <tr className="border-b hover:bg-[var(--bg-card-hover)] transition-colors"
        style={{ borderColor: "var(--border-subtle)", opacity: e.active ? 1 : 0.4 }}>
      <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">#{String(id)}</td>
      <td className="px-4 py-3 font-mono text-sm">
        {e.wallet.slice(0, 8)}…{e.wallet.slice(-4)}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className="font-semibold">{formatUnits(e.salaryAmount, 6)}</span>
        <span className="text-xs ml-1 text-[var(--text-muted)]">tUSDC</span>
      </td>
      <td className="px-4 py-3 text-xs"
          style={{ color: e.parachainId === 0 ? "var(--text-secondary)" : "var(--info)" }}>
        {chainName}
      </td>
      <td className="px-4 py-3 text-xs">
        <span style={{ color: isDue ? "var(--warning)" : "var(--text-secondary)" }}>
          {isDue ? "⚡ Due now" : nextDue.toLocaleDateString()}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: e.active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color:      e.active ? "var(--success)"      : "var(--error)",
              }}>
          {e.active ? "Active" : "Inactive"}
        </span>
      </td>
    </tr>
  );
}

export function PayrollRoster() {
  const { data: count, isLoading } = useEmployeeCount();
  const total = Number(count ?? 0n);

  if (isLoading) return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-12 rounded-lg" style={{ background: "var(--bg-card)" }} />
      ))}
    </div>
  );

  if (total === 0) return (
    <div className="py-16 text-center rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <p className="text-[var(--text-secondary)]">No employees registered yet.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            {["ID", "Wallet", "Salary", "Chain", "Next Due", "Status"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: total }, (_, i) => (
            <EmployeeRow key={i} id={BigInt(i)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

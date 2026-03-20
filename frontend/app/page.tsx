"use client";

import { useEmployeeCount }  from "@/hooks/usePayrollVault";
import { useMilestoneCount } from "@/hooks/useConditionalEscrow";
import { usePlanCount }      from "@/hooks/useSubscriptionManager";
import { VaultBalance }      from "@/components/VaultBalance";
import { StatCard }          from "@/components/StatCard";
import { useAccount }        from "wagmi";
import Link                  from "next/link";

export default function DashboardPage() {
  const { isConnected }          = useAccount();
  const { data: empCount }       = useEmployeeCount();
  const { data: milestoneCount } = useMilestoneCount();
  const { data: planCount }      = usePlanCount();

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="text-center py-10">
        <h1 className="heading-gradient text-5xl font-bold mb-4 tracking-tight">
          Programmable Payments
          <br />on Polkadot Hub
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
          On-chain payroll, milestone escrow, and subscription billing — powered by native Asset Hub assets and XCM cross-chain routing.
        </p>
        {!isConnected && (
          <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
            Connect your wallet to get started →
          </p>
        )}
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <VaultBalance />
        </div>
        <StatCard label="Employees"  value={String(empCount ?? 0n)}       sub="registered"    />
        <StatCard label="Milestones" value={String(milestoneCount ?? 0n)} sub="on-chain"      />
        <StatCard label="Plans"      value={String(planCount ?? 0n)}      sub="subscription" accent />
      </section>

      {/* Feature cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: "/payroll", title: "Payroll Vault",
            desc: "Automate recurring salary payroll with XCM cross-chain routing. Pay contributors on Moonbeam, Astar, and Hydration in a single call.",
            cta: "Manage Payroll",
          },
          {
            href: "/escrow", title: "Milestone Escrow",
            desc: "Lock funds on contract creation, release on multi-party approval. No intermediary, no platform fees.",
            cta: "View Milestones",
          },
          {
            href: "/subscriptions", title: "Subscriptions",
            desc: "Create billing plans with subscriber-controlled caps. Automate recurring retainer payments with on-chain enforcement.",
            cta: "Manage Subscriptions",
          },
        ].map(({ href, title, desc, cta }) => (
          <Link key={href} href={href}
                className="rounded-2xl border p-6 flex flex-col gap-3 group hover:border-[var(--dot-pink)] transition-colors cursor-pointer"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-lg group-hover:text-[var(--dot-pink)] transition-colors">
              {title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] flex-1">{desc}</p>
            <span className="text-sm font-medium mt-2" style={{ color: "var(--dot-pink)" }}>
              {cta} →
            </span>
          </Link>
        ))}
      </section>

      {/* Network badge */}
      <section className="flex justify-center">
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl border text-xs"
             style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-muted)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
          Paseo Testnet · Chain ID 420420417 ·{" "}
          <a href="https://blockscout-testnet.polkadot.io"
             target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--text-primary)]">
            Blockscout Explorer
          </a>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link            from "next/link";
import Image           from "next/image";
import { usePathname } from "next/navigation";
import { WalletConnector } from "./WalletConnector";

const NAV_LINKS = [
  { href: "/",              label: "Dashboard"     },
  { href: "/payroll",       label: "Payroll"       },
  { href: "/escrow",        label: "Milestones"    },
  { href: "/subscriptions", label: "Subscriptions" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 border-b border-[var(--border)]"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo — SVG wordmark */}
        <Link href="/" className="flex items-center group">
          <Image
            src="/esmond.svg"
            alt="Esmond"
            width={120}
            height={33}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Navigation links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? ""
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                }`}
                style={active ? { background: "var(--dot-pink-dim)", color: "var(--dot-pink)" } : {}}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Wallet */}
        <WalletConnector />
      </div>
    </nav>
  );
}

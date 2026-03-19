"use client";

import { useVaultTokenBalance }     from "@/hooks/usePayrollVault";
import { MOCK_ERC20_ADDRESS, TOKEN_CONFIG } from "@/lib/contracts/addresses";
import { formatUnits }              from "viem";

interface Props { className?: string; }

export function VaultBalance({ className = "" }: Props) {
  const { data: balance, isLoading } = useVaultTokenBalance(MOCK_ERC20_ADDRESS);
  const decimals = TOKEN_CONFIG.mUSDC.decimals;

  const formatted = isLoading
    ? "—"
    : balance !== undefined
      ? Number(formatUnits(balance as bigint, decimals)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}>
        Vault Balance
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          {isLoading
            ? <span className="animate-pulse bg-[var(--bg-card)] rounded w-32 h-8 inline-block" />
            : formatted}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--dot-pink)" }}>tUSDC</span>
      </div>
    </div>
  );
}

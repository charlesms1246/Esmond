"use client";

import { PARACHAIN_NAMES, type ParachainId } from "@/lib/contracts/addresses";

interface Props {
  value:     number;
  onChange:  (id: number) => void;
  disabled?: boolean;
}

const CHAIN_COLORS: Record<number, string> = {
  0:    "var(--text-secondary)",
  2004: "var(--moonbeam, #53CBC8)",
  2006: "var(--astar, #0085FF)",
  2034: "var(--hydration, #B3E0FF)",
};

export function ChainSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Destination Chain
      </label>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full rounded-lg border px-3 py-2.5 text-sm appearance-none disabled:opacity-50"
        style={{
          background:  "var(--bg-input)",
          borderColor: "var(--border)",
          color:       CHAIN_COLORS[value] ?? "var(--text-primary)",
        }}
      >
        {Object.entries(PARACHAIN_NAMES).map(([id, name]) => (
          <option key={id} value={id} style={{ color: CHAIN_COLORS[Number(id)] }}>
            {id === "0" ? "🔵" : "🔗"} {name}
          </option>
        ))}
      </select>
      {value !== 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Payment dispatched via XCM to chain {value}
        </p>
      )}
    </div>
  );
}

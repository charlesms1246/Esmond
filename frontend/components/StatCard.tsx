interface Props {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-2"
      style={{
        background:  accent ? "var(--dot-pink-dim)" : "var(--bg-card)",
        borderColor: accent ? "var(--dot-pink)"     : "var(--border)",
      }}
    >
      <span className="text-xs font-medium uppercase tracking-widest"
            style={{ color: accent ? "var(--dot-pink)" : "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-3xl font-bold"
            style={{ color: accent ? "var(--dot-pink)" : "var(--text-primary)" }}>
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}

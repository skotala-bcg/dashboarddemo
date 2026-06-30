import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  { key: "exec", label: "Exec Dashboard" },
  { key: "jira-health", label: "Jira Health Dashboard" },
];

// Title-level dropdown that switches between the dashboards. Closes on
// click-outside via a document mousedown listener.
export default function DashboardSwitcher({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = OPTIONS.find((o) => o.key === current) || OPTIONS[0];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#94A3B8", marginBottom: 3 }}>Switch dashboard</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 12, fontSize: 17, fontWeight: 700, color: "#0F172A",
          border: "2px solid " + (open ? "#2E6BFF" : "#E2E8F0"), borderRadius: 8, padding: "8px 14px",
          background: open ? "#FAFBFC" : "#fff", cursor: "pointer", transition: "border-color .15s,background .15s",
        }}
      >
        <span>{active.label}</span>
        <span style={{ color: "#64748B", fontSize: 20, lineHeight: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, left: 0, marginTop: 6, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", minWidth: 300, overflow: "hidden" }}>
          {OPTIONS.map((o) => {
            const isActive = o.key === current;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => { onChange(o.key); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", padding: "11px 14px", fontSize: 14, cursor: "pointer", border: "none",
                  background: isActive ? "#FAFBFC" : "#fff", color: isActive ? "#2E6BFF" : "#0F172A", fontWeight: isActive ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}
              >
                <span>{o.label}</span>
                {isActive && <span style={{ color: "#2E6BFF" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { NavLink } from "react-router-dom";

type Item = { to: string; label: string; subtitle?: string; emoji?: string };

const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", subtitle: "Overview & counters", emoji: "📊" },
  { to: "/journal", label: "Journal", subtitle: "Daily entries", emoji: "📝" },
  { to: "/prop-firms", label: "Prop Firms", subtitle: "Firms & accounts", emoji: "🏦" },
  { to: "/compliance", label: "Compliance", subtitle: "Grades & logs", emoji: "✅" },
  { to: "/reporting", label: "Reporting", subtitle: "Balances & drawdown", emoji: "📈" },
  { to: "/reporting-totals", label: "Reporting Totals", subtitle: "Firm + global totals", emoji: "🧮" },
  { to: "/backup", label: "Backup", subtitle: "Export / import", emoji: "💾" },
];

function navItemStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderRadius: 12,
    textDecoration: "none",
    border: "1px solid #e6e6e6",
    background: isActive ? "#f3f4f6" : "white",
    boxShadow: isActive ? "0 1px 0 rgba(0,0,0,0.04)" : "none",
    color: "inherit",
  };
}

export default function SideNav() {
  return (
    <aside style={{ width: 240, minWidth: 240, borderRight: "1px solid #eee", paddingRight: 14 }}>
      <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.7, letterSpacing: 0.4 }}>SECTIONS</div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} style={({ isActive }) => navItemStyle(isActive)}>
            <div
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                borderRadius: 10,
                background: "rgba(0,0,0,0.04)",
                fontSize: 14,
              }}
              aria-hidden="true"
            >
              {it.emoji ?? "•"}
            </div>

            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 750, lineHeight: 1.1 }}>{it.label}</div>
              {it.subtitle ? <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.1 }}>{it.subtitle}</div> : null}
            </div>
          </NavLink>
        ))}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #eee", fontSize: 12, opacity: 0.75 }}>
        Tip: Breadcrumbs jump you “Home” instantly.
      </div>
    </aside>
  );
}

import React from "react";
import { Link, useLocation } from "react-router-dom";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  journal: "Journal",
  "prop-firms": "Prop Firms",
  compliance: "Compliance",
  reporting: "Reporting",
  "reporting-totals": "Reporting Totals",
  backup: "Backup",
};

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/+/, "").split("/")[0] || "dashboard";
  const currentLabel = labelMap[seg] ?? seg;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14 }}>
      <Link to="/dashboard" style={{ textDecoration: "none" }}>
        Home
      </Link>
      <span style={{ opacity: 0.6 }}>/</span>
      <span style={{ fontWeight: 700 }}>{currentLabel}</span>
    </div>
  );
}

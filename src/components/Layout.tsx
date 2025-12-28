import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import SideNav from "./SideNav";
import Breadcrumbs from "./Breadcrumbs";
import { useActiveRecord } from "../ui/ActiveRecordContext";

export default function Layout() {
  const { active, clearActive } = useActiveRecord();
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
        width: "100vw",
        overflowX: "hidden",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      {/* LEFT NAV */}
      <div
        style={{
          borderRight: "1px solid #eee",
          background: "#fff",
          padding: "16px 14px",
        }}
      >
        <SideNav />
      </div>

      {/* MAIN CONTENT */}
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "16px 18px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* HEADER */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            Trading Journal & Prop-Firm Compliance
          </h1>
          <Breadcrumbs />
        </div>

        {/* ACTIVE RECORD BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid #e6e6e6",
            background: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.6,
                letterSpacing: 0.5,
              }}
            >
              ACTIVE
            </span>

            <span style={{ fontWeight: 800 }}>
              {active.kind !== "None" ? active.kind : "—"}
            </span>

            {active.kind !== "None" && (
              <>
                <span style={{ opacity: 0.5 }}>•</span>
                <span style={{ fontWeight: 600 }}>{active.label}</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => active.route && navigate(active.route)}
              disabled={!active.route}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: active.route ? "#fff" : "#f3f3f3",
                cursor: active.route ? "pointer" : "not-allowed",
                fontSize: 13,
              }}
            >
              Go to
            </button>

            <button
              onClick={clearActive}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0, // critical for tables & charts
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}

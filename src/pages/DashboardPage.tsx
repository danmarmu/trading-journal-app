import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDB } from "../db/DBContext";
import { Panel, Button } from "../components/ui";

const uuid = () => crypto.randomUUID();

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DashboardPage() {
  const { db, commit } = useDB();
  const nav = useNavigate();

  const latestJournal = useMemo(() => {
    return [...db.journals].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [db.journals]);

  const gradeCounts = useMemo(() => {
    const counts: Record<"A" | "B" | "C" | "D" | "F", number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const c of db.compliance) counts[c.complianceGrade] += 1;
    return counts;
  }, [db.compliance]);

  const violationsCount = useMemo(() => {
    return db.compliance.filter((c) => (c.violations ?? "").trim().length > 0).length;
  }, [db.compliance]);

  const accountsByType = useMemo(() => {
    const counts: Record<string, number> = { Evaluation: 0, "Sim Funded": 0, Live: 0, Personal: 0 };
    for (const a of db.accounts) if (counts[a.accountType] !== undefined) counts[a.accountType] += 1;
    return counts;
  }, [db.accounts]);

  function createTodayJournal() {
    const j = {
      id: uuid(),
      date: todayYYYYMMDD(),
      focus: "",
      hardStopTime: "11:00 AM",
      keyLevels: "",
      newsEvents: "",
      tradingRules: { dailyMaxLoss: "", allowedSetups: "", maxTrades: "", maxRiskPerTrade: "" },
    };
    commit((prev) => ({ ...prev, journals: [j, ...prev.journals] }));
    nav("/journal");
  }

  return (
    <>
      <Panel
        title="Quick Actions"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={createTodayJournal}>+ Journal for Today</Button>
            <Button onClick={() => nav("/prop-firms")}>Manage Firms/Accounts</Button>
            <Button onClick={() => nav("/compliance")}>Open Compliance</Button>
            <Button onClick={() => nav("/reporting")}>Reporting</Button>
          </div>
        }
      >
        <div style={{ opacity: 0.85 }}>
          Latest journal: <strong>{latestJournal?.date ?? "—"}</strong>
        </div>
      </Panel>

      <Panel title="Overview">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>Journals: <strong>{db.journals.length}</strong></div>
          <div>Firms: <strong>{db.firms.length}</strong></div>
          <div>
            Accounts: <strong>{db.accounts.length}</strong>{" "}
            <span style={{ opacity: 0.75 }}>
              (Eval {accountsByType["Evaluation"]} • Sim {accountsByType["Sim Funded"]} • Live {accountsByType["Live"]})
            </span>
          </div>
          <div>
            Compliance logs: <strong>{db.compliance.length}</strong>{" "}
            <span style={{ opacity: 0.75 }}>({violationsCount} w/ violations noted)</span>
          </div>
        </div>
      </Panel>

      <Panel title="Compliance Grade Counters">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
          {(["A", "B", "C", "D", "F"] as const).map((g) => (
            <div key={g} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Grade {g}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{gradeCounts[g]}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

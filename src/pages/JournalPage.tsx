import React, { useMemo, useState, useEffect } from "react";
import { useDB } from "../db/DBContext";
import { Panel, Row, Label, Input, TextArea, Button, DangerButton } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";
import type { DailyJournal } from "../types";

const uuid = () => crypto.randomUUID();

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function includesCI(h: string, n: string) {
  return h.toLowerCase().includes(n.toLowerCase());
}
function newJournal(date: string): DailyJournal {
  return {
    id: uuid(),
    date,
    focus: "",
    hardStopTime: "11:00 AM",
    keyLevels: "",
    newsEvents: "",
    tradingRules: { dailyMaxLoss: "", allowedSetups: "", maxTrades: "", maxRiskPerTrade: "" },
  };
}

export default function JournalPage() {
  const { db, commit } = useDB();
  const { active, setActive, clearActive } = useActiveRecord();

  const [selectedId, setSelectedId] = useState<string | null>(db.journals[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (selectedId && !db.journals.some((j) => j.id === selectedId)) {
      setSelectedId(db.journals[0]?.id ?? null);
    }
  }, [db.journals, selectedId]);

  const filteredSorted = useMemo(() => {
    const q = search.trim();
    return [...db.journals]
      .filter((j) => {
        if (from && j.date < from) return false;
        if (to && j.date > to) return false;
        if (!q) return true;

        const blob = [
          j.date,
          j.focus,
          j.hardStopTime,
          j.keyLevels,
          j.newsEvents,
          j.tradingRules.dailyMaxLoss,
          j.tradingRules.allowedSetups,
          j.tradingRules.maxTrades,
          j.tradingRules.maxRiskPerTrade,
        ].join(" | ");

        return includesCI(blob, q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.journals, search, from, to]);

  const selected = db.journals.find((j) => j.id === selectedId) ?? null;

  function addToday() {
    const j = newJournal(todayYYYYMMDD());
    commit((prev) => ({ ...prev, journals: [j, ...prev.journals] }));
    setSelectedId(j.id);
    setActive({ kind: "Journal", id: j.id, label: j.date, route: "/journal" });
  }

  function selectJournal(j: DailyJournal) {
    setSelectedId(j.id);
    setActive({ kind: "Journal", id: j.id, label: j.date, route: "/journal" });
  }

  function updateSelected(patch: Partial<DailyJournal>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    commit((prev) => ({ ...prev, journals: prev.journals.map((x) => (x.id === next.id ? next : x)) }));
  }

  function updateTradingRules(patch: Partial<DailyJournal["tradingRules"]>) {
    if (!selected) return;
    const next = { ...selected, tradingRules: { ...selected.tradingRules, ...patch } };
    commit((prev) => ({ ...prev, journals: prev.journals.map((x) => (x.id === next.id ? next : x)) }));
  }

  function deleteOne(id: string) {
    if (!confirm("Delete this journal entry? This cannot be undone.")) return;
    commit((prev) => ({ ...prev, journals: prev.journals.filter((j) => j.id !== id) }));
    if (active.kind === "Journal" && active.id === id) clearActive();
    if (selectedId === id) setSelectedId(null);
  }

  function deleteAll() {
    if (!confirm("Delete ALL journals? This cannot be undone.")) return;
    commit((prev) => ({ ...prev, journals: [] }));
    if (active.kind === "Journal") clearActive();
    setSelectedId(null);
  }

  return (
    <Panel
      title="Daily Journals"
      right={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={addToday}>+ New for Today</Button>
          <DangerButton onClick={deleteAll} disabled={db.journals.length === 0}>
            Delete All Journals
          </DangerButton>
        </div>
      }
    >
      <Panel title="Search & Filters">
        <Row>
          <Label text="Search (focus, rules, levels, news, etc.)">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to search…" />
          </Label>
          <Label text="Date range">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From (YYYY-MM-DD)" />
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (YYYY-MM-DD)" />
            </div>
          </Label>
        </Row>

        <Button onClick={() => { setSearch(""); setFrom(""); setTo(""); }} disabled={!search && !from && !to}>
          Clear Filters
        </Button>

        <div style={{ opacity: 0.75, marginTop: 8 }}>
          Showing <strong>{filteredSorted.length}</strong> of <strong>{db.journals.length}</strong>
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
          {filteredSorted.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No matching journals.</div>
          ) : (
            filteredSorted.map((j) => (
              <div key={j.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                <Button onClick={() => selectJournal(j)} style={{ textAlign: "left" } as any}>
                  {j.date}{j.focus ? ` — ${j.focus.slice(0, 18)}${j.focus.length > 18 ? "…" : ""}` : ""}
                </Button>
                <DangerButton onClick={() => deleteOne(j.id)}>Delete</DangerButton>
              </div>
            ))
          )}
        </div>

        <div>
          {!selected ? (
            <div style={{ opacity: 0.7 }}>Select a journal entry (or create one for today).</div>
          ) : (
            <>
              <Panel title="Edit Journal" right={<DangerButton onClick={() => deleteOne(selected.id)}>Delete This Entry</DangerButton>}>
                <Row>
                  <Label text="Date">
                    <Input value={selected.date} onChange={(e) => updateSelected({ date: e.target.value })} />
                  </Label>
                  <Label text="Hard Stop Time">
                    <Input value={selected.hardStopTime} onChange={(e) => updateSelected({ hardStopTime: e.target.value })} />
                  </Label>
                </Row>

                <Label text="Daily Focus">
                  <TextArea value={selected.focus} onChange={(e) => updateSelected({ focus: e.target.value })} />
                </Label>
              </Panel>

              <Panel title="Market Prep">
                <Label text="Key Levels">
                  <TextArea value={selected.keyLevels} onChange={(e) => updateSelected({ keyLevels: e.target.value })} />
                </Label>
                <Label text="News / Events">
                  <TextArea value={selected.newsEvents} onChange={(e) => updateSelected({ newsEvents: e.target.value })} />
                </Label>
              </Panel>

              <Panel title="Trading Rules for the Day">
                <Row>
                  <Label text="Daily Max Loss">
                    <Input value={selected.tradingRules.dailyMaxLoss} onChange={(e) => updateTradingRules({ dailyMaxLoss: e.target.value })} />
                  </Label>
                  <Label text="Max Trades">
                    <Input value={selected.tradingRules.maxTrades} onChange={(e) => updateTradingRules({ maxTrades: e.target.value })} />
                  </Label>
                </Row>

                <Row>
                  <Label text="Max Risk Per Trade">
                    <Input value={selected.tradingRules.maxRiskPerTrade} onChange={(e) => updateTradingRules({ maxRiskPerTrade: e.target.value })} />
                  </Label>
                  <Label text="Allowed Setups">
                    <Input value={selected.tradingRules.allowedSetups} onChange={(e) => updateTradingRules({ allowedSetups: e.target.value })} />
                  </Label>
                </Row>

                <div style={{ opacity: 0.8 }}>
                  Reminder: Stop trading by <strong>11:00 AM</strong>.
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

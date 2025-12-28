import React, { useEffect, useMemo, useState } from "react";
import { useDB } from "../db/DBContext";
import { Panel, Row, Label, Input, Select, TextArea, Button, DangerButton } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";
import type { ComplianceLog } from "../types";

const uuid = () => crypto.randomUUID();

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

function num(v: string | undefined) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function calcDailyPnL(start: string, end: string, withdrew: boolean, withdrawal: string) {
  return (num(end) - num(start) + (withdrew ? num(withdrawal) : 0)).toFixed(2);
}

function newCompliance(accountId: string): ComplianceLog {
  const base: ComplianceLog = {
    id: uuid(),
    accountId,
    date: todayYYYYMMDD(),
    complianceGrade: "C",
    startingBalance: "",
    endingBalance: "",
    dailyPnL: "0.00",
    manualDrawdownRemaining: "",
    stayedWithinDailyMaxLoss: false,
    stayedWithinTrailingDrawdown: false,
    followedPositionSize: false,
    followedTradingHours: false,
    followedStopRule11: true,
    withdrewFunds: false,
    withdrawalAmount: "",
    withdrawalNotes: "",
    violations: "",
    notes: "",
  };

  base.dailyPnL = calcDailyPnL(base.startingBalance, base.endingBalance, base.withdrewFunds, base.withdrawalAmount);
  return base;
}

export default function CompliancePage() {
  const { db, commit } = useDB();
  const { setActive, clearActive } = useActiveRecord();

  const [accountId, setAccountId] = useState<string | null>(db.accounts[0]?.id ?? null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const logsForAccount = useMemo(() => {
    if (!accountId) return [];
    return db.compliance
      .filter((c) => c.accountId === accountId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.compliance, accountId]);

  const selectedLog = useMemo(() => {
    return logsForAccount.find((l) => l.id === selectedLogId) ?? null;
  }, [logsForAccount, selectedLogId]);

  // auto-select most recent
  useEffect(() => {
    if (!selectedLogId && logsForAccount[0]) setSelectedLogId(logsForAccount[0].id);
    if (selectedLogId && !logsForAccount.some((l) => l.id === selectedLogId)) {
      setSelectedLogId(logsForAccount[0]?.id ?? null);
    }
  }, [logsForAccount, selectedLogId]);

  const accountOptions = useMemo(() => {
    return db.accounts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: a.id,
        label: `${db.firms.find((f) => f.id === a.firmId)?.name ?? "Firm"} / ${a.name}`,
      }));
  }, [db.accounts, db.firms]);

  function selectLog(log: ComplianceLog) {
    setSelectedLogId(log.id);
    setActive({
      kind: "Compliance Log",
      id: log.id,
      label: `${log.date} (Grade ${log.complianceGrade ?? "C"})`,
      route: "/compliance",
    });
  }

  function addToday() {
    if (!accountId) return;
    const log = newCompliance(accountId);
    commit((prev) => ({ ...prev, compliance: [log, ...prev.compliance] }));
    setSelectedLogId(log.id);
    setActive({
      kind: "Compliance Log",
      id: log.id,
      label: `${log.date} (Grade ${log.complianceGrade})`,
      route: "/compliance",
    });
  }

  function updateLog(id: string, patch: Partial<ComplianceLog>) {
    const existing = db.compliance.find((c) => c.id === id);
    if (!existing) return;

    const next = { ...existing, ...patch };

    // keep grade valid
    if (!next.complianceGrade) next.complianceGrade = "C";

    // auto-calc P/L
    next.dailyPnL = calcDailyPnL(next.startingBalance, next.endingBalance, next.withdrewFunds, next.withdrawalAmount);

    // if withdrawals off, clear fields to avoid stale
    if (!next.withdrewFunds) {
      next.withdrawalAmount = "";
      next.withdrawalNotes = "";
      next.dailyPnL = calcDailyPnL(next.startingBalance, next.endingBalance, false, "");
    }

    commit((prev) => ({
      ...prev,
      compliance: prev.compliance.map((c) => (c.id === id ? next : c)),
    }));

    if (selectedLogId === id && (patch.date || patch.complianceGrade)) {
      setActive({
        kind: "Compliance Log",
        id,
        label: `${next.date} (Grade ${next.complianceGrade})`,
        route: "/compliance",
      });
    }
  }

  function deleteOne(id: string) {
    if (!confirm("Delete this compliance log? This cannot be undone.")) return;
    commit((prev) => ({ ...prev, compliance: prev.compliance.filter((c) => c.id !== id) }));
    if (selectedLogId === id) {
      setSelectedLogId(null);
      clearActive();
    }
  }

  function deleteAllForAccount() {
    if (!accountId) return;
    if (!confirm("Delete ALL compliance logs for this account? This cannot be undone.")) return;
    commit((prev) => ({ ...prev, compliance: prev.compliance.filter((c) => c.accountId !== accountId) }));
    setSelectedLogId(null);
    clearActive();
  }

  const cell: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: "1px solid #f2f2f2",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 12,
    opacity: 0.8,
    padding: "8px 8px",
    borderBottom: "1px solid #eee",
    whiteSpace: "nowrap",
    background: "#fafafa",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  const compactInputStyle: React.CSSProperties = {
    width: "120px",
  };

  const compactMoneyStyle: React.CSSProperties = {
    width: "110px",
  };

  return (
    <Panel
      title="Compliance Logs"
      right={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={addToday} disabled={!accountId}>
            + Today
          </Button>
          <DangerButton onClick={deleteAllForAccount} disabled={!accountId || logsForAccount.length === 0}>
            Delete All (Account)
          </DangerButton>
        </div>
      }
    >
      <Panel title="Account">
        <Row>
          <Label text="Select Account">
            <Select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)}>
              <option value="">— Select —</option>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Label>
          <div />
        </Row>
      </Panel>

      <Panel title="Compliance Entry Table">
        {logsForAccount.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No logs yet. Click “+ Today” to create one.</div>
        ) : (
          // This wrapper shifts content left/right by canceling common panel padding
          <div style={{ marginLeft: -12, marginRight: -12 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {[
                      "Date",
                      "Grade",
                      "Start",
                      "End",
                      "W/D?",
                      "W/D Amt",
                      "Daily P/L",
                      "DD Rem (Manual)",
                      "Daily Max Loss",
                      "Trailing DD",
                      "Pos Size",
                      "Hours",
                      "Stop 11",
                      "Delete",
                    ].map((h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {logsForAccount.map((l) => {
                    const isSelected = l.id === selectedLogId;

                    return (
                      <tr
                        key={l.id}
                        onClick={() => selectLog(l)}
                        style={{
                          background: isSelected ? "#f3f4f6" : "white",
                          cursor: "pointer",
                        }}
                        title="Click row to make active"
                      >
                        <td style={cell}>
                          <Input
                            style={compactInputStyle}
                            value={l.date}
                            onChange={(e) => updateLog(l.id, { date: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td style={cell}>
                          <Select
                            value={l.complianceGrade ?? "C"}
                            onChange={(e) => updateLog(l.id, { complianceGrade: e.target.value as any })}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="F">F</option>
                          </Select>
                        </td>

                        <td style={cell}>
                          <Input
                            style={compactMoneyStyle}
                            value={l.startingBalance}
                            onChange={(e) => updateLog(l.id, { startingBalance: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td style={cell}>
                          <Input
                            style={compactMoneyStyle}
                            value={l.endingBalance}
                            onChange={(e) => updateLog(l.id, { endingBalance: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td style={cell}>
                          <input
                            type="checkbox"
                            checked={l.withdrewFunds}
                            onChange={(e) => updateLog(l.id, { withdrewFunds: e.target.checked })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td style={cell}>
                          <Input
                            style={compactMoneyStyle}
                            value={l.withdrawalAmount}
                            onChange={(e) => updateLog(l.id, { withdrawalAmount: e.target.value })}
                            disabled={!l.withdrewFunds}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td style={cell}>
                          <Input style={compactMoneyStyle} value={l.dailyPnL} disabled onClick={(e) => e.stopPropagation()} />
                        </td>

                        <td style={cell}>
                          <Input
                            style={compactMoneyStyle}
                            value={l.manualDrawdownRemaining}
                            onChange={(e) => updateLog(l.id, { manualDrawdownRemaining: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        {[
                          ["stayedWithinDailyMaxLoss", l.stayedWithinDailyMaxLoss],
                          ["stayedWithinTrailingDrawdown", l.stayedWithinTrailingDrawdown],
                          ["followedPositionSize", l.followedPositionSize],
                          ["followedTradingHours", l.followedTradingHours],
                          ["followedStopRule11", l.followedStopRule11],
                        ].map(([key, checked]) => (
                          <td key={key} style={cell}>
                            <input
                              type="checkbox"
                              checked={Boolean(checked)}
                              onChange={(e) => updateLog(l.id, { [key]: e.target.checked } as any)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                        ))}

                        <td style={cell}>
                          <DangerButton
                            onClick={(e: any) => {
                              e.stopPropagation();
                              deleteOne(l.id);
                            }}
                          >
                            Delete
                          </DangerButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, paddingLeft: 12 }}>
                Daily P/L is calculated as: <strong>(Ending − Starting) + Withdrawal</strong>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Notes section stays the same: separate, large writing area */}
      <Panel
        title={selectedLog ? `Notes (Active: ${selectedLog.date} • Grade ${selectedLog.complianceGrade ?? "C"})` : "Notes"}
      >
        {!selectedLog ? (
          <div style={{ opacity: 0.75 }}>Click a row to make it active, then write notes here.</div>
        ) : (
          <>
            <Label text="Violations (if any)">
              <TextArea
                value={selectedLog.violations}
                onChange={(e) => updateLog(selectedLog.id, { violations: e.target.value })}
              />
            </Label>

            <Label text="Notes">
              <TextArea value={selectedLog.notes} onChange={(e) => updateLog(selectedLog.id, { notes: e.target.value })} />
            </Label>

            <Label text="Withdrawal Notes">
              <TextArea
                value={selectedLog.withdrawalNotes}
                onChange={(e) => updateLog(selectedLog.id, { withdrawalNotes: e.target.value })}
                disabled={!selectedLog.withdrewFunds}
              />
            </Label>
          </>
        )}
      </Panel>
    </Panel>
  );
}

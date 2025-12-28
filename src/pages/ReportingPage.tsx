import React, { useMemo, useState, useEffect } from "react";
import { useDB } from "../db/DBContext";
import { Panel, Row, Label, Input, Select, Button } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";

function num(s: string | undefined) {
  const v = Number(String(s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
}
function money(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function includesCI(h: string, n: string) {
  return h.toLowerCase().includes(n.toLowerCase());
}

export default function ReportingPage() {
  const { db } = useDB();
  const { setActive } = useActiveRecord();

  const [accountId, setAccountId] = useState<string>(""); // "" = all
  const [q, setQ] = useState<string>("");
  const [asOf, setAsOf] = useState<string>("");

  useEffect(() => {
    if (!accountId) return;
    const a = db.accounts.find((x) => x.id === accountId);
    const firm = a ? db.firms.find((f) => f.id === a.firmId) : null;
    setActive({
      kind: "Reporting Account",
      id: accountId,
      label: a ? `${firm?.name ?? "Firm"} / ${a.name}` : "Account",
      route: "/reporting",
    });
  }, [accountId, db.accounts, db.firms, setActive]);

  const accounts = useMemo(() => {
    const text = q.trim();
    return db.accounts
      .filter((a) => {
        if (accountId && a.id !== accountId) return false;
        if (!text) return true;
        const firm = db.firms.find((f) => f.id === a.firmId);
        const blob = [firm?.name ?? "", a.name, a.accountType, a.platform].join(" | ");
        return includesCI(blob, text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.accounts, db.firms, accountId, q]);

  const reportRows = useMemo(() => {
    return accounts.map((a) => {
      const firm = db.firms.find((f) => f.id === a.firmId);

      const logs = db.compliance
        .filter((c) => c.accountId === a.id)
        .filter((c) => (!asOf ? true : c.date <= asOf))
        .sort((x, y) => x.date.localeCompare(y.date));

      const latest = logs[logs.length - 1];
      const currentBalance = latest ? num(latest.endingBalance) : 0;

      const initialBalance =
        a.initialBalance?.trim()
          ? num(a.initialBalance)
          : logs.length
          ? num(logs[0].startingBalance)
          : 0;

      const highWater = logs.length ? Math.max(...logs.map((c) => num(c.endingBalance))) : currentBalance;

      const overallMaxLossLimit = num(a.overallMaxLossLimit);
      const trailingDrawdownLimit = num(a.trailingDrawdownLimit);

      const totalWithdrawals = logs.reduce((sum, c) => (c.withdrewFunds ? sum + num(c.withdrawalAmount) : sum), 0);

      const profitInclWithdrawals = (currentBalance + totalWithdrawals) - initialBalance;

      const overallUsed = Math.max(0, initialBalance - currentBalance);
      const overallRemaining = overallMaxLossLimit ? Math.max(0, overallMaxLossLimit - overallUsed) : 0;

      const trailingUsed = Math.max(0, highWater - currentBalance);
      const trailingRemaining = trailingDrawdownLimit ? Math.max(0, trailingDrawdownLimit - trailingUsed) : 0;

      return {
        key: a.id,
        firmName: firm?.name ?? "—",
        accountName: a.name,
        accountType: a.accountType,
        platform: a.platform || "—",
        asOfDate: latest?.date ?? "—",
        currentBalance,
        initialBalance,
        highWater,
        profitInclWithdrawals,
        totalWithdrawals,
        overallMaxLossLimit,
        overallRemaining,
        trailingDrawdownLimit,
        trailingRemaining,
      };
    });
  }, [accounts, db.compliance, db.firms, asOf]);

  return (
    <Panel title="Reporting">
      <Panel title="Search">
        <Row>
          <Label text="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {db.accounts.map((a) => {
                const firm = db.firms.find((f) => f.id === a.firmId);
                return (
                  <option key={a.id} value={a.id}>
                    {(firm?.name ?? "Firm")} / {a.name}
                  </option>
                );
              })}
            </Select>
          </Label>

          <Label text="Search (firm/account/type/platform)">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter…" />
          </Label>
        </Row>

        <Row>
          <Label text="As-of date (optional)">
            <Input value={asOf} onChange={(e) => setAsOf(e.target.value)} placeholder="YYYY-MM-DD" />
          </Label>
          <Label text="Quick Clear">
            <Button onClick={() => { setAccountId(""); setQ(""); setAsOf(""); }} disabled={!accountId && !q && !asOf}>
              Clear
            </Button>
          </Label>
        </Row>

        <div style={{ opacity: 0.75 }}>
          Showing <strong>{reportRows.length}</strong> account(s)
        </div>
      </Panel>

      <Panel title="Account Report">
        {reportRows.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No matching accounts.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reportRows.map((r) => (
              <div key={r.key} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {r.firmName} / {r.accountName}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {r.accountType} • {r.platform} • As of: <strong>{r.asOfDate}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
                  <Metric label="Current Balance" value={money(r.currentBalance)} />
                  <Metric label="Profit (incl withdrawals)" value={money(r.profitInclWithdrawals)} />
                  <Metric label="Total Withdrawals" value={money(r.totalWithdrawals)} />
                  <Metric label="High-Water Mark" value={money(r.highWater)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
                  <Metric label="Initial Balance" value={money(r.initialBalance)} />
                  <Metric label="Overall Max Loss Limit" value={money(r.overallMaxLossLimit)} />
                  <Metric label="Overall DD Remaining" value={money(r.overallRemaining)} />
                  <Metric label="Trailing DD Remaining" value={money(r.trailingRemaining)} />
                </div>

                {(r.initialBalance === 0 || r.overallMaxLossLimit === 0 || r.trailingDrawdownLimit === 0) && (
                  <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                    Tip: Fill in <strong>Initial Balance</strong>, <strong>Overall Max Loss Limit</strong>, and{" "}
                    <strong>Trailing Drawdown Limit</strong> on the Prop Firms page for accurate drawdown remaining.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

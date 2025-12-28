import React, { useEffect, useMemo, useState } from "react";
import { useDB } from "../db/DBContext";
import { Panel, Row, Label, Select, Button } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";

function num(v?: string) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

type Metric = "balance" | "profitInclWithdrawals" | "withdrawals";
type Overlay = "global" | "firms" | "accounts";

type Series = {
  key: string;
  label: string;
  points: { date: string; y: number }[];
};

export default function ReportingTotalsPage() {
  const { db } = useDB();
  const { setActive } = useActiveRecord();

  const [firmId, setFirmId] = useState<string>(""); // "" = all firms
  const [overlay, setOverlay] = useState<Overlay>("global");
  const [metric, setMetric] = useState<Metric>("balance");

  useEffect(() => {
    const label = firmId ? db.firms.find((f) => f.id === firmId)?.name ?? "Firm" : "All Firms";
    setActive({ kind: "Reporting Totals", id: firmId || null, label, route: "/reporting-totals" });
  }, [firmId, db.firms, setActive]);

  const firmsSorted = useMemo(() => [...db.firms].sort((a, b) => a.name.localeCompare(b.name)), [db.firms]);

  const accountsInScope = useMemo(() => {
    const accs = firmId ? db.accounts.filter((a) => a.firmId === firmId) : db.accounts;
    return accs.map((a) => ({
      ...a,
      firmName: db.firms.find((f) => f.id === a.firmId)?.name ?? "—",
    }));
  }, [db.accounts, db.firms, firmId]);

  const accountIdSet = useMemo(() => new Set(accountsInScope.map((a) => a.id)), [accountsInScope]);

  const logsInScope = useMemo(() => {
    return db.compliance
      .filter((c) => accountIdSet.has(c.accountId))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [db.compliance, accountIdSet]);

  // Build per-account logs lookup for efficient time series calculations
  const logsByAccount = useMemo(() => {
    const map = new Map<string, typeof logsInScope>();
    for (const a of accountsInScope) map.set(a.id, []);
    for (const l of logsInScope) {
      const arr = map.get(l.accountId);
      if (arr) arr.push(l);
    }
    for (const [k, arr] of map) {
      map.set(
        k,
        arr.slice().sort((x, y) => x.date.localeCompare(y.date))
      );
    }
    return map;
  }, [accountsInScope, logsInScope]);

  function getInitialBalance(accountId: string) {
    const a = accountsInScope.find((x) => x.id === accountId);
    if (!a) return 0;
    if ((a.initialBalance ?? "").trim()) return num(a.initialBalance);
    const arr = logsByAccount.get(accountId) ?? [];
    return arr.length ? num(arr[0].startingBalance) : 0;
  }

  function withdrawalsUpTo(accountId: string, date: string) {
    const arr = logsByAccount.get(accountId) ?? [];
    let sum = 0;
    for (const l of arr) {
      if (l.date > date) break;
      if (l.withdrewFunds) sum += num(l.withdrawalAmount);
    }
    return sum;
  }

  function endingBalanceOnOrBefore(accountId: string, date: string) {
    const arr = logsByAccount.get(accountId) ?? [];
    let best: any = null;
    for (const l of arr) {
      if (l.date <= date) best = l;
      else break;
    }
    return best ? num(best.endingBalance) : 0;
  }

  // Totals per firm (latest per account)
  const totals = useMemo(() => {
    const byFirm: Record<
      string,
      {
        firmId: string;
        firmName: string;
        accounts: number;
        currentBalance: number;
        totalWithdrawals: number;
        initialBalanceSum: number;
        profitInclWithdrawals: number;
      }
    > = {};

    const accsAll = firmId ? db.accounts.filter((a) => a.firmId === firmId) : db.accounts;

    for (const a of accsAll) {
      const firmName = db.firms.find((f) => f.id === a.firmId)?.name ?? "—";
      const key = a.firmId;

      if (!byFirm[key]) {
        byFirm[key] = {
          firmId: key,
          firmName,
          accounts: 0,
          currentBalance: 0,
          totalWithdrawals: 0,
          initialBalanceSum: 0,
          profitInclWithdrawals: 0,
        };
      }

      const arr = db.compliance
        .filter((c) => c.accountId === a.id)
        .slice()
        .sort((x, y) => x.date.localeCompare(y.date));

      const latest = arr[arr.length - 1];
      const currentBalance = latest ? num(latest.endingBalance) : 0;

      const init = (a.initialBalance ?? "").trim() ? num(a.initialBalance) : arr.length ? num(arr[0].startingBalance) : 0;
      const w = arr.reduce((s, l) => (l.withdrewFunds ? s + num(l.withdrawalAmount) : s), 0);
      const profit = (currentBalance + w) - init;

      byFirm[key].accounts += 1;
      byFirm[key].currentBalance += currentBalance;
      byFirm[key].totalWithdrawals += w;
      byFirm[key].initialBalanceSum += init;
      byFirm[key].profitInclWithdrawals += profit;
    }

    const rows = Object.values(byFirm).sort((a, b) => a.firmName.localeCompare(b.firmName));
    const global = rows.reduce(
      (acc, r) => {
        acc.accounts += r.accounts;
        acc.currentBalance += r.currentBalance;
        acc.totalWithdrawals += r.totalWithdrawals;
        acc.initialBalanceSum += r.initialBalanceSum;
        acc.profitInclWithdrawals += r.profitInclWithdrawals;
        return acc;
      },
      { accounts: 0, currentBalance: 0, totalWithdrawals: 0, initialBalanceSum: 0, profitInclWithdrawals: 0 }
    );

    return { rows, global };
  }, [db.accounts, db.compliance, db.firms, firmId]);

  // Drawdown warning: remaining < 20% of max loss/drawdown limit (manual or derived)
  const drawdownWarning = useMemo(() => {
    // We only warn when we have BOTH remaining and a max limit so % makes sense.
    // Max limit preference: trailingDrawdownLimit if present else overallMaxLossLimit
    for (const a of accountsInScope) {
      const arr = logsByAccount.get(a.id) ?? [];
      if (!arr.length) continue;

      const latest = arr[arr.length - 1];
      const maxLimit = num(a.trailingDrawdownLimit) || num(a.overallMaxLossLimit);
      if (maxLimit <= 0) continue;

      // Manual remaining override if present; otherwise compute a rough remaining based on initial/ending
      const manualRemaining = num(latest.manualDrawdownRemaining);
      const remaining = manualRemaining > 0 ? manualRemaining : Math.max(0, maxLimit - Math.max(0, getInitialBalance(a.id) - num(latest.endingBalance)));

      const pct = (remaining / maxLimit) * 100;
      if (pct < 20) return true;
    }
    return false;
  }, [accountsInScope, logsByAccount]);

  // Build time-series dates (from logs). If none, chart should show a helpful message.
  const allDates = useMemo(() => Array.from(new Set(logsInScope.map((l) => l.date))).sort(), [logsInScope]);

  // Build overlay series
  const seriesList: Series[] = useMemo(() => {
    if (allDates.length === 0) return [];

    const makePointsForAccounts = (accIds: string[]) => {
      return allDates.map((d) => {
        let bal = 0;
        let w = 0;
        let initSum = 0;

        for (const id of accIds) {
          bal += endingBalanceOnOrBefore(id, d);
          w += withdrawalsUpTo(id, d);
          initSum += getInitialBalance(id);
        }

        let y = 0;
        if (metric === "balance") y = bal;
        if (metric === "withdrawals") y = w;
        if (metric === "profitInclWithdrawals") y = (bal + w) - initSum;

        return { date: d, y };
      });
    };

    if (overlay === "global") {
      return [
        {
          key: "global",
          label: firmId ? "Firm Total" : "Global Total",
          points: makePointsForAccounts(accountsInScope.map((a) => a.id)),
        },
      ];
    }

    if (overlay === "firms") {
      const byFirm = new Map<string, { firmName: string; ids: string[] }>();
      for (const a of accountsInScope) {
        if (!byFirm.has(a.firmId)) byFirm.set(a.firmId, { firmName: a.firmName, ids: [] });
        byFirm.get(a.firmId)!.ids.push(a.id);
      }
      return Array.from(byFirm.entries())
        .sort((a, b) => a[1].firmName.localeCompare(b[1].firmName))
        .map(([fid, info]) => ({
          key: `firm-${fid}`,
          label: info.firmName,
          points: makePointsForAccounts(info.ids),
        }));
    }

    // overlay === "accounts"
    // Only make account overlays when firm is selected OR the number of accounts is small.
    const maxLines = firmId ? 12 : 6;
    const accs = accountsInScope.slice(0, maxLines);
    return accs.map((a) => ({
      key: `acct-${a.id}`,
      label: `${a.firmName} / ${a.name}`,
      points: makePointsForAccounts([a.id]),
    }));
  }, [
    allDates,
    accountsInScope,
    overlay,
    metric,
    firmId,
    endingBalanceOnOrBefore,
    withdrawalsUpTo,
    getInitialBalance,
  ]);

  return (
    <Panel
      title="Reporting Totals"
      right={
        <Button onClick={() => { setFirmId(""); setOverlay("global"); setMetric("balance"); }}>
          Reset View
        </Button>
      }
    >
      {drawdownWarning && (
        <div style={{ background: "#fff3cd", padding: 10, borderRadius: 10, marginBottom: 12, border: "1px solid #ffe8a3" }}>
          ⚠️ <strong>Warning:</strong> Drawdown remaining is below <strong>20%</strong> on one or more accounts.
        </div>
      )}

      <Panel title="Controls">
        <Row>
          <Label text="Firm scope">
            <Select value={firmId} onChange={(e) => setFirmId(e.target.value)}>
              <option value="">All Firms (Global)</option>
              {firmsSorted.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Label>

          <Label text="Overlay">
            <Select value={overlay} onChange={(e) => setOverlay(e.target.value as Overlay)}>
              <option value="global">Global total (single line)</option>
              <option value="firms">Per firm overlay (multiple lines)</option>
              <option value="accounts">Per account overlay</option>
            </Select>
          </Label>
        </Row>

        <Row>
          <Label text="Chart metric">
            <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="balance">Total balance</option>
              <option value="profitInclWithdrawals">Profit (incl withdrawals)</option>
              <option value="withdrawals">Total withdrawals</option>
            </Select>
          </Label>
          <div />
        </Row>

        {overlay === "accounts" && !firmId && accountsInScope.length > 6 && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Note: Showing first 6 accounts for readability. Select a firm to see more (up to 12).
          </div>
        )}
      </Panel>

      <Panel title="Totals by Firm">
        {totals.rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No firms/accounts yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {totals.rows.map((r) => (
              <div key={r.firmId} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 850, fontSize: 16 }}>{r.firmName}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{r.accounts} account(s)</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
                  <Metric label="Current Balance" value={money(r.currentBalance)} />
                  <Metric label="Profit (incl withdrawals)" value={money(r.profitInclWithdrawals)} />
                  <Metric label="Total Withdrawals" value={money(r.totalWithdrawals)} />
                  <Metric label="Initial Balance Sum" value={money(r.initialBalanceSum)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Global Totals (All Firms Combined)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <Metric label="Accounts" value={String(totals.global.accounts)} />
          <Metric label="Current Balance" value={money(totals.global.currentBalance)} />
          <Metric label="Profit (incl withdrawals)" value={money(totals.global.profitInclWithdrawals)} />
          <Metric label="Total Withdrawals" value={money(totals.global.totalWithdrawals)} />
        </div>
      </Panel>

      <Panel title="Equity Curve">
        {allDates.length < 2 || seriesList.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            Not enough data to chart yet. Add compliance logs on multiple dates with ending balances.
          </div>
        ) : (
          <MultiLineChart
            title={
              metric === "balance"
                ? "Equity Curve (Balance)"
                : metric === "withdrawals"
                ? "Withdrawals Over Time"
                : "Profit (Including Withdrawals) Over Time"
            }
            series={seriesList}
          />
        )}
      </Panel>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value || "—"}</div>
    </div>
  );
}

/**
 * Pure SVG multi-line chart with auto-scaling.
 * No external deps.
 */
function MultiLineChart({ title, series }: { title: string; series: Series[] }) {
  const W = 980;
  const H = 320;
  const padL = 46;
  const padR = 14;
  const padT = 18;
  const padB = 34;

  const allPoints = series.flatMap((s) => s.points.map((p) => p.y));
  const minY = Math.min(...allPoints);
  const maxY = Math.max(...allPoints);
  const range = maxY - minY || 1;

  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const n = dates.length;
  const xStep = n > 1 ? (W - padL - padR) / (n - 1) : 1;

  function x(i: number) {
    return padL + i * xStep;
  }
  function y(v: number) {
    const t = (v - minY) / range;
    return padT + (H - padT - padB) * (1 - t);
  }

  const lastDate = dates[dates.length - 1] ?? "";
  const midDate = dates[Math.floor(dates.length / 2)] ?? "";
  const firstDate = dates[0] ?? "";

  // Simple palette without specifying colors? You didn’t restrict chart colors, so we’ll use a minimal grayscale-ish palette.
  const palette = ["#111", "#555", "#888", "#222", "#666", "#999", "#333", "#777", "#aaa", "#000", "#444", "#bbb"];

  const paths = series.map((s, idx) => {
    const d = s.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.y).toFixed(2)}`)
      .join(" ");
    return { ...s, d, stroke: palette[idx % palette.length] };
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>

      <svg width={W} height={H} style={{ border: "1px solid #eee", borderRadius: 12, background: "white" }}>
        {/* axes */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#ddd" />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#ddd" />

        {/* y labels */}
        <text x={padL + 6} y={padT + 12} fontSize="11" fill="#666">
          max {maxY.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </text>
        <text x={padL + 6} y={H - padB - 6} fontSize="11" fill="#666">
          min {minY.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </text>

        {/* x labels */}
        <text x={padL} y={H - 10} fontSize="11" fill="#666">
          {firstDate}
        </text>
        <text x={(padL + (W - padR)) / 2 - 34} y={H - 10} fontSize="11" fill="#666">
          {midDate}
        </text>
        <text x={W - padR - 100} y={H - 10} fontSize="11" fill="#666">
          {lastDate}
        </text>

        {/* lines */}
        {paths.map((p, idx) => (
          <g key={p.key}>
            <path d={p.d} fill="none" stroke={p.stroke} strokeWidth={2} />
            {/* hover titles on endpoints */}
            {p.points.length > 0 ? (
              <circle cx={x(p.points.length - 1)} cy={y(p.points[p.points.length - 1].y)} r={3} fill={p.stroke}>
                <title>
                  {p.label} — {p.points[p.points.length - 1].date}:{" "}
                  {p.points[p.points.length - 1].y.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </title>
              </circle>
            ) : null}
          </g>
        ))}
      </svg>

      {/* legend */}
      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, opacity: 0.85 }}>
        {paths.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: p.stroke, display: "inline-block", borderRadius: 99 }} />
            <span>{p.label}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Tip: Make sure your compliance logs have an <strong>Ending Balance</strong> filled in for each date.
      </div>
    </div>
  );
}

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

  const [firmId, setFirmId] = useState(""); // "" = all firms
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
    const map = new Map<string, any[]>();
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

      const profit = currentBalance + w - init;

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
      const remaining =
        manualRemaining > 0
          ? manualRemaining
          : Math.max(0, maxLimit - Math.max(0, getInitialBalance(a.id) - num(latest.endingBalance)));

      const pct = (remaining / maxLimit) * 100;
      if (pct < 20) return true;
    }
    return false;
  }, [accountsInScope, logsByAccount]);

  // Build time-series dates (from logs).
  // If none, chart should show a helpful message.
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
        if (metric === "profitInclWithdrawals") y = bal + w - initSum;

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
    // functions referenced above (they are stable within render but included for eslint completeness)
    // @ts-ignore
    endingBalanceOnOrBefore,
    // @ts-ignore
    withdrawalsUpTo,
    // @ts-ignore
    getInitialBalance,
  ]);

  const globalRow = totals.global;

  return (
    <div style={{ padding: "0 16px" }}>
      <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Reporting Totals</div>
        <Button
          onClick={() => {
            setFirmId("");
            setOverlay("global");
            setMetric("balance");
          }}
        >
          Reset View
        </Button>
      </Row>

      {drawdownWarning && (
        <Panel style={{ marginBottom: 12, borderColor: "#f59e0b" }}>
          <div style={{ fontWeight: 700, color: "#92400e" }}>⚠️ Warning: Drawdown remaining is below 20% on one or more accounts.</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            Check the latest compliance logs / drawdown remaining values for those accounts.
          </div>
        </Panel>
      )}

      <Panel>
        <Row style={{ gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <Label>Firm Scope</Label>
            <Select value={firmId} onChange={(e) => setFirmId(e.target.value)}>
              <option value="">All Firms (Global)</option>
              {firmsSorted.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: 260 }}>
            <Label>Overlay</Label>
            <Select value={overlay} onChange={(e) => setOverlay(e.target.value as Overlay)}>
              <option value="global">Global total (single line)</option>
              <option value="firms">Per firm overlay (multiple lines)</option>
              <option value="accounts">Per account overlay</option>
            </Select>
          </div>

          <div style={{ minWidth: 260 }}>
            <Label>Metric</Label>
            <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="balance">Total balance</option>
              <option value="profitInclWithdrawals">Profit (incl withdrawals)</option>
              <option value="withdrawals">Total withdrawals</option>
            </Select>
          </div>
        </Row>

        {overlay === "accounts" && !firmId && accountsInScope.length > 6 && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Note: Showing first 6 accounts for readability. Select a firm to see more (up to 12).
          </div>
        )}

        <Row style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Metric label="Accounts" value={String(globalRow.accounts)} />
          <Metric label="Current balance" value={`$${money(globalRow.currentBalance)}`} />
          <Metric label="Total withdrawals" value={`$${money(globalRow.totalWithdrawals)}`} />
          <Metric label="Profit (incl withdrawals)" value={`$${money(globalRow.profitInclWithdrawals)}`} />
        </Row>
      </Panel>

      <Row style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginTop: 12 }}>
        <Panel style={{ flex: "1 1 520px", minWidth: 520 }}>
          {allDates.length < 2 || seriesList.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Not enough data to chart yet. Add compliance logs on multiple dates with ending balances.
            </div>
          ) : (
            <MultiLineChart
              title={
                metric === "balance"
                  ? "Total Balance Over Time"
                  : metric === "withdrawals"
                  ? "Total Withdrawals Over Time"
                  : "Profit (Incl Withdrawals) Over Time"
              }
              series={seriesList}
            />
          )}
        </Panel>

        <Panel style={{ flex: "1 1 320px", minWidth: 320 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>By Firm (Latest Totals)</div>
          {totals.rows.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.8 }}>No firms/accounts yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {totals.rows.map((r) => (
                <div
                  key={r.firmId}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(255,255,255,0.7)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.firmName}</div>
                    <Button onClick={() => setFirmId(r.firmId)} style={{ padding: "6px 10px" }}>
                      View
                    </Button>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{r.accounts} account(s)</div>

                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Current Balance</div>
                      <div style={{ fontWeight: 700 }}>${money(r.currentBalance)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Withdrawals</div>
                      <div style={{ fontWeight: 700 }}>${money(r.totalWithdrawals)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Profit (incl w/d)</div>
                      <div style={{ fontWeight: 700 }}>${money(r.profitInclWithdrawals)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Initial Sum</div>
                      <div style={{ fontWeight: 700 }}>${money(r.initialBalanceSum)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Row>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", minWidth: 170 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontWeight: 800, marginTop: 2 }}>{value || "—"}</div>
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

  // Padding: increase left a bit so $-labels never clip.
  const padL = 72;
  const padR = 16;
  const padT = 18;
  const padB = 36;

  // Y-axis styling
  const MAJOR_STEP = 500;
  const MINOR_STEP = 250;

  const allPoints = series.flatMap((s) => s.points.map((p) => p.y));
  const rawMinY = Math.min(...allPoints);
  const rawMaxY = Math.max(...allPoints);

  // "Nice" bounds snapped to MAJOR_STEP so ticks are clean ($500 labels).
  const niceMinY = Math.floor(rawMinY / MAJOR_STEP) * MAJOR_STEP;
  let niceMaxY = Math.ceil(rawMaxY / MAJOR_STEP) * MAJOR_STEP;
  if (niceMaxY === niceMinY) niceMaxY = niceMinY + MAJOR_STEP;

  const range = niceMaxY - niceMinY || 1;

  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const n = dates.length;
  const xStep = n > 1 ? (W - padL - padR) / (n - 1) : 1;

  function x(i: number) {
    return padL + i * xStep;
  }
  function y(v: number) {
    const t = (v - niceMinY) / range;
    return padT + (H - padT - padB) * (1 - t);
  }

  function fmtAxisMoney(v: number) {
    const rounded = Math.round(v);
    return `$${rounded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  function fmtValue(v: number) {
    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const lastDate = dates[dates.length - 1] ?? "";
  const midDate = dates[Math.floor(dates.length / 2)] ?? "";
  const firstDate = dates[0] ?? "";

  // Build ticks
  const majorTicks: number[] = [];
  for (let v = niceMinY; v <= niceMaxY + 0.0001; v += MAJOR_STEP) majorTicks.push(v);

  const minorTicks: number[] = [];
  for (let v = niceMinY; v <= niceMaxY + 0.0001; v += MINOR_STEP) {
    // Skip majors (avoid double-drawing)
    if (Math.abs(v % MAJOR_STEP) < 0.0001) continue;
    minorTicks.push(v);
  }

  // Minimal palette (kept as-is)
  const palette = ["#111", "#555", "#888", "#222", "#666", "#999", "#333", "#777", "#aaa", "#000", "#444", "#bbb"];

  const paths = series.map((s, idx) => {
    const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.y).toFixed(2)}`).join(" ");
    return { ...s, d, stroke: palette[idx % palette.length] };
  });

  // Vertical gridlines: ~4 segments (start/end included)
  const vLines: number[] = [];
  if (n > 1) {
    const step = Math.max(1, Math.round((n - 1) / 4));
    for (let i = 0; i < n; i += step) vLines.push(i);
    if (vLines[vLines.length - 1] !== n - 1) vLines.push(n - 1);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Range: {fmtAxisMoney(niceMinY)} – {fmtAxisMoney(niceMaxY)}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 8, overflow: "visible" }}>
        {/* chart background */}
        <rect
          x={padL}
          y={padT}
          width={W - padL - padR}
          height={H - padT - padB}
          fill="white"
          stroke="#e5e7eb"
          strokeWidth={1}
          rx={10}
        />

        {/* horizontal minor gridlines */}
        {minorTicks.map((v) => (
          <line
            key={`y-minor-${v}`}
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="#e5e7eb"
            strokeWidth={1}
            opacity={0.35}
          />
        ))}

        {/* horizontal major gridlines + labels */}
        {majorTicks.map((v) => (
          <g key={`y-major-${v}`}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} opacity={0.85} />
            <text x={padL - 10} y={y(v) + 4} fontSize={12} textAnchor="end" fill="#111" opacity={0.85}>
              {fmtAxisMoney(v)}
            </text>
          </g>
        ))}

        {/* vertical gridlines */}
        {vLines.map((i) => (
          <line
            key={`x-grid-${i}`}
            x1={x(i)}
            x2={x(i)}
            y1={padT}
            y2={H - padB}
            stroke="#e5e7eb"
            strokeWidth={1}
            opacity={0.35}
          />
        ))}

        {/* axes (border) */}
        <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="#111" strokeWidth={1} opacity={0.7} />
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="#111" strokeWidth={1} opacity={0.7} />

        {/* x labels */}
        <text x={padL} y={H - 12} fontSize={12} textAnchor="start" fill="#111" opacity={0.85}>
          {firstDate}
        </text>
        <text x={(padL + (W - padR)) / 2} y={H - 12} fontSize={12} textAnchor="middle" fill="#111" opacity={0.85}>
          {midDate}
        </text>
        <text x={W - padR} y={H - 12} fontSize={12} textAnchor="end" fill="#111" opacity={0.85}>
          {lastDate}
        </text>

        {/* lines */}
        {paths.map((p) => (
          <g key={p.key}>
            <path d={p.d} fill="none" stroke={p.stroke} strokeWidth={2} />

            {/* endpoints */}
            {p.points.map((pt, i) => {
              const isLast = i === p.points.length - 1;
              if (!isLast) return null;
              return (
                <g key={`${p.key}-end-${i}`}>
                  <circle cx={x(i)} cy={y(pt.y)} r={3} fill={p.stroke} />
                  <title>
                    {p.label} — {pt.date}: {fmtValue(pt.y)}
                  </title>
                </g>
              );
            })}
          </g>
        ))}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, fontSize: 13 }}>
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

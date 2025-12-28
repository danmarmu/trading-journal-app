import React, { useMemo, useState, useEffect } from "react";
import { useDB } from "../db/DBContext";
import { Panel, Row, Label, Input, Select, Button, DangerButton } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";
import type { PropAccountType } from "../types";

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

export default function PropFirmsPage() {
  const { db, commit } = useDB();
  const { active, setActive, clearActive } = useActiveRecord();

  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(db.firms[0]?.id ?? null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(db.accounts[0]?.id ?? null);

  const [firmSearch, setFirmSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | PropAccountType>("");

  useEffect(() => {
    if (selectedFirmId && !db.firms.some((f) => f.id === selectedFirmId)) setSelectedFirmId(db.firms[0]?.id ?? null);
  }, [db.firms, selectedFirmId]);

  useEffect(() => {
    if (selectedAccountId && !db.accounts.some((a) => a.id === selectedAccountId)) setSelectedAccountId(db.accounts[0]?.id ?? null);
  }, [db.accounts, selectedAccountId]);

  const firmsFiltered = useMemo(() => {
    const q = firmSearch.trim();
    if (!q) return db.firms;
    return db.firms.filter((f) => includesCI(f.name ?? "", q));
  }, [db.firms, firmSearch]);

  const accountsForFirmFiltered = useMemo(() => {
    const base = db.accounts.filter((a) => a.firmId === selectedFirmId);
    const q = accountSearch.trim();
    return base
      .filter((a) => {
        if (typeFilter && a.accountType !== typeFilter) return false;
        if (!q) return true;
        return includesCI([a.name, a.accountType, a.platform, a.startDate].join(" | "), q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.accounts, selectedFirmId, accountSearch, typeFilter]);

  const selectedFirm = db.firms.find((f) => f.id === selectedFirmId) ?? null;

  function addFirm() {
    const f = { id: uuid(), name: "New Firm" };
    commit((prev) => ({ ...prev, firms: [f, ...prev.firms] }));
    setSelectedFirmId(f.id);
    setActive({ kind: "Firm", id: f.id, label: f.name, route: "/prop-firms" });
  }

  function updateFirmName(id: string, name: string) {
    commit((prev) => ({ ...prev, firms: prev.firms.map((f) => (f.id === id ? { ...f, name } : f)) }));
    if (active.kind === "Firm" && active.id === id) setActive({ kind: "Firm", id, label: name, route: "/prop-firms" });
  }

  function addAccount() {
    if (!selectedFirmId) return;
    const a = {
      id: uuid(),
      firmId: selectedFirmId,
      name: "New Account",
      accountType: "Evaluation" as PropAccountType,
      platform: "",
      startDate: todayYYYYMMDD(),
      initialBalance: "",
      overallMaxLossLimit: "",
      trailingDrawdownLimit: "",
    };
    commit((prev) => ({ ...prev, accounts: [a, ...prev.accounts] }));
    setSelectedAccountId(a.id);
    setActive({ kind: "Account", id: a.id, label: a.name, route: "/prop-firms" });
  }

  function updateAccount(id: string, patch: any) {
    commit((prev) => ({ ...prev, accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    if (active.kind === "Account" && active.id === id && patch?.name) {
      setActive({ kind: "Account", id, label: patch.name, route: "/prop-firms" });
    }
  }

  function selectFirm(id: string) {
    const f = db.firms.find((x) => x.id === id);
    setSelectedFirmId(id);
    setActive({ kind: "Firm", id, label: f?.name ?? "Firm", route: "/prop-firms" });
  }

  function selectAccount(id: string) {
    const a = db.accounts.find((x) => x.id === id);
    setSelectedAccountId(id);
    setActive({ kind: "Account", id, label: a?.name ?? "Account", route: "/prop-firms" });
  }

  function deleteFirm(firmId: string) {
    const firm = db.firms.find((f) => f.id === firmId);
    const firmAccounts = db.accounts.filter((a) => a.firmId === firmId);
    const accountIds = new Set(firmAccounts.map((a) => a.id));
    const complianceCount = db.compliance.filter((c) => accountIds.has(c.accountId)).length;

    const msg =
      `Delete firm "${firm?.name ?? "Unknown"}"?\n\n` +
      `This will also delete:\n` +
      `• ${firmAccounts.length} account(s)\n` +
      `• ${complianceCount} compliance log(s)\n\n` +
      `This cannot be undone.`;

    if (!confirm(msg)) return;

    commit((prev) => ({
      ...prev,
      firms: prev.firms.filter((f) => f.id !== firmId),
      accounts: prev.accounts.filter((a) => a.firmId !== firmId),
      compliance: prev.compliance.filter((c) => !accountIds.has(c.accountId)),
    }));

    if ((active.kind === "Firm" && active.id === firmId) || (active.kind === "Account" && accountIds.has(String(active.id)))) {
      clearActive();
    }
    if (selectedFirmId === firmId) setSelectedFirmId(null);
  }

  function deleteAccount(accountId: string) {
    const acc = db.accounts.find((a) => a.id === accountId);
    const count = db.compliance.filter((c) => c.accountId === accountId).length;

    if (!confirm(`Delete account "${acc?.name ?? "Unknown"}"?\n\nThis will also delete ${count} compliance log(s).\n\nThis cannot be undone.`)) return;

    commit((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== accountId),
      compliance: prev.compliance.filter((c) => c.accountId !== accountId),
    }));

    if (active.kind === "Account" && active.id === accountId) clearActive();
    if (selectedAccountId === accountId) setSelectedAccountId(null);
  }

  function deleteAllFirmsAccountsCompliance() {
    if (!confirm("Delete ALL firms, accounts, and compliance logs?\n\nThis cannot be undone.")) return;
    commit((prev) => ({ ...prev, firms: [], accounts: [], compliance: [] }));
    setSelectedFirmId(null);
    setSelectedAccountId(null);
    if (active.kind === "Firm" || active.kind === "Account" || active.kind === "Compliance Log") clearActive();
  }

  return (
    <Panel
      title="Prop Firms & Accounts"
      right={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={addFirm}>+ Add Firm</Button>
          <Button onClick={addAccount} disabled={!selectedFirmId}>+ Add Account</Button>
          <DangerButton
            onClick={deleteAllFirmsAccountsCompliance}
            disabled={db.firms.length === 0 && db.accounts.length === 0 && db.compliance.length === 0}
          >
            Delete All Firms/Accounts/Compliance
          </DangerButton>
        </div>
      }
    >
      <Panel title="Search & Filters">
        <Row>
          <Label text="Search Firms">
            <Input value={firmSearch} onChange={(e) => setFirmSearch(e.target.value)} placeholder="Firm name..." />
          </Label>
          <Label text="Search Accounts (selected firm)">
            <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Account name, type, platform..." />
          </Label>
        </Row>
        <Row>
          <Label text="Account Type Filter">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="">All</option>
              <option value="Evaluation">Evaluation</option>
              <option value="Sim Funded">Sim Funded</option>
              <option value="Live">Live</option>
              <option value="Personal">Personal</option>
            </Select>
          </Label>
          <Label text="Quick Clear">
            <Button
              onClick={() => { setFirmSearch(""); setAccountSearch(""); setTypeFilter(""); }}
              disabled={!firmSearch && !accountSearch && !typeFilter}
            >
              Clear Filters
            </Button>
          </Label>
        </Row>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
          {firmsFiltered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No matching firms.</div>
          ) : (
            firmsFiltered.map((f) => (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                <Button onClick={() => selectFirm(f.id)} style={{ textAlign: "left" } as any}>{f.name}</Button>
                <DangerButton onClick={() => deleteFirm(f.id)}>Delete</DangerButton>
              </div>
            ))
          )}
        </div>

        <div>
          {!selectedFirm ? (
            <div style={{ opacity: 0.7 }}>Select a firm.</div>
          ) : (
            <>
              <Panel title="Firm" right={<DangerButton onClick={() => deleteFirm(selectedFirm.id)}>Delete Firm</DangerButton>}>
                <Label text="Firm Name">
                  <Input value={selectedFirm.name} onChange={(e) => updateFirmName(selectedFirm.id, e.target.value)} />
                </Label>
              </Panel>

              <Panel title="Accounts for this Firm">
                {accountsForFirmFiltered.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>No matching accounts for this firm.</div>
                ) : (
                  accountsForFirmFiltered.map((a) => (
                    <div key={a.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>{a.name}</div>
                        <div>
                          <Button onClick={() => selectAccount(a.id)}>Select</Button>
                          <DangerButton onClick={() => deleteAccount(a.id)}>Delete</DangerButton>
                        </div>
                      </div>

                      <Row>
                        <Label text="Account Name">
                          <Input value={a.name} onChange={(e) => updateAccount(a.id, { name: e.target.value })} />
                        </Label>
                        <Label text="Type">
                          <Select value={a.accountType} onChange={(e) => updateAccount(a.id, { accountType: e.target.value })}>
                            <option value="Evaluation">Evaluation</option>
                            <option value="Sim Funded">Sim Funded</option>
                            <option value="Live">Live</option>
                            <option value="Personal">Personal</option>
                          </Select>
                        </Label>
                      </Row>

                      <Row>
                        <Label text="Platform">
                          <Input value={a.platform} onChange={(e) => updateAccount(a.id, { platform: e.target.value })} />
                        </Label>
                        <Label text="Start Date">
                          <Input value={a.startDate} onChange={(e) => updateAccount(a.id, { startDate: e.target.value })} />
                        </Label>
                      </Row>

                      <Row>
                        <Label text="Initial Balance">
                          <Input value={a.initialBalance ?? ""} onChange={(e) => updateAccount(a.id, { initialBalance: e.target.value })} placeholder="e.g. 50000" />
                        </Label>
                        <Label text="Overall Max Loss Limit">
                          <Input value={a.overallMaxLossLimit ?? ""} onChange={(e) => updateAccount(a.id, { overallMaxLossLimit: e.target.value })} placeholder="e.g. 2500" />
                        </Label>
                      </Row>

                      <Row>
                        <Label text="Trailing Drawdown Limit">
                          <Input value={a.trailingDrawdownLimit ?? ""} onChange={(e) => updateAccount(a.id, { trailingDrawdownLimit: e.target.value })} placeholder="e.g. 2500" />
                        </Label>
                        <div />
                      </Row>
                    </div>
                  ))
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

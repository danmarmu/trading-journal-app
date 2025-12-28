export function normalizeDB(db: any) {
  const firms = db?.firms ?? [];
  const firmIds = new Set(firms.map((f: any) => f.id));

  const accounts = (db?.accounts ?? [])
    .filter((a: any) => firmIds.has(a.firmId))
    .map((a: any) => ({
      initialBalance: "",
      overallMaxLossLimit: "",
      trailingDrawdownLimit: "",
      ...a,
    }));

  const accountIds = new Set(accounts.map((a: any) => a.id));

  const compliance = (db?.compliance ?? [])
    .filter((c: any) => accountIds.has(c.accountId))
    .map((c: any) => ({
      startingBalance: "",
      endingBalance: "",
      dailyPnL: "",
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
      ...c,
    }));

  const journals = (db?.journals ?? []).map((j: any) => ({
    focus: "",
    hardStopTime: "11:00 AM",
    keyLevels: "",
    newsEvents: "",
    tradingRules: {
      dailyMaxLoss: "",
      allowedSetups: "",
      maxTrades: "",
      maxRiskPerTrade: "",
      ...(j?.tradingRules ?? {}),
    },
    ...j,
  }));

  return { ...db, firms, accounts, journals, compliance };
}

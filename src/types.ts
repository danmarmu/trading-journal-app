export type PropFirm = {
  id: string;
  name: string;
};

export type PropAccountType = "Evaluation" | "Sim Funded" | "Live" | "Personal";

export type PropAccount = {
  id: string;
  firmId: string;

  name: string;
  accountType: PropAccountType;
  platform: string;
  startDate: string;

  initialBalance: string;
  overallMaxLossLimit: string;
  trailingDrawdownLimit: string;
};

export type DailyJournal = {
  id: string;
  date: string;
  focus: string;

  hardStopTime: string;
  keyLevels: string;
  newsEvents: string;

  tradingRules: {
    dailyMaxLoss: string;
    allowedSetups: string;
    maxTrades: string;
    maxRiskPerTrade: string;
  };
};

export type ComplianceLog = {
  id: string;
  accountId: string;
  date: string;

  complianceGrade: "A" | "B" | "C" | "D" | "F";

  startingBalance: string;
  endingBalance: string;

  /** Auto-calculated */
  dailyPnL: string;

  /** NEW: manual override for trailing DD accounts */
  manualDrawdownRemaining: string;

  stayedWithinDailyMaxLoss: boolean;
  stayedWithinTrailingDrawdown: boolean;
  followedPositionSize: boolean;
  followedTradingHours: boolean;
  followedStopRule11: boolean;

  withdrewFunds: boolean;
  withdrawalAmount: string;
  withdrawalNotes: string;

  violations: string;
  notes: string;
};

export type DB = {
  firms: PropFirm[];
  accounts: PropAccount[];
  journals: DailyJournal[];
  compliance: ComplianceLog[];
};

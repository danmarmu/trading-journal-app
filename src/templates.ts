import type { DailyJournal, ComplianceLog, PropAccount } from "./types";

const uuid = () => crypto.randomUUID();

export function newDailyJournal(dateYYYYMMDD: string): DailyJournal {
  return {
    id: uuid(),
    date: dateYYYYMMDD,
    dayOfWeek: "",
    focus: "",

    routine: {
      wakeUp: false,
      hygiene: false,
      workout: false,
      cooldown: false,
      meditate: false,
      marketPrep: false,
    },

    marketBias: "Unsure",
    keyLevels: "",
    newsEvents: "",

    startTime: "09:30",
    hardStopTime: "11:00",
    tradingRules: {
      allowedSetups: "",
      maxTrades: "",
      maxRiskPerTrade: "",
      dailyMaxLoss: "",
    },

    trades: [
      { setup: "", result: "", notes: "" },
      { setup: "", result: "", notes: "" },
      { setup: "", result: "", notes: "" },
    ],

    post: {
      stoppedOnTime: false,
      screenshotsTaken: false,
      loggedTrades: false,

      executionGrade: "A",
      gradeReasoning: "",

      ruleAdherence: "Followed all rules",
      didWell: "",
      improve: "",

      emotionalState: {
        calm: false,
        focused: false,
        impatient: false,
        overconfident: false,
        fearful: false,
        notes: "",
      },
    },

    learning: {
      lessons: "",
      mistakesToEliminate: "",
      skillsToStudy: "",
      notes: "",
    },

    evening: {
      reviewedDay: false,
      plannedTomorrow: false,
      tomorrowsFocus: "",
      prepNotes: "",
    },
  };
}

export function newComplianceLog(account: PropAccount, dateYYYYMMDD: string): ComplianceLog {
  return {
    id: uuid(),
    accountId: account.id,
    date: dateYYYYMMDD,

    startingBalance: "",
    endingBalance: "",
    dailyPnL: "",

    stayedWithinDailyMaxLoss: true,
    stayedWithinTrailingDrawdown: true,
    followedPositionSize: true,
    followedTradingHours: true,
    followedStopRule11: true,

    violations: "",

    trailingDrawdownLevelToday: "",
    distanceFromViolation: "",

    noRevengeTrading: true,
    noOvertrading: true,
    noSizeIncreaseAfterLosses: true,
    onlyAPlusSetups: true,

    emotionalControl: "Good",
    notes: "",

    complianceGrade: "A",
    gradeReasoning: "",

    profitTargetRemaining: "",
    daysTraded: "",
    greenDays: "",
    redDays: "",
    percentMaxLossUsed: "",

    warningTriggers: {
      within20: false,
      within10: false,
      newHighWatermark: false,
      violationRiskElevated: false,
      actionPlan: "",
    },

    accountNotes: "",
  };
}

import React, { createContext, useContext, useMemo, useState } from "react";

export type ActiveRecord = {
  kind:
    | "Journal"
    | "Firm"
    | "Account"
    | "Compliance Log"
    | "Reporting Account"
    | "Reporting Totals"
    | "None";
  id?: string | null;
  label: string;
  route?: string;
};

type CtxValue = {
  active: ActiveRecord;
  setActive: (next: ActiveRecord) => void;
  clearActive: () => void;
};

const Ctx = createContext<CtxValue | null>(null);

const NONE: ActiveRecord = { kind: "None", label: "—" };

export function ActiveRecordProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveRecord>(NONE);

  const value = useMemo(
    () => ({
      active,
      setActive,
      clearActive: () => setActive(NONE),
    }),
    [active]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveRecord() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActiveRecord must be used inside ActiveRecordProvider");
  return v;
}

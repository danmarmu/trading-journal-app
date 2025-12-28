import React, { createContext, useContext, useMemo, useState } from "react";
import { loadDB, saveDB } from "../storage";
import { normalizeDB } from "./normalize";
import type { DB } from "../types";

type DBContextValue = {
  db: DB;
  commit: (updater: (prev: DB) => DB) => void;
  reload: () => void;
};

const Ctx = createContext<DBContextValue | null>(null);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(() => normalizeDB(loadDB()) as DB);

  function commit(updater: (prev: DB) => DB) {
    setDb((prev) => {
      const next = normalizeDB(updater(prev)) as DB;
      saveDB(next);
      return next;
    });
  }

  function reload() {
    const next = normalizeDB(loadDB()) as DB;
    setDb(next);
    saveDB(next);
  }

  const value = useMemo(() => ({ db, commit, reload }), [db]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDB() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDB must be used inside DBProvider");
  return v;
}

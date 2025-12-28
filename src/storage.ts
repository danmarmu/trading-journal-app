import type { DB } from "./types";

const KEY = "trading_journal_db_v1";

export const defaultDB: DB = {
  firms: [],
  accounts: [],
  journals: [],
  compliance: [],
};

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultDB;
    return JSON.parse(raw);
  } catch {
    return defaultDB;
  }
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function exportDB(): string {
  return localStorage.getItem(KEY) ?? JSON.stringify(defaultDB, null, 2);
}

export function importDB(text: string) {
  localStorage.setItem(KEY, text);
}

export function resetDB() {
  localStorage.setItem(KEY, JSON.stringify(defaultDB));
}

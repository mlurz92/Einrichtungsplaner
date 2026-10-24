// „Zuletzt verwendet“: Pfade der zuletzt geöffneten/gespeicherten Projektdateien (nur Desktop).
import { useSyncExternalStore } from "react";

const KEY = "we13.recent.v1";
const MAX = 8;

export interface RecentFile {
  path: string;
  name: string;
  at: string;
}

let cache: RecentFile[] = read();
const listeners = new Set<() => void>();

function read(): RecentFile[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => r && typeof r.path === "string") : [];
  } catch {
    return [];
  }
}

function write(list: RecentFile[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignorieren */
  }
  listeners.forEach((l) => l());
}

/** Nur echte Pfade merken (Browser liefert nur Dateinamen). */
export function isPath(p: string) {
  return /[\\/]/.test(p);
}

export function addRecent(path: string, name: string) {
  if (!isPath(path)) return;
  write([{ path, name, at: new Date().toISOString() }, ...cache.filter((r) => r.path.toLowerCase() !== path.toLowerCase())].slice(0, MAX));
}

export function removeRecent(path: string) {
  write(cache.filter((r) => r.path !== path));
}

export function recentFiles() {
  return cache;
}

export function useRecentFiles(): RecentFile[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

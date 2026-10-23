import type { PurchaseStatus } from "../model/types";

export const STATUS_ORDER: PurchaseStatus[] = ["geplant", "bestellt", "geliefert", "aufgebaut"];

export const STATUS_STYLE: Record<PurchaseStatus, { label: string; short: string; cls: string; color: string }> = {
  geplant: { label: "geplant", short: "geplant", cls: "bg-stone-100 text-stone-500 ring-stone-200", color: "#d6d3d1" },
  bestellt: { label: "bestellt", short: "bestellt", cls: "bg-amber-50 text-amber-800 ring-amber-200", color: "#f59e0b" },
  geliefert: { label: "geliefert", short: "geliefert", cls: "bg-sky-50 text-sky-800 ring-sky-200", color: "#0ea5e9" },
  aufgebaut: { label: "aufgebaut", short: "fertig", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", color: "#047857" },
};

export function nextStatus(s: PurchaseStatus): PurchaseStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
}

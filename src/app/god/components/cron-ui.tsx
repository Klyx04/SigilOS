"use client";

import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";

/**
 * Briques partagées par les deux vues de `?tab=cron-status` (vue d'ensemble et journal).
 *
 * Elles vivaient dans `cron-status-panel.tsx` ; le journal les réutilise **telles quelles**
 * pour que le même statut ne s'affiche jamais de deux façons (rouge ici, vert là).
 */

export type CronUiStatus = "success" | "error" | "unknown";

export function StatusBadge({ status }: { status: CronUiStatus }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3" /> OK
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
      <XCircle className="w-3 h-3" /> Erreur
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
      <HelpCircle className="w-3 h-3" /> Inconnu
    </span>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `il y a ${d}j ${h % 24}h`;
  if (h > 0) return `il y a ${h}h ${min % 60}min`;
  if (min > 0) return `il y a ${min} min`;
  return "à l'instant";
}

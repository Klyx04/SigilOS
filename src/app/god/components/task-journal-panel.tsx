"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  History,
  RefreshCw,
  Search,
  Terminal,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StatusBadge, formatDuration, formatRelativeTime } from "./cron-ui";
import {
  cronJournalDetailRows,
  groupCronJournalByDay,
  type CronJournalEntry,
} from "@/lib/cron-journal";

/**
 * Onglet **Journal** de `?tab=cron-status` (lot C2).
 *
 * Lit `/api/god/task-journal` (Redis, 10 dernières exécutions par tâche, TTL 7 j) et
 * affiche **toutes** les entrées reçues : filtres côté serveur (une seule règle de
 * filtrage, `src/lib/cron-journal.ts`), détail complet au clic (résumé, métriques,
 * lignes de log). Un journal vide **parce que Redis est muet** est annoncé comme tel —
 * jamais confondu avec « aucune exécution ».
 */

type JournalFacets = {
  total: number;
  success: number;
  error: number;
  tasks: { cronId: string; name: string; count: number }[];
};

type JournalData = {
  entries: CronJournalEntry[];
  facets: JournalFacets;
  redisOk: boolean;
  window: { perTask: number; ttlDays: number };
  generatedAt: string;
};

function formatJournalDay(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function formatJournalTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function TaskJournalPanel() {
  const [data, setData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CronJournalEntry | null>(null);

  const [taskFilter, setTaskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
  const [periodFilter, setPeriodFilter] = useState<"24h" | "7d" | "all">("7d");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          task: taskFilter,
          status: statusFilter,
          period: periodFilter,
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        const res = await fetch(`/api/god/task-journal?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as JournalData;
        setData(json);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [taskFilter, statusFilter, periodFilter, debouncedSearch],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Journal des exécutions
          </h2>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${data.window.perTask} dernières exécutions par tâche · rétention ${data.window.ttlDays} jours · horodatage UTC`
              : "Chargement…"}
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} /> Actualiser
        </button>
      </div>

      {data && !data.redisOk && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200 leading-relaxed">
            <strong>Redis indisponible :</strong> ce journal est vide parce qu&apos;il n&apos;a pas pu être lu,
            pas parce que les tâches n&apos;ont pas tourné. Réessayer dans un instant.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-surface/50 border border-border rounded-2xl">
        <div className="flex items-center gap-2 mr-1 border-r border-border pr-3">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-caption font-bold text-muted-foreground uppercase tracking-wider">Filtres</span>
        </div>

        <select
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
          className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer max-w-[280px]"
        >
          <option value="all">Toutes les tâches{data ? ` (${data.facets.total})` : ""}</option>
          {(data?.facets.tasks ?? []).map((task) => (
            <option key={task.cronId} value={task.cronId}>{task.name} ({task.count})</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "success" | "error")}
          className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer"
        >
          <option value="all">Tous les statuts</option>
          <option value="success">Succès</option>
          <option value="error">Erreurs</option>
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as "24h" | "7d" | "all")}
          className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer"
        >
          <option value="24h">Dernières 24 h</option>
          <option value="7d">7 derniers jours</option>
          <option value="all">Tout l&apos;historique</option>
        </select>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (tâche, résumé, détail)…"
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs text-red-300">Impossible de lire le journal ({error}).</p>
          <button onClick={() => void load(true)} className="ml-auto text-xs text-primary hover:underline">Réessayer</button>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 rounded-xl bg-surface border border-border" />
          ))}
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="py-14 text-center space-y-2 bg-surface/30 border border-dashed border-border rounded-2xl">
          <History className="w-6 h-6 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {data && data.facets.total > 0
              ? "Aucune exécution ne correspond aux filtres."
              : "Aucune exécution enregistrée sur la fenêtre de rétention."}
          </p>
          <p className="text-xs text-muted-foreground">
            {data && data.facets.total > 0
              ? `${data.facets.total} exécution(s) existent — élargir la période ou vider la recherche.`
              : "Le journal se remplit à chaque passage d'un cron (10 dernières exécutions par tâche)."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupCronJournalByDay(data.entries).map((day) => (
            <section key={day.day} className="space-y-2">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                {formatJournalDay(day.day)} · {day.entries.length} exécution(s)
              </h3>
              <ul className="space-y-1.5">
                {day.entries.map((entry) => (
                  <li key={`${entry.cronId}-${entry.lastRun}`}>
                    <button
                      onClick={() => setSelected(entry)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                        entry.status === "error"
                          ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                          : "border-border bg-surface hover:bg-muted/30",
                      )}
                      aria-haspopup="dialog"
                    >
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                        {formatJournalTime(entry.lastRun)}
                      </span>
                      <StatusBadge status={entry.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground truncate">{entry.name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {entry.summary ?? "Aucun résumé"}
                        </span>
                      </span>
                      {entry.durationMs ? (
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                          {formatDuration(entry.durationMs)}
                        </span>
                      ) : null}
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <JournalEntryDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function JournalEntryDialog({ entry, onClose }: { entry: CronJournalEntry | null; onClose: () => void }) {
  const detail = entry ? cronJournalDetailRows(entry.details) : { rows: [], hidden: 0 };

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {entry.name} <StatusBadge status={entry.status} />
              </DialogTitle>
              <DialogDescription>
                {formatRelativeTime(entry.lastRun)} · {formatJournalTime(entry.lastRun)} UTC · {entry.schedule}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Résumé</p>
                <p className="text-sm text-foreground whitespace-pre-line break-words">{entry.summary ?? "—"}</p>
              </div>

              {detail.rows.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Détails</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detail.rows.map((row, index) => (
                      <div key={`${row.label}-${index}`} className="rounded-lg bg-surface border border-border px-2.5 py-2 min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground break-words">{row.label}</p>
                        <p className="text-xs font-mono text-foreground whitespace-pre-line break-words">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  {detail.hidden > 0 && (
                    <p className="text-[11px] text-amber-300 mt-1">
                      {detail.hidden} détail(s) non affichés (plafond d&apos;affichage).
                    </p>
                  )}
                </div>
              )}

              {entry.lines.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" /> Lignes
                  </p>
                  <pre className="text-xs font-mono bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {entry.lines.join("\n")}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors">
                Fermer
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}


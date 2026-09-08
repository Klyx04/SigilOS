"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  ChevronRight,
  HardDrive,
  Terminal,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface HistoryEntry {
  id: string;
  name: string;
  lastRun: string | null;
  durationMs: number | null;
  status: "success" | "error" | "unknown";
  summary: string | null;
  details?: Record<string, any> | null;
  lines?: string[];
}

interface CronTask {
  id: string;
  name: string;
  schedule: string;
  logFile: string;
  lastRun: string | null;
  durationMs?: number | null;
  sizeBytes: number;
  status: "success" | "error" | "unknown";
  details?: Record<string, any> | null;
  summary?: string | null;
  lastLines: string[];
  history?: HistoryEntry[];
}

interface CronStatusData {
  tasks: CronTask[];
  summary: { total: number; success: number; error: number; unknown: number };
  logDir: string;
  generatedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(iso: string | null): string {
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

function StatusBadge({ status }: { status: CronTask["status"] | HistoryEntry["status"] }) {
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

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface border border-border px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground tabular-nums truncate">{value}</p>
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: CronTask; onOpen: (task: CronTask) => void }) {
  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200",
      task.status === "error"
        ? "border-red-500/30 bg-red-500/5"
        : task.status === "success"
        ? "border-border bg-surface"
        : "border-border bg-surface opacity-70"
    )}>
      <button
        onClick={() => onOpen(task)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
        aria-haspopup="dialog"
      >
        <span className="shrink-0 text-muted-foreground">
          <ChevronRight className="w-4 h-4" />
        </span>

        <StatusBadge status={task.status} />

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="font-medium text-sm text-foreground truncate">{task.name}</span>
          {task.summary && (
            <span className="text-xs text-muted-foreground truncate max-w-sm hidden lg:inline font-mono">
              — {task.summary}
            </span>
          )}
        </div>

        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" /> {task.schedule}
        </span>

        {task.durationMs ? (
          <span className="hidden md:inline px-1.5 py-0.5 rounded bg-surface border border-border text-caption font-mono text-muted-foreground">
            {formatDuration(task.durationMs)}
          </span>
        ) : null}

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(task.lastRun)}
        </span>

        {task.sizeBytes > 0 && (
          <span className="hidden md:block text-xs text-muted-foreground/60">
            {formatBytes(task.sizeBytes)}
          </span>
        )}
      </button>
    </div>
  );
}

function CronDetailModal({ task, onClose }: { task: CronTask | null; onClose: () => void }) {
  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <StatusBadge status={task.status} />
                <span className="truncate">{task.name}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1"><Terminal className="w-3 h-3" /> <code className="font-mono">{task.logFile}</code></span>
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {task.schedule}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaCell label="Dernière exécution" value={formatRelativeTime(task.lastRun)} />
              <MetaCell label="Durée" value={task.durationMs ? formatDuration(task.durationMs) : "—"} />
              <MetaCell label="Taille log" value={task.sizeBytes > 0 ? formatBytes(task.sizeBytes) : "—"} />
              <MetaCell label="Dernier run (précis)" value={task.lastRun ? new Date(task.lastRun).toLocaleString("fr-FR") : "—"} />
            </div>

            {task.summary && (
              <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-foreground font-medium">
                💡 <strong>Détail :</strong> {task.summary}
              </div>
            )}

            {task.details && Object.keys(task.details).length > 0 && (
              <div className="rounded-lg bg-surface border border-border p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Résumé de la dernière exécution</p>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(task.details).map(([k, v]) => (
                    <div key={k} className="rounded-md bg-elevated/60 border border-border px-2 py-1.5">
                      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                      <dd className="text-sm font-bold text-foreground tabular-nums">{String(v ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {task.history && task.history.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-3 h-3" /> Historique des exécutions ({task.history.length})
                </p>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {task.history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface/60 border border-border text-xs">
                      <StatusBadge status={h.status} />
                      <span className="flex-1 truncate text-muted-foreground">{h.summary || h.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{formatRelativeTime(h.lastRun)}</span>
                      {h.durationMs ? <span className="text-muted-foreground font-mono w-14 text-right">{formatDuration(h.durationMs)}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {task.lastLines.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Dernières lignes du log
                </p>
                <pre className="text-xs font-mono bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto text-muted-foreground leading-relaxed">
                  {task.lastLines.join("\n")}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic px-1">Aucun log trouvé pour ce fichier.</p>
            )}

            <DialogFooter>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors">Fermer</button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CronStatusPanel() {
  const [data, setData] = useState<CronStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<CronTask | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/god/cron-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-surface border border-border" />
      ))}
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <XCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm font-medium text-foreground">Impossible de charger les statuts</p>
      <p className="text-xs text-muted-foreground">{error}</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary hover:underline">Réessayer</button>
    </div>
  );

  if (!data) return null;

  const errorTasks = data.tasks.filter(t => t.status === "error");

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
            errorTasks.length > 0
              ? "bg-red-500/15 text-red-400 border border-red-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          )}>
            {errorTasks.length > 0
              ? <><XCircle className="w-3.5 h-3.5" /> {errorTasks.length} tâche(s) en erreur</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> Toutes les tâches OK</>
            }
          </div>
          <span className="text-xs text-muted-foreground">
            {data.summary.success}/{data.summary.total} OK · {data.summary.unknown} inconnu(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Màj {new Date(data.generatedAt).toLocaleTimeString("fr-FR")}
          </span>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Alerte erreurs en haut */}
      {errorTasks.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Tâches en erreur</p>
          <ul className="text-xs text-red-300/80 space-y-0.5">
            {errorTasks.map(t => <li key={t.id}>• {t.name} — {t.logFile}</li>)}
          </ul>
        </div>
      )}

      {/* Liste des tâches — erreurs en premier */}
      <div className="space-y-2">
        {[
          ...data.tasks.filter(t => t.status === "error"),
          ...data.tasks.filter(t => t.status === "unknown"),
          ...data.tasks.filter(t => t.status === "success"),
        ].map(task => <TaskRow key={task.id} task={task} onOpen={setSelected} />)}
      </div>

      {/* Footer — chemin des logs */}
      <div className="flex items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground/60">
        <HardDrive className="w-3.5 h-3.5" />
        <code className="font-mono">{data.logDir}</code>
      </div>

      <CronDetailModal task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

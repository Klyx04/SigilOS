"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CronTask {
  id: string;
  name: string;
  schedule: string;
  logFile: string;
  lastRun: string | null;
  durationMs?: number | null;
  sizeBytes: number;
  status: "success" | "error" | "unknown";
  summary?: string | null;
  lastLines: string[];
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

function StatusBadge({ status }: { status: CronTask["status"] }) {
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

function TaskRow({ task }: { task: CronTask }) {
  const [expanded, setExpanded] = useState(false);

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
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
        aria-expanded={expanded}
      >
        <span className="shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
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

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
            <Terminal className="w-3 h-3" />
            <code className="font-mono">{task.logFile}</code>
            {task.durationMs && (
              <span className="font-mono opacity-80">({formatDuration(task.durationMs)})</span>
            )}
            {task.lastRun && (
              <span className="ml-auto opacity-60">{new Date(task.lastRun).toLocaleString("fr-FR")}</span>
            )}
          </div>
          {task.summary && (
            <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-foreground font-medium">
              💡 <strong>Détail :</strong> {task.summary}
            </div>
          )}
          {task.lastLines.length > 0 ? (
            <pre className="text-xs font-mono bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto text-muted-foreground leading-relaxed">
              {task.lastLines.join("\n")}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground italic px-1">Aucun log trouvé pour ce fichier.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CronStatusPanel() {
  const [data, setData] = useState<CronStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        ].map(task => <TaskRow key={task.id} task={task} />)}
      </div>

      {/* Footer — chemin des logs */}
      <div className="flex items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground/60">
        <HardDrive className="w-3.5 h-3.5" />
        <code className="font-mono">{data.logDir}</code>
      </div>
    </div>
  );
}

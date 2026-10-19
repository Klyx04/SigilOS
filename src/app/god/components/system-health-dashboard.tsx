"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Activity,
    AlertTriangle,
    Clock,
    Cpu,
    Database,
    HardDrive,
    MemoryStick,
    RefreshCw,
    Server,
    ShieldCheck,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getInternalSystemStatus } from "@/server/actions/god-system-actions";
import { cn } from "@/lib/utils";
import { GodPanel } from "@/app/god/ui";

type QueueStats = { waiting: number; active: number; failed: number };
type CronStatus = "success" | "error" | "unknown";

type CronRow = {
    id: string;
    name: string;
    schedule: string;
    lastRun: string | null;
    durationMs: number | null;
    status: CronStatus;
    summary: string | null;
};

type SystemStatus = {
    database: { status: string; latency: number; insights?: { auditLogs: number; profiles: number; missions: number } };
    cache: { status: string; latency: number };
    backup: { status: string; lastAt: string | Date | null };
    worker: { status: string; lastAt: string | Date | null; queues?: { metamob: QueueStats; ladder: QueueStats } };
    maintenance: { status: string; lastAt: string | Date | null; metrics?: unknown };
    disk?: { totalMb: number; freeMb: number; usagePercent: number };
    ram?: { totalMb: number; freeMb: number; usagePercent: number };
    cpu?: { load1: number; cores: number; usagePercent: number | null };
    redisDetails?: { usedMemoryMb: number | null; maxMemoryMb: number | null; evictedKeys: number; connectedClients: number; hitRatePercent: number | null } | null;
    prometheus?: {
        ok: boolean;
        error: string | null;
        containers: number | null;
        restarts: number | null;
        pgConnections: number | null;
        pgSizeMb: number | null;
        uptimeDays: number | null;
        targetsUp: number | null;
        targetsTotal: number | null;
        cpuUsagePercent: number | null;
        ramUsagePercent: number | null;
        diskUsagePercent: number | null;
        diskFreeMb: number | null;
        diskTotalMb: number | null;
    };
    crons?: CronRow[];
    version?: string;
    environment?: string;
    generatedAt?: string;
};

type Tone = "success" | "warning" | "danger" | "muted";

const TONE_TEXT: Record<Tone, string> = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    muted: "text-foreground",
};

const TONE_BG: Record<Tone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    muted: "bg-muted-foreground",
};

const TONE_SOFT: Record<Tone, string> = {
    success: "border-success/25 bg-success/10 text-success",
    warning: "border-warning/25 bg-warning/10 text-warning",
    danger: "border-danger/25 bg-danger/10 text-danger",
    muted: "border-border bg-muted text-muted-foreground",
};

const nf = new Intl.NumberFormat("fr-FR");

function formatRelative(value: string | Date | null | undefined): string {
    if (!value) return "Jamais";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
}

function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatGo(mb: number | null | undefined): string {
    if (mb === null || mb === undefined) return "—";
    return `${(mb / 1024).toFixed(1)} Go`;
}

function clampPercent(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function toneForPercent(value: number | null): Tone {
    if (value === null) return "muted";
    if (value >= 90) return "danger";
    if (value >= 75) return "warning";
    return "success";
}

function toneForState(state: string): Tone {
    const normalized = state.toUpperCase();
    if (["ONLINE", "SUCCESS", "IDLE"].includes(normalized)) return "success";
    if (["OFFLINE", "FAILED", "ERROR"].includes(normalized)) return "danger";
    return "warning";
}

function stateLabel(state: string): string {
    const normalized = state.toUpperCase();
    if (normalized === "ONLINE") return "En ligne";
    if (normalized === "OFFLINE") return "Hors ligne";
    if (normalized === "SUCCESS") return "Succès";
    if (normalized === "FAILED") return "Échec";
    if (normalized === "IDLE") return "Inactif";
    if (normalized === "ERROR") return "Erreur";
    return "Inconnu";
}

function StatusPill({ state }: { state: string }) {
    const tone = toneForState(state);
    return (
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", TONE_SOFT[tone])}>
            <span className={cn("h-1.5 w-1.5 rounded-full", TONE_BG[tone])} aria-hidden />
            {stateLabel(state)}
        </span>
    );
}

function MetricCard({ icon: Icon, label, value, hint, percent, tone, badge }: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint?: string;
    percent?: number | null;
    tone?: Tone;
    badge?: string;
}) {
    const resolvedTone = tone ?? "muted";
    const safePercent = percent ?? null;

    return (
        <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                {badge ? (
                    <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium", TONE_SOFT[resolvedTone])}>
                        {badge}
                    </span>
                ) : null}
            </div>
            <p className={cn("mt-3 text-2xl font-semibold tabular-nums tracking-tight", TONE_TEXT[resolvedTone])}>{value}</p>
            {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
            {safePercent !== null ? (
                <div
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${label} : ${safePercent} %`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={safePercent}
                >
                    <div className={cn("h-full rounded-full transition-[width] duration-500", TONE_BG[resolvedTone])} style={{ width: `${safePercent}%` }} />
                </div>
            ) : null}
        </div>
    );
}

function Panel({ title, description, action, children }: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}
export function SystemHealthDashboard() {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
        if (mode === "initial") setLoading(true);
        else setRefreshing(true);
        setError(null);
        try {
            const result = await getInternalSystemStatus();
            if (!result) {
                setError("Accès refusé ou données indisponibles.");
            } else {
                setStatus(result as SystemStatus);
            }
        } catch {
            setError("Impossible de lire l'état du système.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load("initial");
        const interval = setInterval(() => void load("refresh"), 30_000);
        return () => clearInterval(interval);
    }, [load]);

    const cpuPercent = clampPercent(status?.cpu?.usagePercent);
    const ramPercent = clampPercent(status?.prometheus?.ramUsagePercent ?? status?.ram?.usagePercent);
    const diskPercent = clampPercent(status?.prometheus?.diskUsagePercent ?? status?.disk?.usagePercent);
    const diskFreeMb = status?.prometheus?.diskFreeMb ?? status?.disk?.freeMb;
    const diskTotalMb = status?.prometheus?.diskTotalMb ?? status?.disk?.totalMb;
    const totalWaiting = (status?.worker.queues?.metamob.waiting ?? 0) + (status?.worker.queues?.ladder.waiting ?? 0);
    const totalFailed = (status?.worker.queues?.metamob.failed ?? 0) + (status?.worker.queues?.ladder.failed ?? 0);

    const crons = useMemo(() => {
        const rows = status?.crons ?? [];
        return [...rows]
            .sort((a, b) => {
                const rank = (value: CronStatus) => (value === "error" ? 0 : value === "unknown" ? 1 : 2);
                const byStatus = rank(a.status) - rank(b.status);
                if (byStatus !== 0) return byStatus;
                return new Date(b.lastRun ?? 0).getTime() - new Date(a.lastRun ?? 0).getTime();
            })
            .slice(0, 8);
    }, [status?.crons]);

    return (
        <GodPanel>
        <section className="space-y-4" aria-label="Santé du système">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" aria-hidden />
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">Santé du système</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Prometheus interne, métriques live et tâches planifiées. Aucune exposition publique.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                        {status?.generatedAt ? `Actualisé ${formatRelative(status.generatedAt)}` : "Chargement…"}
                    </p>
                    <button
                        type="button"
                        onClick={() => void load("refresh")}
                        disabled={refreshing}
                        aria-label="Rafraîchir les métriques"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
                        Rafraîchir
                    </button>
                </div>
            </div>

            {loading && !status ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-surface" />
                    ))}
                </div>
            ) : null}

            {error && !status ? (
                <div className="rounded-xl border border-danger/25 bg-danger/10 p-5 text-sm text-danger" role="alert">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <div className="space-y-2">
                            <p className="font-medium">Diagnostic indisponible</p>
                            <p className="text-danger/90">{error}</p>
                            <button type="button" onClick={() => void load("initial")} className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-danger/10">
                                Réessayer
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {status ? (
                <>
                    {status.prometheus && !status.prometheus.ok ? (
                        <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning" role="status">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                            <p>
                                Prometheus indisponible{status.prometheus.error ? ` (${status.prometheus.error})` : ""} — les métriques live (RAM, disque, Redis, crons) restent affichées.
                            </p>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={Cpu} label="Processeur" value={cpuPercent !== null ? `${cpuPercent} %` : status.cpu ? `${status.cpu.load1.toFixed(2)}` : "—"} hint={status.cpu ? `Charge 1 min · ${status.cpu.cores} cœurs` : "Métrique indisponible"} percent={cpuPercent} tone={toneForPercent(cpuPercent)} badge={status.cpu ? "Live" : "—"} />
                        <MetricCard icon={MemoryStick} label="Mémoire" value={ramPercent !== null ? `${ramPercent} %` : "—"} hint={status.ram ? `${formatGo(status.ram.freeMb)} libres / ${formatGo(status.ram.totalMb)}` : "Métrique indisponible"} percent={ramPercent} tone={toneForPercent(ramPercent)} badge={status.prometheus?.ramUsagePercent != null ? "Hôte" : status.ram ? "Live" : "—"} />
                        <MetricCard icon={HardDrive} label="Disque" value={diskPercent !== null ? `${diskPercent} %` : "—"} hint={diskFreeMb != null && diskTotalMb != null ? `${formatGo(diskFreeMb)} libres / ${formatGo(diskTotalMb)}` : "Métrique indisponible"} percent={diskPercent} tone={toneForPercent(diskPercent)} badge={diskPercent !== null && diskPercent >= 90 ? "Critique" : status.prometheus?.diskUsagePercent != null ? "Hôte" : "Live"} />
                        <MetricCard icon={Database} label="PostgreSQL" value={`${nf.format(status.database.latency)} ms`} hint={status.database.status === "ONLINE" ? "Connexion applicative" : "Base indisponible"} tone={toneForState(status.database.status)} badge={stateLabel(status.database.status)} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={Zap} label="Redis" value={status.redisDetails?.usedMemoryMb != null ? `${nf.format(status.redisDetails.usedMemoryMb)} Mo` : `${nf.format(status.cache.latency)} ms`} hint={status.redisDetails ? `${nf.format(status.redisDetails.connectedClients)} clients · ${nf.format(status.redisDetails.evictedKeys)} évictions` : "Détails indisponibles"} tone={toneForState(status.cache.status)} badge={stateLabel(status.cache.status)} />
                        <MetricCard icon={Server} label="Conteneurs" value={status.prometheus?.containers != null ? nf.format(status.prometheus.containers) : "—"} hint={status.prometheus?.restarts != null ? `${nf.format(status.prometheus.restarts)} redémarrage(s) sur 1 h` : "Prometheus indisponible"} tone={status.prometheus?.ok ? "success" : "warning"} badge={status.prometheus?.ok ? "Prometheus" : "—"} />
                        <MetricCard icon={ShieldCheck} label="Sauvegarde" value={formatRelative(status.backup.lastAt)} hint={status.backup.status === "SUCCESS" ? "Dernière sauvegarde confirmée" : status.backup.status === "FAILED" ? "La dernière sauvegarde a échoué" : "Aucune sauvegarde enregistrée"} tone={toneForState(status.backup.status)} badge={stateLabel(status.backup.status)} />
                        <MetricCard icon={Clock} label="Files d'attente" value={nf.format(totalWaiting)} hint={`${nf.format(totalFailed)} échec(s) · worker ${stateLabel(status.worker.status).toLowerCase()}`} tone={totalFailed > 0 ? "danger" : totalWaiting > 0 ? "warning" : "success"} badge={totalFailed > 0 ? "À vérifier" : "OK"} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <Panel title="Services" description="État des dépendances applicatives.">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <caption className="sr-only">État des services</caption>
                                    <thead>
                                        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                            <th scope="col" className="py-2 pr-3 font-medium">Service</th>
                                            <th scope="col" className="py-2 pr-3 font-medium">État</th>
                                            <th scope="col" className="py-2 font-medium">Détail</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <ServiceRow name="PostgreSQL" state={status.database.status} detail={`${nf.format(status.database.latency)} ms${status.database.insights ? ` · ${nf.format(status.database.insights.profiles)} profils` : ""}`} />
                                        <ServiceRow name="Redis" state={status.cache.status} detail={`${nf.format(status.cache.latency)} ms${status.redisDetails?.hitRatePercent != null ? ` · ${status.redisDetails.hitRatePercent} % hit` : ""}`} />
                                        <ServiceRow name="Worker" state={status.worker.status} detail={`${nf.format(status.worker.queues?.metamob.waiting ?? 0)} en attente · ${nf.format(status.worker.queues?.ladder.waiting ?? 0)} ladder`} />
                                        <ServiceRow name="Sauvegarde" state={status.backup.status} detail={formatRelative(status.backup.lastAt)} />
                                        <ServiceRow name="Maintenance" state={status.maintenance.status} detail={formatRelative(status.maintenance.lastAt)} />
                                        <ServiceRow name="Prometheus" state={status.prometheus?.ok ? "ONLINE" : "OFFLINE"} detail={status.prometheus?.targetsTotal != null ? `${nf.format(status.prometheus.targetsUp ?? 0)} / ${nf.format(status.prometheus.targetsTotal)} cibles` : "Interne"} />
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        <Panel title="Base de données" description="Volumétrie et connexions.">
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                                <div><dt className="text-xs text-muted-foreground">Taille</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{status.prometheus?.pgSizeMb != null ? `${nf.format(status.prometheus.pgSizeMb)} Mo` : "—"}</dd></div>
                                <div><dt className="text-xs text-muted-foreground">Connexions</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{status.prometheus?.pgConnections != null ? nf.format(status.prometheus.pgConnections) : "—"}</dd></div>
                                <div><dt className="text-xs text-muted-foreground">Audit</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{status.database.insights ? nf.format(status.database.insights.auditLogs) : "—"}</dd></div>
                                <div><dt className="text-xs text-muted-foreground">Missions</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{status.database.insights ? nf.format(status.database.insights.missions) : "—"}</dd></div>
                            </dl>
                            <p className="mt-4 text-xs text-muted-foreground">{status.prometheus?.uptimeDays != null ? `Serveur démarré depuis ${status.prometheus.uptimeDays} jour(s).` : "Uptime indisponible."}</p>
                        </Panel>

                        <Panel title="Tâches planifiées" description="Les 8 tâches les plus critiques (erreurs d'abord)." action={<a href="?tab=cron-status" className="text-xs font-medium text-primary hover:underline">Tout voir</a>}>
                            {crons.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aucune tâche enregistrée.</p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {crons.map((cron) => (
                                        <li key={cron.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">{cron.name}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{cron.schedule} · {formatRelative(cron.lastRun)}</p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <StatusPill state={cron.status === "success" ? "SUCCESS" : cron.status === "error" ? "FAILED" : "N/A"} />
                                                <span className="text-[11px] tabular-nums text-muted-foreground">{formatDuration(cron.durationMs)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Version {status.version ?? "inconnue"} · {status.environment ?? "environnement inconnu"} · lecture seule · actualisation toutes les 30 s.
                    </p>
                </>
            ) : null}
        </section>
        </GodPanel>
    );
}

function ServiceRow({ name, state, detail }: { name: string; state: string; detail: string }) {
    return (
        <tr className="border-b border-border/60 last:border-0">
            <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">{name}</th>
            <td className="py-2 pr-3"><StatusPill state={state} /></td>
            <td className="py-2 text-xs text-muted-foreground">{detail}</td>
        </tr>
    );
}

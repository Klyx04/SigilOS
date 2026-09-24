"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
    Activity, AlertTriangle, CheckCircle2, HelpCircle, Loader2,
    RefreshCw, ShieldAlert, XCircle, Hash, ChevronRight,
    ListChecks, Sparkles, Clock, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditReport, AuditFinding, AuditStatus, ChannelSuggestion } from "@/server/actions/discord-guild-audit-actions";
import { runDiscordGuildAudit } from "@/server/actions/discord-guild-audit-actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 30_000;

// ─── Export rapport ───────────────────────────────────────────────────────────

function formatReportAsText(report: AuditReport): string {
    const date = new Date(report.generatedAt).toLocaleString("fr-FR", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const lines: string[] = [
        `=== Diagnostic Discord — ${report.guildName} ===`,
        `Date : ${date}`,
        "",
    ];

    const STATUS_LABELS: Record<AuditStatus, string> = {
        operational: "✅",
        warning: "⚠️",
        blocked: "❌",
        unknown: "❓",
        not_applicable: "—",
    };

    const visible = report.findings.filter(f => f.status !== "not_applicable");
    const blocked = visible.filter(f => f.status === "blocked");
    const warnings = visible.filter(f => f.status === "warning" || f.status === "unknown");
    const ok = visible.filter(f => f.status === "operational");

    if (blocked.length > 0) {
        lines.push("── BLOQUÉS ──");
        for (const f of blocked) {
            lines.push(`${STATUS_LABELS[f.status]} ${f.title}`);
            if (f.impact) lines.push(`   Impact : ${f.impact}`);
            if (f.remedy) lines.push(`   Correction : ${f.remedy}`);
            if (f.suggestion) {
                lines.push(`   Salon suggéré : #${f.suggestion.suggestedName} (${f.suggestion.channelType})`);
                f.suggestion.steps.forEach((s, i) => lines.push(`   ${i + 1}. ${s}`));
            }
        }
        lines.push("");
    }

    if (warnings.length > 0) {
        lines.push("── À VÉRIFIER ──");
        for (const f of warnings) {
            lines.push(`${STATUS_LABELS[f.status]} ${f.title}`);
            if (f.impact) lines.push(`   Impact : ${f.impact}`);
            if (f.remedy) lines.push(`   Correction : ${f.remedy}`);
        }
        lines.push("");
    }

    if (ok.length > 0) {
        lines.push("── OPÉRATIONNELS ──");
        for (const f of ok) {
            lines.push(`${STATUS_LABELS[f.status]} ${f.title}${f.technicalDetail ? " — " + f.technicalDetail : ""}`);
        }
        lines.push("");
    }

    lines.push(`Résumé : ${report.summary.blocked} bloqué(s) · ${report.summary.warning} avertissement(s) · ${report.summary.unknown} indéterminé(s) · ${report.summary.operational} OK`);
    return lines.join("\n");
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }> = {
    operational:    { icon: CheckCircle2,  color: "text-success",           bg: "bg-success/5",  border: "border-success/20",  label: "Opérationnel" },
    warning:        { icon: AlertTriangle, color: "text-warning",           bg: "bg-warning/5",  border: "border-warning/30",  label: "À vérifier" },
    blocked:        { icon: XCircle,       color: "text-danger",            bg: "bg-danger/5",   border: "border-danger/30",   label: "Bloqué" },
    unknown:        { icon: HelpCircle,    color: "text-muted-foreground",  bg: "bg-surface/50", border: "border-border",      label: "Indéterminé" },
    not_applicable: { icon: CheckCircle2,  color: "text-muted-foreground/50", bg: "", border: "", label: "Non applicable" },
};

// ─── Setup suggestion card ────────────────────────────────────────────────────

function SetupGuide({ suggestion }: { suggestion: ChannelSuggestion }) {
    const typeLabel: Record<ChannelSuggestion["channelType"], string> = {
        TEXT: "Salon texte",
        ANNOUNCEMENT: "Salon d'annonces",
        FORUM: "Forum",
    };

    return (
        <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <p className="text-xs font-black uppercase tracking-wider text-accent">
                    Guide de configuration
                </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-foreground/80">
                <span className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 font-mono font-bold text-accent">
                    #{suggestion.suggestedName}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{typeLabel[suggestion.channelType]}</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
                {suggestion.purpose}
            </p>

            <ol className="space-y-1.5">
                {suggestion.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] font-black flex items-center justify-center mt-0.5">
                            {i + 1}
                        </span>
                        {step}
                    </li>
                ))}
            </ol>
        </div>
    );
}

// ─── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: AuditFinding }) {
    const cfg = STATUS_CONFIG[finding.status];
    const Icon = cfg.icon;
    if (finding.status === "not_applicable") return null;

    const isOk = finding.status === "operational";
    const isSetup = !isOk && !!finding.suggestion;

    return (
        <div className={cn(
            "rounded-xl border p-4 transition-colors",
            isOk   ? "border-border/50 bg-black/10"
            : isSetup ? `border-accent/20 bg-accent/3`
            : `${cfg.border} ${cfg.bg}`,
        )}>
            <div className="flex items-start gap-2.5">
                {isSetup
                    ? <ListChecks className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                    : <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.color)} />
                }
                <div className="flex-1 min-w-0">
                    {/* Titre */}
                    <p className={cn("text-sm font-bold", isOk ? "text-foreground/80" : "text-foreground")}>
                        {finding.title}
                    </p>

                    {/* Canal vérifié (mode OK) */}
                    {isOk && finding.technicalDetail && (
                        <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
                            {finding.technicalDetail}
                        </p>
                    )}

                    {/* Impact + remedy (mode problème sans suggestion) */}
                    {!isOk && !isSetup && finding.impact && (
                        <p className="text-xs text-muted-foreground mt-1">{finding.impact}</p>
                    )}
                    {!isOk && !isSetup && finding.remedy && (
                        <p className="text-xs text-foreground/80 mt-1.5">
                            <span className="font-semibold">À faire :</span> {finding.remedy}
                        </p>
                    )}

                    {/* Impact seul pour le mode setup */}
                    {isSetup && finding.impact && (
                        <p className="text-xs text-muted-foreground mt-1">{finding.impact}</p>
                    )}

                    {/* Guide de setup */}
                    {isSetup && <SetupGuide suggestion={finding.suggestion!} />}

                    {/* Lien réglages */}
                    {!isOk && finding.settingsHref && (
                        <a
                            href={finding.settingsHref}
                            className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-accent hover:underline"
                        >
                            Ouvrir les réglages <ChevronRight className="w-3 h-3" />
                        </a>
                    )}

                    {/* Détails techniques pour les erreurs sans suggestion */}
                    {!isOk && !isSetup && finding.technicalDetail && (
                        <details className="mt-2">
                            <summary className="text-[11px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground font-mono select-none">
                                détails techniques
                            </summary>
                            <p className="text-[11px] text-muted-foreground/70 font-mono mt-1 break-all leading-relaxed">
                                {finding.technicalDetail}
                            </p>
                        </details>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Module group ─────────────────────────────────────────────────────────────

function ModuleGroup({ moduleName, findings }: { moduleName: string; findings: AuditFinding[] }) {
    const visibleFindings = findings.filter(f => f.status !== "not_applicable");
    if (visibleFindings.length === 0) return null;

    const hasBlocked = visibleFindings.some(f => f.status === "blocked");
    const hasWarning = visibleFindings.some(f => f.status === "warning");
    const hasSetup = visibleFindings.some(f => f.suggestion);
    const allOk = visibleFindings.every(f => f.status === "operational");

    const worstStatus: AuditStatus = hasBlocked ? "blocked" : hasWarning ? "warning" : allOk ? "operational" : "unknown";
    const worstCfg = STATUS_CONFIG[worstStatus];
    const ModuleIcon = hasSetup ? ListChecks : worstCfg.icon;
    const moduleIconColor = hasSetup ? "text-accent" : worstCfg.color;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
                <ModuleIcon className={cn("w-3.5 h-3.5", moduleIconColor)} />
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                    {moduleName}
                </h3>
                {allOk && <span className="text-[10px] font-bold text-success/70 uppercase tracking-wider">— tout OK</span>}
                {hasSetup && !hasBlocked && <span className="text-[10px] font-bold text-accent uppercase tracking-wider">— à configurer</span>}
                {hasBlocked && <span className="text-[10px] font-bold text-danger uppercase tracking-wider">— action requise</span>}
                {hasWarning && !hasBlocked && <span className="text-[10px] font-bold text-warning uppercase tracking-wider">— à vérifier</span>}
            </div>
            <div className="space-y-1.5 pl-1">
                {visibleFindings.map((f, i) => (
                    <FindingCard key={`${f.capabilityId}-${i}`} finding={f} />
                ))}
            </div>
        </div>
    );
}

// ─── Copy report button ───────────────────────────────────────────────────────

function CopyReportButton({ report }: { report: AuditReport }) {
    const [copied, setCopied] = useState(false);

    function handleCopy() {
        const text = formatReportAsText(report);
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => { /* clipboard indisponible */ });
    }

    return (
        <button
            onClick={handleCopy}
            title="Copier le rapport"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-black/20 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
        >
            {copied
                ? <><Check className="w-3 h-3 text-success" />Copié</>
                : <><Copy className="w-3 h-3" />Copier</>
            }
        </button>
    );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: AuditReport["summary"] }) {
    const items: { count: number; status: AuditStatus; label: string }[] = [
        { count: summary.blocked, status: "blocked", label: "bloqué" },
        { count: summary.warning, status: "warning", label: "à vérifier" },
        { count: summary.unknown, status: "unknown", label: "indéterminé" },
        { count: summary.operational, status: "operational", label: "OK" },
    ];

    return (
        <div className="flex items-center gap-3 flex-wrap">
            {items.filter(i => i.count > 0).map(item => {
                const cfg = STATUS_CONFIG[item.status];
                const Icon = cfg.icon;
                return (
                    <div key={item.status} className="flex items-center gap-1.5">
                        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                        <span className="text-sm font-black text-foreground">{item.count}</span>
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Rate limit countdown ─────────────────────────────────────────────────────

function useRateLimit() {
    const [lastRun, setLastRun] = useState<number>(0);
    const [remaining, setRemaining] = useState<number>(0);

    useEffect(() => {
        if (lastRun === 0) return;
        const interval = setInterval(() => {
            const rem = Math.max(0, RATE_LIMIT_MS - (Date.now() - lastRun));
            setRemaining(rem);
            if (rem === 0) clearInterval(interval);
        }, 500);
        return () => clearInterval(interval);
    }, [lastRun]);

    const canRun = remaining === 0;
    const markRun = useCallback(() => { setLastRun(Date.now()); setRemaining(RATE_LIMIT_MS); }, []);

    return { canRun, remaining, markRun };
}

// ─── Main component ───────────────────────────────────────────────────────────

const STORAGE_KEY = (guildId: string) => `sigil-discord-audit-${guildId}`;

export function PilotageDiscordDiagnostic({ guildId }: { guildId: string }) {
    const [report, setReport] = useState<AuditReport | null>(null);
    const [isPending, startTransition] = useTransition();
    const { canRun, remaining, markRun } = useRateLimit();

    // Restaurer le dernier rapport depuis localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY(guildId));
            if (stored) {
                const parsed = JSON.parse(stored) as AuditReport;
                setReport(parsed);
            }
        } catch { /* localStorage indisponible — pas bloquant */ }
    }, [guildId]);

    function handleRun() {
        if (!canRun) return;
        markRun();
        startTransition(async () => {
            const result = await runDiscordGuildAudit(guildId);
            setReport(result);
            try { localStorage.setItem(STORAGE_KEY(guildId), JSON.stringify(result)); } catch { /* silent */ }
        });
    }

    // ── État initial (aucun rapport, pas de localStorage) ──
    if (!report && !isPending) {
        return (
            <section className="rounded-2xl border border-border bg-surface p-6 space-y-5">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                        Diagnostic Discord
                    </h2>
                </div>
                <div className="space-y-1.5">
                    <p className="text-sm text-foreground/80 leading-relaxed max-w-prose">
                        Vérifie que le bot SigilOS est bien configuré pour chaque module activé.
                        Détecte les salons manquants, les permissions insuffisantes et les rôles mal hiérarchisés.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                        {[
                            { icon: Hash, label: "Salons Discord" },
                            { icon: ShieldAlert, label: "Permissions" },
                            { icon: ListChecks, label: "Guide de setup" },
                        ].map(({ icon: Icon, label }) => (
                            <span key={label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Icon className="w-3.5 h-3.5 text-accent/60" />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRun}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-black uppercase tracking-wider hover:bg-accent/90 transition-colors"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Lancer le diagnostic
                    </button>
                    <span className="text-[11px] text-muted-foreground/60">
                        Lecture seule — aucune modification sur Discord
                    </span>
                </div>
            </section>
        );
    }

    // ── Loading ──
    if (isPending) {
        return (
            <section className="rounded-2xl border border-border bg-surface p-8 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <p className="text-sm font-bold text-muted-foreground">Interrogation du serveur Discord…</p>
                <p className="text-[11px] text-muted-foreground/60">Salons · Permissions · Rôles · Modules actifs</p>
            </section>
        );
    }

    // ── Erreur globale ──
    if (report && report.globalStatus === "unavailable") {
        return (
            <section className="rounded-2xl border border-danger/30 bg-danger/5 p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-danger" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-danger">Diagnostic impossible</h2>
                </div>
                <p className="text-sm text-foreground">{report.globalError}</p>
                <button
                    onClick={handleRun}
                    disabled={!canRun || isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-surface/80 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                    Réessayer
                </button>
            </section>
        );
    }

    if (!report) return null;

    // ── Grouper par module ──
    const MODULE_MAP: Record<string, string> = {
        "bot": "Bot Discord", "system": "Bot Discord",
        "mission": "Missions", "calendar": "Calendrier",
        "raid": "Calendrier", "songes": "Songes", "ticket": "Tickets",
        "welcome": "Bienvenue", "rr": "Réaction-Rôles", "reaction": "Réaction-Rôles",
        "blacklist": "Blacklist", "market": "Marché", "lifecycle": "Cycle de vie",
        "polls": "Sondages", "guildaton": "Guildaton", "bonus": "Bonus", "relance": "Relance",
    };

    const moduleOrder: string[] = [];
    const moduleMap = new Map<string, AuditFinding[]>();

    for (const f of report.findings) {
        const prefix = f.capabilityId.split("-")[0];
        const moduleName = MODULE_MAP[prefix] ?? "Autre";
        if (!moduleMap.has(moduleName)) { moduleMap.set(moduleName, []); moduleOrder.push(moduleName); }
        moduleMap.get(moduleName)!.push(f);
    }

    // Tri : bloqués → à configurer → warnings → OK
    moduleOrder.sort((a, b) => {
        const score = (findings: AuditFinding[]) => {
            if (findings.some(f => f.status === "blocked" && !f.suggestion)) return 0;
            if (findings.some(f => f.status === "blocked" && f.suggestion)) return 1;
            if (findings.some(f => f.status === "warning")) return 2;
            return 3;
        };
        return score(moduleMap.get(a)!) - score(moduleMap.get(b)!);
    });

    const dateStr = new Date(report.generatedAt).toLocaleString("fr-FR", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const allOk = report.summary.blocked === 0 && report.summary.warning === 0 && report.summary.unknown === 0;
    const setupCount = report.findings.filter(f => f.suggestion).length;

    return (
        <section className="space-y-6">
            {/* En-tête rapport */}
            <div className={cn(
                "rounded-2xl border p-5 space-y-3",
                allOk ? "border-success/20 bg-success/5"
                : report.summary.blocked > 0 ? "border-danger/20 bg-danger/5"
                : "border-warning/20 bg-warning/5",
            )}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            {allOk
                                ? <CheckCircle2 className="w-5 h-5 text-success" />
                                : <AlertTriangle className={cn("w-5 h-5", report.summary.blocked > 0 ? "text-danger" : "text-warning")} />
                            }
                            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                {allOk ? "Tout est opérationnel"
                                : report.summary.blocked > 0 ? `${report.summary.blocked} problème${report.summary.blocked > 1 ? "s" : ""} détecté${report.summary.blocked > 1 ? "s" : ""}`
                                : "Points à vérifier"}
                            </h2>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {report.guildName} — {dateStr}
                        </p>
                        {setupCount > 0 && (
                            <p className="text-xs text-accent mt-1 flex items-center gap-1">
                                <ListChecks className="w-3 h-3" />
                                {setupCount} salon{setupCount > 1 ? "s" : ""} à configurer — guide inclus
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <SummaryBar summary={report.summary} />
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleRun}
                                    disabled={!canRun || isPending}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-black/20 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={cn("w-3 h-3", isPending && "animate-spin")} />
                                    Relancer
                                </button>
                                <CopyReportButton report={report} />
                            </div>
                            {!canRun && (
                                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {Math.ceil(remaining / 1000)}s
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {allOk && (
                    <p className="text-xs text-success/80 leading-relaxed border-t border-success/10 pt-3">
                        Le bot a accès à tous les salons configurés avec les permissions requises.
                        Les rôles sont correctement hiérarchisés. Toutes les fonctionnalités Discord actives devraient fonctionner.
                    </p>
                )}
            </div>

            {/* Modules groupés */}
            <div className="space-y-6">
                {moduleOrder.map(moduleName => (
                    <ModuleGroup key={moduleName} moduleName={moduleName} findings={moduleMap.get(moduleName)!} />
                ))}
            </div>

            {report.findings.length === 0 && (
                <div className="rounded-xl border border-border bg-surface/50 p-6 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Aucune capacité Discord active à vérifier.</p>
                    <p className="text-xs text-muted-foreground/60">Activez des modules dans l&apos;onglet Modules.</p>
                </div>
            )}
        </section>
    );
}

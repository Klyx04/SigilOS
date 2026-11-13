"use client";

import { useEffect, useState, useCallback } from "react";
import {
    getGuildStorageUsage,
    type GuildStorageUsageResponse,
    type StorageBreakdownItem,
    type GuildTranscriptDetail,
} from "@/server/actions/guild-storage-actions";
import {
    HardDrive,
    AlertTriangle,
    FileImage,
    Coins,
    Trophy,
    Image as ImageIcon,
    Building2,
    FileText,
    ExternalLink,
    RefreshCw,
    Clock,
    Lock,
    ShieldCheck,
    Download,
    Eye,
    ChevronDown,
    ChevronUp,
    Inbox,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Compte à rebours temps réel ─────────────────────────────────────────────

function useCountdown(expiresAt: string | null) {
    const getMs = useCallback(() => {
        if (!expiresAt) return 0;
        return Math.max(0, new Date(expiresAt).getTime() - Date.now());
    }, [expiresAt]);

    const [ms, setMs] = useState<number>(getMs);

    useEffect(() => {
        if (!expiresAt) return;
        setMs(getMs());
        const id = setInterval(() => setMs(getMs()), 1000);
        return () => clearInterval(id);
    }, [expiresAt, getMs]);

    if (!expiresAt) return { label: null, urgent: false, expired: false, ms: 0 };

    const expired = ms <= 0;
    const days = Math.floor(ms / (24 * 3600 * 1000));
    const h = Math.floor((ms % (24 * 3600 * 1000)) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);

    let label: string;
    if (expired) {
        label = "EXPIRÉ (NETTOYAGE PROCHE)";
    } else if (days > 0) {
        label = `${days}j ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    } else {
        label = `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    }

    return {
        label,
        urgent: ms < 2 * 3600000 && !expired,
        expired,
        ms,
    };
}

function RealtimeCountdownBadge({
    expiresAt,
    labelPrefix = "SUPPRESSION DANS : ",
}: {
    expiresAt: string | null;
    labelPrefix?: string;
}) {
    const { label, urgent, expired } = useCountdown(expiresAt);

    if (!expiresAt || !label) return null;

    if (expired) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-danger/15 border border-danger/30 text-danger text-[11px] font-mono font-black uppercase">
                <AlertTriangle className="w-3 h-3" />
                {label}
            </span>
        );
    }

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-black uppercase tracking-tight border transition-colors",
                urgent
                    ? "bg-danger/10 border-danger/30 text-danger animate-pulse"
                    : "bg-surface/80 border-border text-foreground"
            )}
        >
            <Clock className={cn("w-3 h-3", urgent ? "text-danger" : "text-amber-400")} />
            <span className="text-muted-foreground">{labelPrefix}</span>
            <span className="font-bold">{label}</span>
        </span>
    );
}

// ─── Configuration visuelle des briques ──────────────────────────────────────

const BRICK_CONFIG = {
    MISSIONS: {
        icon: FileImage,
        color: "text-danger",
        bg: "bg-danger/10",
        border: "border-danger/25",
        accent: "danger",
        href: "/admin/validation",
        actionLabel: "Voir les validations",
        requiredPerm: "canValidateMissions" as const,
        ruleText: "Nettoyage auto 24h après soumission",
    },
    KAMA_LOANS: {
        icon: Coins,
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/25",
        accent: "amber",
        href: "/admin/validation?tab=kamas",
        actionLabel: "Voir les dons & prêts",
        requiredPerm: "canValidateMissions" as const,
        ruleText: "24h (dons non validés) / 7 jours (prêts & coffre)",
    },
    ACHIEVEMENT: {
        icon: Trophy,
        color: "text-sky-400",
        bg: "bg-sky-400/10",
        border: "border-sky-400/25",
        accent: "sky",
        href: "/admin/validation?tab=succes",
        actionLabel: "Valider les succès",
        requiredPerm: "canValidateMissions" as const,
        ruleText: "Nettoyage auto 24h après soumission",
    },
    PRESENTATION: {
        icon: Building2,
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/25",
        accent: "emerald",
        href: "/presentation",
        actionLabel: "Voir la présentation",
        requiredPerm: "canViewPresentation" as const,
        ruleText: "Données permanentes conservées",
    },
    ASSETS: {
        icon: ImageIcon,
        color: "text-cyan-400",
        bg: "bg-cyan-400/10",
        border: "border-cyan-400/25",
        accent: "cyan",
        href: "/presentation",
        actionLabel: "Gérer les visuels",
        requiredPerm: "canViewPresentation" as const,
        ruleText: "Icône, bannière & photo de guilde conservées",
    },
    TRANSCRIPTS: {
        icon: FileText,
        color: "text-indigo-400",
        bg: "bg-indigo-400/10",
        border: "border-indigo-400/25",
        accent: "indigo",
        href: "/tickets?tab=transcripts",
        actionLabel: "Consulter les transcripts",
        requiredPerm: "canManageTickets" as const,
        ruleText: "Rétention souveraine par guilde (7 jours par défaut)",
    },
};

interface GuildStorageSettingsClientProps {
    guildId: string;
}

export function GuildStorageSettingsClient({ guildId }: GuildStorageSettingsClientProps) {
    const [data, setData] = useState<GuildStorageUsageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showTranscriptsTable, setShowTranscriptsTable] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getGuildStorageUsage(guildId);
            if (res.success && res.data) {
                setData(res.data);
            } else {
                setError(res.error || "Impossible de charger le stockage");
            }
        } catch {
            setError("Erreur de connexion au serveur");
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && !data) {
        return (
            <div className="p-12 rounded-3xl border border-border bg-surface/30 backdrop-blur-xl flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Analyse du stockage et des transcripts...
                </p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 rounded-3xl border border-danger/30 bg-danger/5 text-center space-y-4">
                <AlertTriangle className="w-8 h-8 text-danger mx-auto" />
                <p className="text-sm font-bold text-danger">{error || "Erreur inconnue"}</p>
                <Button variant="outline" size="sm" onClick={loadData}>
                    Réessayer
                </Button>
            </div>
        );
    }

    const barColor = data.overLimit
        ? "bg-danger"
        : data.usagePercent > 80
        ? "bg-warning"
        : "bg-emerald-500";

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* ── BANDEAU GLOBAL : JAUGE & RÈGLES ── */}
            <div
                className={cn(
                    "rounded-3xl border p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-xl relative overflow-hidden transition-all",
                    data.overLimit
                        ? "border-danger/30 bg-danger/[0.04]"
                        : "border-border/80 bg-surface/40"
                )}
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div
                            className={cn(
                                "p-3 rounded-2xl border shadow-inner",
                                data.overLimit
                                    ? "bg-danger/10 border-danger/25 text-danger"
                                    : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                            )}
                        >
                            <HardDrive className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-foreground uppercase tracking-widest">
                                    Stockage & Quotas de la guilde
                                </h3>
                                {data.overLimit && (
                                    <span className="inline-flex items-center gap-1 bg-danger/15 border border-danger/30 text-danger text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                                        <AlertTriangle className="w-3 h-3" /> Seuil Dépassé
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                                {data.totalFiles} fichier(s) &amp; archive(s) enregistrés
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            title="Rafraîchir les quotas"
                            className="p-2 rounded-xl bg-surface/70 border border-border text-muted-foreground hover:text-foreground transition-all"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </button>

                        <div className="text-right">
                            <p className="text-2xl font-black text-foreground font-mono tracking-tight leading-none">
                                {formatBytes(data.totalBytes)}{" "}
                                <span className="text-muted-foreground text-sm font-normal">
                                    / {formatBytes(data.limitBytes)}
                                </span>
                            </p>
                            <p
                                className={cn(
                                    "text-caption font-black uppercase tracking-widest mt-1",
                                    data.overLimit ? "text-danger" : "text-muted-foreground"
                                )}
                            >
                                {data.usagePercent}% utilisé
                            </p>
                        </div>
                    </div>
                </div>

                {/* Barre de progression */}
                <div className="space-y-1.5">
                    <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-border/50">
                        <div
                            className={cn("h-full rounded-full transition-all duration-500", barColor)}
                            style={{ width: `${Math.min(100, data.usagePercent)}%` }}
                        />
                    </div>
                </div>

                {/* Nettoyage automatique : légendes de rétention */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/60">
                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mr-1">
                        Règles de purge auto :
                    </span>
                    <span className="text-caption font-medium text-muted-foreground bg-surface/60 border border-border rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        24h — preuves non validées (missions, succès, kamas)
                    </span>
                    <span className="text-caption font-medium text-muted-foreground bg-surface/60 border border-border rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        7 jours — preuves prêts &amp; coffre
                    </span>
                    <span className="text-caption font-medium text-muted-foreground bg-surface/60 border border-border rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        7 jours — rétention transcripts tickets Discord
                    </span>
                    <span className="text-caption font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Conservées — présentation, icône &amp; bannière
                    </span>
                </div>
            </div>

            {/* ── GRILLE DES 6 BLOCS DISTINCTS ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-black text-foreground uppercase tracking-widest">
                            Répartition du Stockage par Brique
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Chaque brique est accessible directement selon vos autorisations de rôle.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.breakdown.map((item) => {
                        const cfg = BRICK_CONFIG[item.key];
                        const Icon = cfg.icon;
                        const hasPermission = Boolean(data.permissions[cfg.requiredPerm]);
                        const targetUrl = `/dashboard/${guildId}${cfg.href}`;

                        return (
                            <div
                                key={item.key}
                                className={cn(
                                    "p-5 rounded-3xl border transition-all flex flex-col justify-between group relative overflow-hidden",
                                    item.bytes > 0 || (item.pendingCount && item.pendingCount > 0)
                                        ? "bg-surface/50 border-border shadow-md hover:border-border-strong hover:bg-surface/70"
                                        : "bg-surface/20 border-border/50 opacity-80"
                                )}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div
                                            className={cn(
                                                "w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105",
                                                cfg.bg,
                                                cfg.color,
                                                cfg.border
                                            )}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>

                                        {/* Badge de droit d'accès */}
                                        {hasPermission ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                                Accès autorisé
                                            </span>
                                        ) : (
                                            <span
                                                title="Vous n'avez pas les droits nécessaires pour accéder à ce module"
                                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/20 border border-border px-2 py-0.5 rounded-lg"
                                            >
                                                <Lock className="w-2.5 h-2.5" /> Verrouillé
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                            {item.label}
                                        </p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <p className="text-2xl font-black text-foreground font-mono tracking-tight">
                                                {formatBytes(item.bytes)}
                                            </p>
                                            <p className="text-caption font-bold text-muted-foreground uppercase">
                                                · {item.files} élément{item.files > 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Compte à rebours temps réel ou statut de conservation */}
                                    <div className="pt-3 border-t border-border/60 space-y-1.5">
                                        {item.isPermanent ? (
                                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                                <span>Conservé de façon permanente</span>
                                            </div>
                                        ) : item.earliestExpiry ? (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    Prochaine suppression auto :
                                                </p>
                                                <RealtimeCountdownBadge expiresAt={item.earliestExpiry} />
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-muted-foreground font-medium">
                                                {cfg.ruleText}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bouton cliquable si autorisé, sinon désactivé */}
                                <div className="mt-5 pt-3 border-t border-border/50">
                                    {hasPermission ? (
                                        <Link
                                            href={targetUrl}
                                            className={cn(
                                                "w-full py-2.5 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between",
                                                "bg-surface/80 hover:bg-surface border border-border hover:border-foreground/20 text-foreground shadow-sm group-hover:bg-amber-500/10 group-hover:border-amber-500/30 group-hover:text-amber-400"
                                            )}
                                        >
                                            <span>{cfg.actionLabel}</span>
                                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                        </Link>
                                    ) : (
                                        <div
                                            className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold text-muted-foreground/60 bg-muted/10 border border-border/40 flex items-center justify-between cursor-not-allowed select-none"
                                            title="Droits insuffisants pour accéder à cette page"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Lock className="w-3 h-3 text-muted-foreground/40" />
                                                Accès restreint
                                            </span>
                                            <span className="text-[10px] uppercase font-mono tracking-wider">
                                                Non cliquable
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SECTION DÉTAILLÉE : TRANSCRIPTS TICKETS DISCORD DE LA GUILDE ── */}
            <div className="rounded-3xl border border-border bg-surface/40 p-6 md:p-7 space-y-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-base font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                Transcripts Tickets Discord ({data.transcripts.length})
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Copies et annexes générées lors de la clôture des tickets support avec compte à rebours de rétention en temps réel.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {data.permissions.canManageTickets && (
                            <Link
                                href={`/dashboard/${guildId}/tickets?tab=transcripts`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Ouvrir dans le module tickets
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        <button
                            onClick={() => setShowTranscriptsTable(!showTranscriptsTable)}
                            className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground transition-all"
                            title={showTranscriptsTable ? "Replier la liste" : "Déplier la liste"}
                        >
                            {showTranscriptsTable ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {showTranscriptsTable && (
                    <div className="rounded-2xl border border-border overflow-hidden bg-background/50">
                        {data.transcripts.length === 0 ? (
                            <div className="py-12 px-4 text-center space-y-2">
                                <Inbox className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                                <p className="text-sm font-bold text-muted-foreground">
                                    Aucun transcript de ticket pour le moment
                                </p>
                                <p className="text-xs text-muted-foreground/80 max-w-md mx-auto">
                                    Les archives sont automatiquement créées et horodatées dès qu'un ticket de support Discord est clôturé.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-surface/80 border-b border-border text-caption uppercase tracking-widest text-muted-foreground">
                                        <tr>
                                            <th className="py-3 px-4 font-black">Ticket</th>
                                            <th className="py-3 px-4 font-black">Demandeur</th>
                                            <th className="py-3 px-4 font-black">Catégorie</th>
                                            <th className="py-3 px-4 font-black">Type</th>
                                            <th className="py-3 px-4 font-black text-right">Messages</th>
                                            <th className="py-3 px-4 font-black text-right font-mono">Poids</th>
                                            <th className="py-3 px-4 font-black">Compte à Rebours Rétention</th>
                                            <th className="py-3 px-4 font-black text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 font-medium">
                                        {data.transcripts.map((t) => (
                                            <tr
                                                key={t.id}
                                                className="hover:bg-surface/30 transition-colors"
                                            >
                                                <td className="py-3 px-4 font-bold font-mono text-indigo-400">
                                                    #{t.ticketNumber}
                                                </td>
                                                <td className="py-3 px-4 text-foreground font-semibold">
                                                    {t.creatorDiscordName}
                                                </td>
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    {t.categoryName}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {t.kind === "SHAREABLE" ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] bg-emerald-500/5 text-emerald-400 border-emerald-500/30"
                                                        >
                                                            Conversation
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] bg-amber-500/5 text-amber-400 border-amber-500/30"
                                                        >
                                                            Annexe staff
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right text-muted-foreground">
                                                    {t.messageCount} msg
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                                                    {formatBytes(t.sizeBytes)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {t.expiresAt ? (
                                                        <RealtimeCountdownBadge
                                                            expiresAt={t.expiresAt}
                                                            labelPrefix="PURGE : "
                                                        />
                                                    ) : (
                                                        <span className="text-caption text-muted-foreground">
                                                            Permanent
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {data.permissions.canManageTickets ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <a
                                                                href={`/api/tickets/transcript/${t.secretToken}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                title="Visualiser le transcript HTML"
                                                                className="p-1.5 rounded-lg bg-surface hover:bg-surface/80 border border-border text-foreground transition-all"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </a>
                                                            <a
                                                                href={`/api/tickets/transcript/${t.secretToken}?download=1`}
                                                                title="Télécharger le fichier HTML"
                                                                className="p-1.5 rounded-lg bg-surface hover:bg-surface/80 border border-border text-muted-foreground hover:text-foreground transition-all"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            title="Rôle gestionnaire de tickets requis"
                                                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded cursor-not-allowed"
                                                        >
                                                            <Lock className="w-2.5 h-2.5" /> Verrouillé
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

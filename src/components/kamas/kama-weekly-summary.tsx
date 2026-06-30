"use client";

import { useState } from "react";
import {
    Coins, CheckCircle2, Clock, AlertCircle,
    ImageIcon, X, ExternalLink, ChevronDown, ChevronUp,
    Users, TrendingUp, Shield, Info, Swords
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KAMA_TRANCHE, KAMA_MAX_PER_WEEK } from "@/lib/kama-constants";
import type { KamaWeeklyMemberSummary, KamaWeeklySummaryResult } from "@/server/actions/kama-actions";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getRoleColor(color: number | null): string {
    if (!color || color === 0) return "#71717a";
    return `#${color.toString(16).padStart(6, "0")}`;
}

function getInitials(name: string | null): string {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
}

type StatusConfig = {
    label: string;
    icon: React.ReactNode;
    className: string;
    dot: string;
};

function getStatusConfig(member: KamaWeeklyMemberSummary): StatusConfig {
    if (member.status === "VALIDATED")
        return {
            label: "Validé",
            icon: <CheckCircle2 className="w-3 h-3" />,
            className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
            dot: "bg-emerald-400",
        };
    if (member.status === "MIXED")
        return {
            label: "Partiel",
            icon: <AlertCircle className="w-3 h-3" />,
            className: "text-amber-300 bg-amber-500/10 border-amber-500/25",
            dot: "bg-amber-400",
        };
    return {
        label: "En attente",
        icon: <Clock className="w-3 h-3" />,
        className: "text-zinc-400 bg-zinc-700/40 border-zinc-600/30",
        dot: "bg-zinc-500",
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Proof Lightbox (officers only)
// ──────────────────────────────────────────────────────────────────────────────

function ProofLightbox({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="relative max-w-3xl w-full max-h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt="Preuve de don"
                    className="w-full h-full object-contain bg-zinc-950"
                    style={{ maxHeight: "80vh" }}
                />
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                >
                    <ExternalLink className="w-3 h-3" />
                    Ouvrir
                </a>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Member Row
// ──────────────────────────────────────────────────────────────────────────────

function MemberRow({
    member,
    rank,
    isOfficer,
    onProofClick,
}: {
    member: KamaWeeklyMemberSummary;
    rank: number;
    isOfficer: boolean;
    onProofClick: (url: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const displayName = member.discordNickname || member.pseudoDofus || "Membre inconnu";
    const roleColor = getRoleColor(member.discordRoleColor);
    const statusCfg = getStatusConfig(member);
    const progressPct = Math.min(100, (member.totalAmount / KAMA_MAX_PER_WEEK) * 100);
    const isMax = member.totalAmount >= KAMA_MAX_PER_WEEK;

    return (
        <div className={cn(
            "rounded-xl border transition-all duration-200",
            rank === 1
                ? "border-amber-500/30 bg-amber-500/[0.04]"
                : "border-white/5 bg-zinc-900/40",
            "hover:border-white/10 hover:bg-zinc-900/60"
        )}>
            {/* Main row */}
            <div className="flex items-center gap-3 p-3 sm:p-4">

                {/* Rank badge */}
                <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
                    rank === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        rank === 2 ? "bg-zinc-400/10 text-zinc-400 border border-zinc-600/30" :
                            rank === 3 ? "bg-orange-700/15 text-orange-500 border border-orange-700/25" :
                                "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40"
                )}>
                    {rank}
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                    {member.discordImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={member.discordImage}
                            alt={displayName}
                            className="w-9 h-9 rounded-full object-cover border-2"
                            style={{ borderColor: `${roleColor}50` }}
                        />
                    ) : (
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2"
                            style={{
                                backgroundColor: `${roleColor}15`,
                                borderColor: `${roleColor}50`,
                                color: roleColor,
                            }}
                        >
                            {getInitials(displayName)}
                        </div>
                    )}
                    {/* Status dot */}
                    <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900",
                        statusCfg.dot
                    )} />
                </div>

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate" style={{ color: roleColor !== "#71717a" ? roleColor : undefined }}>
                            {displayName}
                        </span>
                        {isMax && (
                            <span className="text-[9px] font-black bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                MAX ✓
                            </span>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-700",
                                    member.status === "VALIDATED" || member.status === "MIXED"
                                        ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                        : "bg-gradient-to-r from-amber-700 to-amber-500"
                                )}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {member.tranches}/{KAMA_MAX_PER_WEEK / KAMA_TRANCHE}
                        </span>
                    </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-sm font-black text-white font-mono">
                        {member.totalAmount.toLocaleString("fr-FR")}
                        <span className="text-xs text-zinc-500 font-normal ml-0.5">k</span>
                    </div>
                    <div className={cn("text-[10px] font-medium flex items-center justify-end gap-1 mt-0.5", statusCfg.className.split(" ").slice(0, 1))}>
                        {statusCfg.icon}
                        {statusCfg.label}
                    </div>
                </div>

                {/* Status pill (mobile) */}
                <div className={cn(
                    "sm:hidden text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded-full border shrink-0",
                    statusCfg.className
                )}>
                    {statusCfg.icon}
                    {statusCfg.label}
                </div>

                {/* Expand toggle */}
                {(member.donations.length > 1 || (isOfficer && member.proofUrls.length > 0)) && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Voir les détails"
                    >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    {/* Individual donations breakdown */}
                    {member.donations.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Détail des dons</p>
                            {member.donations.map((d, i) => {
                                const dCfg = d.status === "VALIDATED"
                                    ? { label: "Validé", color: "text-emerald-400", dot: "bg-emerald-400" }
                                    : { label: "En attente", color: "text-amber-400", dot: "bg-amber-400" };
                                return (
                                    <div key={d.id} className="flex items-center gap-2 text-xs">
                                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dCfg.dot)} />
                                        <span className="text-zinc-400">Don #{i + 1}</span>
                                        <span className="font-mono font-bold text-white">
                                            {d.amount.toLocaleString("fr-FR")} k
                                        </span>
                                        <span className={cn("ml-auto", dCfg.color)}>{dCfg.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Proof screenshots (officers only) */}
                    {isOfficer && member.proofUrls.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Preuves (officier)
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {member.proofUrls.map((url, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onProofClick(url)}
                                        className="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-xs text-zinc-400 hover:text-amber-300"
                                    >
                                        <ImageIcon className="w-3 h-3" />
                                        Preuve {i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

interface KamaWeeklySummaryProps {
    data: KamaWeeklySummaryResult;
    isOfficer: boolean;
}

export function KamaWeeklySummary({ data, isOfficer }: KamaWeeklySummaryProps) {
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const validatedCount = data.members.filter(m => m.status === "VALIDATED" || m.status === "MIXED").length;
    const maxCount = data.members.filter(m => m.totalAmount >= KAMA_MAX_PER_WEEK).length;
    const totalCollected = data.totalValidated + data.totalPending;

    return (
        <>
            {/* Lightbox */}
            {lightboxUrl && (
                <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
            )}

            <div className="space-y-5">

                {/* ── Stats cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Users className="w-4 h-4 text-blue-400" />}
                        label="Contributeurs"
                        value={data.memberCount}
                        color="blue"
                    />
                    <StatCard
                        icon={<Coins className="w-4 h-4 text-amber-400" />}
                        label="Total soumis"
                        value={`${totalCollected.toLocaleString("fr-FR")} k`}
                        color="amber"
                    />
                    <StatCard
                        icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        label="Validé"
                        value={`${data.totalValidated.toLocaleString("fr-FR")} k`}
                        color="emerald"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
                        label="Max atteint"
                        value={`${maxCount} mbr`}
                        color="violet"
                    />
                </div>

                {/* ── Raid Participation note (proposal) ── */}
                <div className="flex items-start gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] px-4 py-3">
                    <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 shrink-0 mt-0.5">
                        <Swords className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-violet-300">
                            Proposition — Condition de participation aux raids
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                            Idée pour le staff : conditionner l&apos;inscription aux raids officiels à une contribution kamas validée dans la semaine.
                            {validatedCount > 0 && (
                                <> Cette semaine, <span className="text-violet-300 font-semibold">{validatedCount} membres</span> ont un don validé et seraient éligibles.</>
                            )}
                            {" "}Cette vue vous donne une vue rapide pour vérifier manuellement l&apos;éligibilité. Une automatisation est envisageable.
                        </p>
                    </div>
                </div>

                {/* ── Member list ── */}
                {data.members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                            <Coins className="w-8 h-8 text-zinc-700" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-500">Aucun don cette semaine</p>
                        <p className="text-xs text-zinc-700 text-center max-w-xs">
                            Les membres n&apos;ont pas encore soumis de contributions pour le cycle en cours.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Column headers (desktop) */}
                        <div className="hidden sm:grid grid-cols-[40px_40px_1fr_auto_auto] items-center gap-3 px-4 pb-1">
                            <span /> {/* rank */}
                            <span /> {/* avatar */}
                            <span className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold">Membre</span>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold text-right">Montant</span>
                            <span /> {/* expand */}
                        </div>

                        {/* Member rows */}
                        {data.members.map((member, i) => (
                            <MemberRow
                                key={member.profileId}
                                member={member}
                                rank={i + 1}
                                isOfficer={isOfficer}
                                onProofClick={setLightboxUrl}
                            />
                        ))}
                    </div>
                )}

                {/* ── Info footer ── */}
                <div className="flex items-start gap-2 text-[11px] text-zinc-600 pt-1">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                        Récapitulatif de la semaine Dofus en cours (reset mardi 07h).
                        {isOfficer
                            ? " En tant qu'officier, vous pouvez consulter les screenshots de preuves en cliquant sur une ligne."
                            : " Les screenshots de preuves sont réservés aux officiers de missions."}
                    </span>
                </div>
            </div>
        </>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Stat Card
// ──────────────────────────────────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: "blue" | "amber" | "emerald" | "violet";
}) {
    const colors = {
        blue: "border-blue-500/15 bg-blue-500/[0.04]",
        amber: "border-amber-500/15 bg-amber-500/[0.04]",
        emerald: "border-emerald-500/15 bg-emerald-500/[0.04]",
        violet: "border-violet-500/15 bg-violet-500/[0.04]",
    };
    return (
        <div className={cn("rounded-xl border px-3 py-3", colors[color])}>
            <div className="flex items-center gap-2 mb-1.5">
                {icon}
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{label}</span>
            </div>
            <div className="text-lg font-black text-white font-mono">{value}</div>
        </div>
    );
}

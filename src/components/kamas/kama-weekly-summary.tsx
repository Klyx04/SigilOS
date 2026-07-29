"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Coins, CheckCircle2, Clock, AlertCircle,
    ChevronDown, ChevronUp, Users, TrendingUp,
    Swords, Lock, Star, Trophy, Crown, Zap, Info
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
// Kamas Violet Display Component
// ──────────────────────────────────────────────────────────────────────────────

function KamasVioletIcon({ size = 16 }: { size?: number }) {
    return (
        <Image
            src="/kamas-violet.png"
            alt="🟣"
            width={size}
            height={size}
            className="inline-block"
            style={{ width: size, height: size }}
        />
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Raid Eligibility Badge
// ──────────────────────────────────────────────────────────────────────────────

function RaidEligibilityBadge({ purpleKamasBalance, requiredPurpleKamas = 30 }: { purpleKamasBalance: number; requiredPurpleKamas?: number }) {
    const isEligible = purpleKamasBalance >= requiredPurpleKamas;
    if (isEligible) {
        return (
            <span className="flex items-center gap-1.5 text-[9px] font-black bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                <Swords className="w-2.5 h-2.5" />
                Raid éligible
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1.5 text-[9px] font-black bg-zinc-800/60 border border-zinc-700/40 text-zinc-500 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
            <Lock className="w-2.5 h-2.5" />
            Non éligible
        </span>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Bourse Badge — shows balance in Kamas Violets with conversion info
// ──────────────────────────────────────────────────────────────────────────────

function PurpleKamasBadge({ balance }: { balance: number }) {
    return (
        <span className="flex items-center gap-1.5 text-[9px] font-black bg-violet-500/15 border border-violet-500/25 text-violet-300 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
            <KamasVioletIcon size={12} />
            Bourse: {balance}
        </span>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Member Row
// ──────────────────────────────────────────────────────────────────────────────

function MemberRow({
    member,
    rank,
    isOfficer,
    requiredPurpleKamas = 30,
}: {
    member: KamaWeeklyMemberSummary;
    rank: number;
    isOfficer: boolean;
    requiredPurpleKamas?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const displayName = member.discordNickname || member.pseudoDofus || "Membre inconnu";
    const roleColor = getRoleColor(member.discordRoleColor);
    const statusCfg = getStatusConfig(member);
    const isMax = member.totalAmount >= KAMA_MAX_PER_WEEK;
    const purpleBalance = member.purpleKamasBalance || 0;
    const isEligible = purpleBalance >= requiredPurpleKamas;

    // Convert total donated to purple kamas equivalent
    const purpleEarned = Math.floor((member.totalAmount || 0) / 1000);

    const rankStyle =
        rank === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-amber-500/20 shadow-sm" :
        rank === 2 ? "bg-zinc-400/10 text-zinc-400 border border-zinc-600/30" :
        rank === 3 ? "bg-orange-700/15 text-orange-500 border border-orange-700/25" :
        "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40";

    return (
        <div className={cn(
            "rounded-2xl border transition-all duration-200 group",
            rank === 1
                ? "border-amber-500/30 bg-gradient-to-r from-amber-500/[0.04] to-transparent"
                : isEligible
                    ? "border-emerald-500/15 bg-zinc-900/40 hover:border-emerald-500/25"
                    : "border-white/[0.04] bg-zinc-900/30",
            "hover:bg-zinc-900/60 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-px"
        )}>
            {/* Main row */}
            <div className="flex items-center gap-3 p-3.5 sm:p-4">

                {/* Rank badge */}
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                    rankStyle
                )}>
                    {rank <= 3 ? (
                        rank === 1 ? <Crown className="w-4 h-4" /> :
                        rank === 2 ? <Trophy className="w-3.5 h-3.5" /> :
                        <Star className="w-3.5 h-3.5" />
                    ) : rank}
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                    {member.discordImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={member.discordImage}
                            alt={displayName}
                            className="w-10 h-10 rounded-full object-cover border-2 transition-transform group-hover:scale-105"
                            style={{ borderColor: `${roleColor}50` }}
                        />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-transform group-hover:scale-105"
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
                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-900",
                        statusCfg.dot
                    )} />
                </div>

                {/* Name + badges + progress */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-bold text-white truncate" style={{ color: roleColor !== "#71717a" ? roleColor : undefined }}>
                            {displayName}
                        </span>
                        <RaidEligibilityBadge purpleKamasBalance={purpleBalance} requiredPurpleKamas={requiredPurpleKamas} />
                        <PurpleKamasBadge balance={purpleBalance} />
                        {member.totalAmount > 0 && (
                            <span className="text-[9px] font-bold bg-zinc-800/80 border border-white/10 text-zinc-300 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                {member.totalAmount.toLocaleString("fr-FR")} k donnés
                            </span>
                        )}
                        {isMax && (
                            <span className="text-[9px] font-black bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                MAX ✓
                            </span>
                        )}
                    </div>

                    {/* Purple Kamas progress bar (toward raid eligibility) */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-700",
                                        isEligible
                                            ? "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-400"
                                            : "bg-gradient-to-r from-zinc-700 to-zinc-500"
                                    )}
                                    style={{ width: `${Math.min(100, (purpleBalance / requiredPurpleKamas) * 100)}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-400 font-mono">
                                <KamasVioletIcon size={10} />
                                <span>{purpleBalance}/{requiredPurpleKamas}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status pill */}
                <div className={cn(
                    "text-[9px] font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-full border shrink-0 hidden sm:flex",
                    statusCfg.className
                )}>
                    {statusCfg.icon}
                    {statusCfg.label}
                </div>

                    {/* Expand toggle */}
                    {member.donations.length > 1 && (
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
    guildId?: string;
}

export function KamaWeeklySummary({ data, isOfficer, guildId }: KamaWeeklySummaryProps) {
    const requiredKamas = data.requiredPurpleKamas ?? 30;
    const validatedCount = data.members.filter(m => m.status === "VALIDATED" || m.status === "MIXED").length;
    const eligibleCount = data.members.filter(m => m.purpleKamasBalance >= requiredKamas).length;
    const maxCount = data.members.filter(m => m.totalAmount >= KAMA_MAX_PER_WEEK).length;
    const totalCollected = data.totalValidated + data.totalPending;
    const totalPurpleKamas = data.members.reduce((sum, m) => sum + (m.purpleKamasBalance || 0), 0);

    return (
        <div className="space-y-6">

                {/* ── Raid eligibility highlight banner ── */}
                <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-r from-violet-950/30 via-zinc-950/60 to-zinc-950/30 p-5 shadow-lg shadow-violet-950/20">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.06),transparent_60%)] pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
                                <Image src="/kamas-violet.png" alt="🟣" width={24} height={24} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                                    Bourse de Kamas Violets
                                </p>
                                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                                    <span className="text-violet-300 font-bold">1 <KamasVioletIcon size={10} /> = 1 000 k</span> donnés et validés.
                                    Ces Kamas Violets sont utilisés pour participer aux raids de guilde.
                                    {eligibleCount > 0
                                        ? ` Actuellement, ${eligibleCount} membre${eligibleCount > 1 ? "s" : ""} sur ${data.memberCount} est${eligibleCount > 1 ? "ent" : ""} éligible${eligibleCount > 1 ? "s" : ""}.`
                                        : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-center px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-2xl font-black text-emerald-400">{eligibleCount}</div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Éligibles</div>
                            </div>
                            <div className="text-center px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                                <div className="text-2xl font-black text-zinc-300">{data.memberCount - eligibleCount}</div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Non éligibles</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Stats cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Image src="/kamas-violet.png" alt="🟣" width={18} height={18} />}
                        label="Total Kamas Violets"
                        value={totalPurpleKamas}
                        color="violet"
                    />
                    <StatCard
                        icon={<Coins className="w-4 h-4 text-amber-400" />}
                        label="Dons validés cette semaine"
                        value={`${data.totalValidated.toLocaleString("fr-FR")} k`}
                        color="amber"
                    />
                    <StatCard
                        icon={<Users className="w-4 h-4 text-blue-400" />}
                        label="Membres ayant donné"
                        value={`${validatedCount}/${data.memberCount}`}
                        color="blue"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
                        label="En attente"
                        value={`${data.totalPending.toLocaleString("fr-FR")} k`}
                        color="violet"
                    />
                </div>

                {/* ── Info box about how it works ── */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
                    <div className="p-1.5 rounded-lg bg-violet-500/10 shrink-0">
                        <Info className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                        <p><strong className="text-violet-300">Comment ça marche ?</strong></p>
                        <p>
                            <KamasVioletIcon size={10} /> <strong className="text-white">1 Kamas Violet</strong> = 1 000 k donnés sur le module Kamas.
                            Tu obtiens des Kamas Violets dès que ton don est <strong className="text-emerald-400">validé</strong> par un officier.
                        </p>
                        <p>
                            <Swords className="w-3 h-3 inline text-red-400" /> Pour t'inscrire à un raid, tu dois avoir <strong className="text-violet-300">{requiredKamas} <KamasVioletIcon size={10} /> ({(requiredKamas * 1000).toLocaleString("fr-FR")} k)</strong> dans ta bourse.
                            À la clôture du raid, ils sont consommés.
                        </p>
                        <p>
                            🔄 Les Kamas Violets ne sont <strong className="text-amber-400">pas remis à zéro</strong> chaque semaine : ils s'accumulent tant que tu ne participes pas à des raids.
                        </p>
                        <p>
                            ⏳ <strong className="text-zinc-300">Réserves / file d'attente :</strong> Si tu es en file d'attente et ne participes pas au raid, tes Kamas Violets <strong className="text-emerald-400">ne sont pas déduits</strong>.
                        </p>
                    </div>
                </div>

                {/* ── Member list ── */}
                {data.members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-2 border-dashed border-zinc-800/50">
                        <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                            <Coins className="w-8 h-8 text-zinc-700" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-400">Aucun don cette semaine</p>
                            <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                                Les membres n'ont pas encore soumis de contributions pour le cycle en cours.
                            </p>
                        </div>
                        {guildId && (
                            <Link
                                href={`/dashboard/${guildId}/missions#don-kamas`}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold hover:bg-amber-500/20 transition-all"
                            >
                                <Coins className="w-4 h-4" />
                                Faire un don
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Column headers (desktop) */}
                        <div className="hidden sm:flex items-center gap-3 px-4 pb-1">
                            <span className="w-8 shrink-0" />
                            <span className="w-10 shrink-0" />
                            <span className="flex-1 text-[10px] uppercase tracking-widest text-zinc-700 font-bold">Membre</span>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold">Statut</span>
                            <span className="w-5 shrink-0" />
                        </div>

                        {/* Member rows */}
                        {data.members.map((member, i) => (
                            <MemberRow
                                key={member.profileId}
                                member={member}
                                rank={i + 1}
                                isOfficer={isOfficer}
                                requiredPurpleKamas={requiredKamas}
                            />
                        ))}
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex items-start gap-2 text-[11px] text-zinc-600 pt-1 border-t border-white/[0.03] pt-4">
                    <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500/50" />
                    <span>
                        Récapitulatif de la semaine Dofus en cours (reset mardi 07h00 Paris).
                        {" "}Les <KamasVioletIcon size={10} /> sont conservés entre les semaines — seuls les raids y puisent.
                    </span>
                </div>
            </div>
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
    color: "blue" | "amber" | "emerald" | "violet" | "rose";
}) {
    const colors = {
        blue: "border-blue-500/15 bg-blue-500/[0.04] hover:bg-blue-500/[0.07]",
        amber: "border-amber-500/15 bg-amber-500/[0.04] hover:bg-amber-500/[0.07]",
        emerald: "border-emerald-500/15 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]",
        violet: "border-violet-500/15 bg-violet-500/[0.04] hover:bg-violet-500/[0.07]",
        rose: "border-rose-500/15 bg-rose-500/[0.04] hover:bg-rose-500/[0.07]",
    };
    return (
        <div className={cn("rounded-2xl border px-4 py-3.5 transition-all duration-200", colors[color])}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{label}</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{value}</div>
        </div>
    );
}
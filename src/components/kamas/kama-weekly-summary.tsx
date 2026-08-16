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
            className: "text-success bg-success/10 border-success/25",
            dot: "bg-success",
        };
    if (member.status === "MIXED")
        return {
            label: "Partiel",
            icon: <AlertCircle className="w-3 h-3" />,
            className: "text-warning bg-warning/10 border-warning/25",
            dot: "bg-warning",
        };
    return {
        label: "En attente",
        icon: <Clock className="w-3 h-3" />,
        className: "text-muted-foreground bg-muted/40 border-border/30",
        dot: "bg-muted",
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
            <span className="flex items-center gap-1.5 text-caption font-black bg-success/15 border border-success/25 text-success px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                <Swords className="w-2.5 h-2.5" />
                Raid éligible
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1.5 text-caption font-black bg-elevated/60 border border-border/40 text-muted-foreground px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
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
        <span className="flex items-center gap-1.5 text-caption font-black bg-violet-500/15 border border-violet-500/25 text-violet-300 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
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
        rank === 1 ? "bg-warning/20 text-warning border border-warning/30 shadow-amber-500/20 shadow-sm" :
        rank === 2 ? "bg-zinc-400/10 text-muted-foreground border border-border/30" :
        rank === 3 ? "bg-orange-700/15 text-orange-500 border border-orange-700/25" :
        "bg-elevated/60 text-muted-foreground border border-border/40";

    return (
        <div className={cn(
            "rounded-2xl border transition-all duration-200 group",
            rank === 1
                ? "border-warning/30 bg-gradient-to-r from-warning/[0.04] to-transparent"
                : isEligible
                    ? "border-success/15 bg-surface/40 hover:border-success/25"
                    : "border-border bg-surface/30",
            "hover:bg-surface/60 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-px"
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
                            className="w-10 h-10 rounded-full object-cover border-2 transition-transform group-"
                            style={{ borderColor: `${roleColor}50` }}
                        />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-transform group-"
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
                        <span className="text-sm font-bold text-foreground truncate" style={{ color: roleColor !== "#71717a" ? roleColor : undefined }}>
                            {displayName}
                        </span>
                        <RaidEligibilityBadge purpleKamasBalance={purpleBalance} requiredPurpleKamas={requiredPurpleKamas} />
                        <PurpleKamasBadge balance={purpleBalance} />
                        {member.totalAmount > 0 && (
                            <span className="text-caption font-bold bg-elevated/80 border border-border text-foreground px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                {member.totalAmount.toLocaleString("fr-FR")} k donnés
                            </span>
                        )}
                        {isMax && (
                            <span className="text-caption font-black bg-warning/15 border border-warning/25 text-warning px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                MAX ✓
                            </span>
                        )}
                    </div>

                    {/* Purple Kamas progress bar (toward raid eligibility) */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden relative">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-300",
                                        isEligible
                                            ? "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-danger"
                                            : "bg-gradient-to-r from-zinc-700 to-zinc-500"
                                    )}
                                    style={{ width: `${Math.min(100, (purpleBalance / requiredPurpleKamas) * 100)}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-caption text-muted-foreground font-mono">
                                <KamasVioletIcon size={10} />
                                <span>{purpleBalance}/{requiredPurpleKamas}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status pill */}
                <div className={cn(
                    "text-caption font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-full border shrink-0 hidden sm:flex",
                    statusCfg.className
                )}>
                    {statusCfg.icon}
                    {statusCfg.label}
                </div>

                    {/* Expand toggle */}
                    {member.donations.length > 1 && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                            title="Voir les détails"
                        >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
                        {/* Individual donations breakdown */}
                        {member.donations.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-caption uppercase tracking-widest text-muted-foreground font-bold">Détail des dons</p>
                                {member.donations.map((d, i) => {
                                    const dCfg = d.status === "VALIDATED"
                                        ? { label: "Validé", color: "text-success", dot: "bg-success" }
                                        : { label: "En attente", color: "text-warning", dot: "bg-warning" };
                                    return (
                                        <div key={d.id} className="flex items-center gap-2 text-xs">
                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dCfg.dot)} />
                                            <span className="text-muted-foreground">Don #{i + 1}</span>
                                            <span className="font-mono font-bold text-foreground">
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
                                <p className="text-sm font-black text-foreground uppercase tracking-wide flex items-center gap-2">
                                    Bourse de Kamas Violets
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    <span className="text-violet-300 font-bold">1 <KamasVioletIcon size={10} /> = 1 000 k</span> donnés et validés.
                                    Ces Kamas Violets sont utilisés pour participer aux raids de guilde.
                                    {eligibleCount > 0
                                        ? ` Actuellement, ${eligibleCount} membre${eligibleCount > 1 ? "s" : ""} sur ${data.memberCount} est${eligibleCount > 1 ? "ent" : ""} éligible${eligibleCount > 1 ? "s" : ""}.`
                                        : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-center px-4 py-2 rounded-xl bg-success/10 border border-success/20">
                                <div className="text-2xl font-black text-success">{eligibleCount}</div>
                                <div className="text-caption text-muted-foreground uppercase tracking-wider font-bold">Éligibles</div>
                            </div>
                            <div className="text-center px-4 py-2 rounded-xl bg-elevated/50 border border-border/30">
                                <div className="text-2xl font-black text-foreground">{data.memberCount - eligibleCount}</div>
                                <div className="text-caption text-muted-foreground uppercase tracking-wider font-bold">Non éligibles</div>
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
                        icon={<Coins className="w-4 h-4 text-warning" />}
                        label="Dons validés cette semaine"
                        value={`${data.totalValidated.toLocaleString("fr-FR")} k`}
                        color="amber"
                    />
                    <StatCard
                        icon={<Users className="w-4 h-4 text-info" />}
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
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                        <p><strong className="text-violet-300">Comment ça marche ?</strong></p>
                        <p>
                            <KamasVioletIcon size={10} /> <strong className="text-foreground">1 Kamas Violet</strong> = 1 000 k donnés sur le module Kamas.
                            Tu obtiens des Kamas Violets dès que ton don est <strong className="text-success">validé</strong> par un officier.
                        </p>
                        <p>
                            <Swords className="w-3 h-3 inline text-danger" /> Pour t'inscrire à un raid, tu dois avoir <strong className="text-violet-300">{requiredKamas} <KamasVioletIcon size={10} /> ({(requiredKamas * 1000).toLocaleString("fr-FR")} k)</strong> dans ta bourse.
                            À la clôture du raid, ils sont consommés.
                        </p>
                        <p>
                            🔄 Les Kamas Violets ne sont <strong className="text-warning">pas remis à zéro</strong> chaque semaine : ils s'accumulent tant que tu ne participes pas à des raids.
                        </p>
                        <p>
                            ⏳ <strong className="text-foreground">Réserves / file d'attente :</strong> Si tu es en file d'attente et ne participes pas au raid, tes Kamas Violets <strong className="text-success">ne sont pas déduits</strong>.
                        </p>
                    </div>
                </div>

                {/* ── Member list ── */}
                {data.members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-2 border-dashed border-border/50">
                        <div className="p-4 rounded-2xl bg-surface/50 border border-border">
                            <Coins className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-muted-foreground">Aucun don cette semaine</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                Les membres n'ont pas encore soumis de contributions pour le cycle en cours.
                            </p>
                        </div>
                        {guildId && (
                            <Link
                                href={`/dashboard/${guildId}/missions#don-kamas`}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20 text-warning text-sm font-bold hover:bg-warning/20 transition-all"
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
                            <span className="flex-1 text-caption uppercase tracking-widest text-muted-foreground font-bold">Membre</span>
                            <span className="text-caption uppercase tracking-widest text-muted-foreground font-bold">Statut</span>
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
                <div className="flex items-start gap-2 text-caption text-muted-foreground pt-1 border-t border-border pt-4">
                    <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning/50" />
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
        blue: "border-info/15 bg-info/[0.04] hover:bg-info/[0.07]",
        amber: "border-warning/15 bg-warning/[0.04] hover:bg-warning/[0.07]",
        emerald: "border-success/15 bg-success/[0.04] hover:bg-success/[0.07]",
        violet: "border-violet-500/15 bg-violet-500/[0.04] hover:bg-violet-500/[0.07]",
        rose: "border-danger/15 bg-danger/[0.04] hover:bg-danger/[0.07]",
    };
    return (
        <div className={cn("rounded-2xl border px-4 py-3.5 transition-all duration-200", colors[color])}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-caption uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
            </div>
            <div className="text-xl font-black text-foreground font-mono">{value}</div>
        </div>
    );
}
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LadderEntry } from "@/server/actions/ladder-actions";
import { discordAvatarErrorFallback, extractUserIdFromAvatarUrl, getDefaultDiscordAvatar } from "@/lib/discord-avatars";
import { Crown, ShieldCheck, User, Zap, Ghost, Utensils, Coffee, Plane, Clock, Umbrella } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getClass } from "@/lib/dofus-assets";

type Props = {
    entry: LadderEntry;
    valueLabel: React.ReactNode;
    accentColor: "purple" | "cyan" | "amber" | "emerald" | "yellow" | "blue" | "indigo";
};

export function LeaderboardCard({ entry, valueLabel, accentColor }: Props) {
    const colorClasses = {
        blue: {
            border: "group-hover:border-info/30 border-border",
            bg: "hover:bg-info/[0.03]",
            rankText: "text-info",
            valueText: "text-info",
            glow: "bg-info/10",
            highlight: "bg-info/10 border-info/20 ring-1 ring-info/20"
        },
        purple: {
            border: "group-hover:border-info/30 border-border",
            bg: "hover:bg-info/[0.03]",
            rankText: "text-info",
            valueText: "text-info",
            glow: "bg-info/10",
            highlight: "bg-info/10 border-info/20 ring-1 ring-info/20"
        },
        cyan: {
            border: "group-hover:border-info/30 border-border",
            bg: "hover:bg-info/[0.03]",
            rankText: "text-info",
            valueText: "text-info",
            glow: "bg-info/10",
            highlight: "bg-info/10 border-info/20 ring-1 ring-info/20"
        },
        amber: {
            border: "group-hover:border-warning/30 border-border",
            bg: "hover:bg-warning/[0.03]",
            rankText: "text-warning",
            valueText: "text-warning",
            glow: "bg-warning/10",
            highlight: "bg-warning/10 border-warning/20 ring-1 ring-warning/20"
        },
        emerald: {
            border: "group-hover:border-success/30 border-border",
            bg: "hover:bg-success/[0.03]",
            rankText: "text-success",
            valueText: "text-success",
            glow: "bg-success/10",
            highlight: "bg-success/10 border-success/20 ring-1 ring-success/20"
        },
        yellow: {
            border: "group-hover:border-warning/30 border-border",
            bg: "hover:bg-warning/[0.03]",
            rankText: "text-warning",
            valueText: "text-warning",
            glow: "bg-warning/10",
            highlight: "bg-warning/10 border-warning/20 ring-1 ring-warning/20"
        },
        indigo: {
            border: "group-hover:border-info/30 border-border",
            bg: "hover:bg-info/[0.03]",
            rankText: "text-info",
            valueText: "text-info",
            glow: "bg-info/10",
            highlight: "bg-info/10 border-info/20 ring-1 ring-ring/20"
        }
    };

    const colors = colorClasses[accentColor];
    const isTop3 = entry.rank <= 3;
    const isGeneral = !!(entry.dofusLevel || entry.totalXpBigInt);
    // #134 — hash d'avatar périmé (404 → ERR_BLOCKED_BY_ORB) : on bascule sur le miroir
    // puis sur l'icône neutre au lieu de laisser une image brisée.
    const [avatarFailed, setAvatarFailed] = useState(false);
    
    // 0-value "Tourist" / "Bad Student" logic
    // We don't apply it to the General ladder (total XP) because 0 is normal for new characters
    const isTourist = !isGeneral && entry.value === 0;
    const dofusClass = entry.classe ? getClass(entry.classe) : null;

    return (
        <div
            className={cn(
               "group relative flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 rounded-2xl border transition-colors duration-200 overflow-hidden",
               colors.border,
               isTop3 ? "bg-surface border-border-strong" : "bg-surface border-border",
               isTourist && "border-danger/10 grayscale-[0.8] opacity-60 hover:opacity-100 hover:grayscale-0",
               entry.isCurrentUser && "ring-1 ring-border bg-surface"
            )}
        >
            {/* 1. Rank & Portrait */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 flex justify-center shrink-0">
                    {entry.rank <= 3 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/assets/dofus/game-icons/trophy-${entry.rank}.png`} alt={`Top ${entry.rank}`} className="h-6 w-6 object-contain" />
                    ) : (
                        <span className="text-caption font-black italic text-muted-foreground group-hover:text-muted-foreground transition-colors">
                            #{entry.rank.toString().padStart(2, '0')}
                        </span>
                    )}
                </div>

                <div className={cn(
                    "w-11 h-11 rounded-xl overflow-hidden border border-border shrink-0 bg-elevated relative group/avatar",
                    isTop3 && "ring-2 ring-primary/20"
                )}>
                    {entry.discordImage && !avatarFailed ? (
                        <img
                            src={entry.discordImage}
                            alt="Avatar"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/avatar:scale-125"
                            onError={(e) => {
                                const mirror = discordAvatarErrorFallback(entry.discordImage);
                                if (mirror && mirror !== e.currentTarget.src) {
                                    e.currentTarget.src = mirror;
                                    return;
                                }
                                // #134 — hash périmé → avatar Discord par défaut officiel (jamais 404).
                                const defaultAvatar = getDefaultDiscordAvatar(extractUserIdFromAvatarUrl(entry.discordImage));
                                if (defaultAvatar && defaultAvatar !== e.currentTarget.src) {
                                    e.currentTarget.src = defaultAvatar;
                                    return;
                                }
                                setAvatarFailed(true);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-elevated"><User className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                    {dofusClass && (
                        <div className="absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-md border border-border-strong bg-surface p-0.5 z-20">
                            <img src={dofusClass.icon} alt={dofusClass.name} className="w-full h-full object-contain" />
                        </div>
                    )}
                </div>
            </div>

            {/* 2. User Info (Identity) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2 flex-wrap">
                    <span 
                        className={cn("text-[15px] font-black tracking-tight truncate", isTop3 ? "text-foreground" : "text-foreground")}
                        style={entry.discordRoleColor ? { color: `#${entry.discordRoleColor.toString(16).padStart(6, '0')}` } : undefined}
                    >
                        {entry.discordNickname || "Membre"}
                    </span>
                    {entry.isCurrentUser && <span className="text-caption px-1.5 py-0.5 rounded bg-info/20 text-info border border-info/30 font-black uppercase tracking-widest">VOUS</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-muted-foreground transition-opacity">
                    {entry.pseudoDofus && <span className="text-caption font-medium italic truncate">{entry.pseudoDofus}</span>}
                    {!isGeneral && entry.classe && <span className="text-caption font-black uppercase tracking-widest">• {entry.classe}</span>}
                </div>
            </div>

            {/* 3. Center Section: Perfectly Centered Level (Hidden on extreme mobile) */}
            <div className="hidden sm:flex justify-center items-center px-4 shrink-0">
                {isGeneral && entry.dofusLevel ? (
                    <div className="flex flex-col items-center">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-1.5">Niveau</span>
                        <div className="relative group/lv">
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border group-hover/lv:border-info/50 transition-colors duration-200">
                                <span className={cn("text-sm font-black tracking-tighter tabular-nums", entry.dofusLevel >= 200 ? "text-warning" : "text-foreground")}>
                                    {entry.dofusLevel}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-px h-10 bg-border invisible" />
                )}
            </div>

            {/* 4. Value Section */}
            <div className="flex justify-end pr-1 sm:pr-2 shrink-0">
                {isGeneral ? (
                    <div className="flex flex-col items-end">
                        <div className={cn("text-lg font-black tracking-tighter flex items-center gap-2", isTop3 ? "text-foreground" : "text-info")}>
                            <span className="text-muted-foreground text-caption font-black mt-1 tracking-widest">XP</span>
                            {Number(entry.totalXpBigInt || 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground transition-opacity">
                            <Zap className="w-3 h-3 text-info" />
                            <span className="text-caption font-black uppercase tracking-[0.2em] italic">Ladder Général</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-end">
                        <div className={cn("text-body font-black tracking-tight uppercase", isTop3 ? "text-foreground" : colors.valueText)}>
                            {valueLabel}
                        </div>
                        {isTourist ? (
                            <div className={cn(
                                "flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border",
                                entry.isInVacation 
                                    ? "bg-info/10 border-info/20 text-info" 
                                    : "bg-danger/10 border-danger/20 text-danger"
                            )}>
                                {entry.isInVacation ? (
                                    <Umbrella className="w-3 h-3" />
                                ) : (
                                    <Ghost className="w-3 h-3" />
                                )}
                                <span className="text-caption font-black uppercase tracking-widest leading-none">
                                    {entry.isInVacation ? "En Vacances" : "Mauvais Élève"}
                                </span>
                            </div>
                        ) : accentColor === "purple" && (
                            <div className="text-caption text-muted-foreground font-black uppercase tracking-widest mt-1.5 opacity-40">Sync auto</div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}

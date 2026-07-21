"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Swords, Map, Users, Clock, Calendar, CheckCircle2,
    XCircle, LogIn, LogOut, Crown, Link2, Bell
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { closeDjPost, joinDjPost, leaveDjPost, sendDjReminder } from "@/server/actions/dungeon-finder-actions";
import { DjPostDetailModal } from "./DjPostDetailModal";
import { DjCloseModal } from "./DjCloseModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getClass } from "@/lib/dofus-assets";

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const MODE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    DONJON: { 
        label: "Donjon", 
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.1)]", 
        icon: Swords 
    },
    QUETE: { 
        label: "Quête", 
        color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/35 shadow-[0_0_12px_rgba(6,182,212,0.1)]", 
        icon: Map 
    },
};

const STATUS_META: Record<string, { label: string; dot: string }> = {
    OPEN: { label: "Ouvert", dot: "bg-emerald-400" },
    FULL: { label: "Complet", dot: "bg-amber-400" },
    CLOSED: { label: "Fermé", dot: "bg-zinc-500" },
    EXPIRED: { label: "Expiré", dot: "bg-zinc-600" },
};

// -------------------------------------------------------
// DjPostCard
// -------------------------------------------------------

interface DjPostCardProps {
    post: DjPostWithDetails;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
    onRefresh: () => void;
    isDiscordConfigured?: boolean;
}

export function DjPostCard({ post, guildId, currentProfileId, isAdmin, onRefresh, isDiscordConfigured }: DjPostCardProps) {
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = post.profileId === currentProfileId;
    const myParticipation = currentProfileId
        ? post.participants.find((p) => p.profile.id === currentProfileId)
        : null;

    const acceptedCount = post._acceptedCount + 1; // +1 creator
    const spotsLeft = post.maxMembers - acceptedCount;

    const modeMeta = MODE_META[post.mode] ?? MODE_META.DONJON;
    const ModIcon = modeMeta.icon;
    const statusMeta = STATUS_META[post.status] ?? STATUS_META.OPEN;

    // Quick-join (no modal)
    function handleQuickJoin() {
        startTransition(async () => {
            const res = await joinDjPost(guildId, post.id, {});
            if (res.success) {
                toast.success("Candidature envoyée !");
                onRefresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    function handleLeave() {
        startTransition(async () => {
            const res = await leaveDjPost(guildId, post.id);
            if (res.success) {
                toast.success("Tu t'es retiré du post.");
                onRefresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    function handleClose() {
        // Admin quick-close (no contribution modal)
        startTransition(async () => {
            const res = await closeDjPost(guildId, post.id);
            if (res.success) {
                toast.success("Post fermé.");
                onRefresh();
            } else {
                toast.error(res.error);
            }
        });
    }

    function handleReminder() {
        startTransition(async () => {
            const res = await sendDjReminder(guildId, post.id);
            if (res.success) {
                toast.success("Rappel envoyé sur Discord !");
            } else {
                toast.error(res.error || "Erreur lors de l'envoi du rappel.");
            }
        });
    }

    const title = post.mode === "DONJON" ? post.dungeon?.name : post.questName;
    const subtitle = post.mode === "DONJON" ? `${post.dungeon?.bossName} · Lvl ${post.dungeon?.level}` : "Quête";
    const coverImage = post.dungeon?.imageUrl;

    const isOpen = post.status === "OPEN" || post.status === "FULL";
    const isDonjon = post.mode === "DONJON";

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                    "group relative rounded-2xl border backdrop-blur-md overflow-hidden transition-all duration-500 flex flex-col h-full",
                    isOpen
                        ? isDonjon
                            ? "bg-gradient-to-br from-[#121127]/80 via-[#0a0a0f]/90 to-[#0e0a1b]/95 border-indigo-500/25 hover:border-indigo-400/60 shadow-[0_0_30px_rgba(99,102,241,0.05)] hover:shadow-[0_0_35px_rgba(99,102,241,0.18)]"
                            : "bg-gradient-to-br from-[#0c1b22]/80 via-[#0a0f0d]/90 to-[#06120e]/95 border-cyan-500/25 hover:border-cyan-400/60 shadow-[0_0_30px_rgba(6,182,212,0.05)] hover:shadow-[0_0_35px_rgba(6,182,212,0.18)]"
                        : "bg-zinc-950/40 border-white/5 opacity-50"
                )}
            >
                {/* Neon Top Accent Line */}
                {isOpen && (
                    <div 
                        className={cn(
                            "absolute top-0 inset-x-0 h-[2px] z-10 transition-opacity duration-500 opacity-60 group-hover:opacity-100",
                            isDonjon 
                                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_1px_8px_rgba(99,102,241,0.4)]" 
                                : "bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 shadow-[0_1px_8px_rgba(6,182,212,0.4)]"
                        )} 
                    />
                )}

                {/* Decorative radial glows */}
                {isOpen && (
                    <div 
                        className={cn(
                            "absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-100",
                            isDonjon 
                                ? "bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.07),transparent_45%)]" 
                                : "bg-[radial-gradient(circle_at_70%_20%,rgba(6,182,212,0.07),transparent_45%)]"
                        )} 
                    />
                )}

                {/* Banner */}
                <div className="relative h-28 bg-zinc-950/90 overflow-hidden flex items-center shrink-0 border-b border-white/5">
                    {coverImage && (
                        <div className="absolute inset-0">
                            <img
                                src={coverImage}
                                alt={subtitle}
                                className="w-full h-full object-cover opacity-25 scale-105 group-hover:scale-110 transition-transform duration-1000"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-transparent to-transparent opacity-80" />

                    <div className="relative flex items-center gap-4 px-5 w-full">
                        <div className={cn(
                            "w-14 h-14 rounded-xl overflow-hidden shrink-0 flex flex-col items-center justify-center border shadow-2xl transition-all duration-500 group-hover:scale-105",
                            isOpen
                                ? isDonjon
                                    ? "bg-zinc-900 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                    : "bg-cyan-950/50 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                : "bg-zinc-950 border-white/5"
                        )}>
                            {coverImage ? (
                                <img src={coverImage} alt={subtitle} className="w-full h-full object-cover" />
                            ) : (
                                <ModIcon className={cn("w-6 h-6", isDonjon ? "text-indigo-400" : "text-cyan-400")} />
                            )}
                        </div>
                        <div className="min-w-0 pr-16 flex-1">
                            <h3 className={cn(
                                "font-black text-white text-base truncate leading-tight tracking-tight drop-shadow-sm transition-colors duration-300",
                                isOpen && (isDonjon ? "group-hover:text-indigo-300" : "group-hover:text-cyan-300")
                            )} title={title || ""}>
                                {title}
                            </h3>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate mt-1">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                        {post.isDiscordPublished && post.discordMessageId && post.discordChannelId && (
                            <a 
                                href={`https://discord.com/channels/${guildId}/${post.discordChannelId}/${post.discordMessageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#5865F2]/10 hover:bg-[#5865F2] border border-[#5865F2]/20 text-white transition-all duration-300 group/discord shadow-lg hover:shadow-[#5865F2]/20"
                                title="Voir sur Discord"
                            >
                                <svg className="w-4 h-4 transition-transform group-hover/discord:scale-110" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.966 2.419-2.156 2.419m7.974 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.156 2.419"/>
                                </svg>
                            </a>
                        )}
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider shadow-xl backdrop-blur-md transition-all duration-300",
                            post.status === "OPEN"
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                                : post.status === "FULL"
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                : post.status === "CLOSED"
                                ? "text-zinc-500 bg-zinc-900/60 border-zinc-800"
                                : "text-zinc-600 bg-zinc-950/60 border-zinc-900"
                        )}>
                            <span className={cn(
                                "w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]",
                                post.status === "OPEN" ? "bg-emerald-400 animate-pulse" : post.status === "FULL" ? "bg-amber-400" : "bg-zinc-500"
                            )} />
                            {statusMeta.label}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1 gap-5">
                    {/* Mode + Slots */}
                    <div className="flex items-center justify-between">
                        <span className={cn(
                            "inline-flex items-center gap-2 text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-xl border shadow-sm transition-all group-hover:scale-105 duration-300", 
                            modeMeta.color
                        )}>
                            <ModIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                            {modeMeta.label}
                        </span>
                        
                        <div className={cn(
                            "flex items-center gap-2 text-[11px] font-black px-3 py-1.5 rounded-xl shadow-inner group/slots border transition-all duration-300",
                            spotsLeft > 0 && isOpen
                                ? "text-zinc-300 bg-emerald-950/10 border-emerald-500/20 shadow-emerald-500/5"
                                : "text-zinc-400 bg-zinc-950 border-white/10"
                        )}>
                            <Users className="w-3.5 h-3.5 text-zinc-500 group-hover/slots:text-white transition-colors" />
                            <span className={spotsLeft === 0 ? "text-amber-500 font-black" : "text-white"}>
                                {acceptedCount} <span className="text-zinc-600 font-normal mx-0.5">/</span> {post.maxMembers}
                            </span>
                            {spotsLeft > 0 && (
                                <span className="text-emerald-400 ml-1">+{spotsLeft}</span>
                            )}
                        </div>
                    </div>

                    {/* Participants Bubbles */}
                    <div className="flex -space-x-2 overflow-hidden py-1">
                        {/* Leader */}
                        <div key={post.profileId} className="relative group/avatar" title={`${post.profile.pseudoDofus || post.profile.discordNickname} (LEAD)`}>
                            <Avatar className="h-9 w-9 ring-2 ring-indigo-500 hover:ring-indigo-400 transition-all border-2 border-zinc-950 shadow-lg">
                                <AvatarImage src={post.profile.user.image || undefined} />
                                <AvatarFallback className="bg-indigo-950 text-indigo-300 text-[10px] font-black">
                                    {(post.profile.pseudoDofus || post.profile.discordNickname || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-indigo-500 rounded-full p-1 border-2 border-zinc-950 shadow-lg">
                                <Crown className="w-2.5 h-2.5 text-white" />
                            </div>
                        </div>

                        {/* Others */}
                        {post.participants.map((p) => (
                            <div key={p.id} className="relative group/avatar" title={p.profile.pseudoDofus || p.profile.discordNickname || "Membre"}>
                                <Avatar className="h-9 w-9 ring-2 ring-zinc-800 hover:ring-indigo-500/50 transition-all border-2 border-zinc-950 shadow-lg">
                                    <AvatarImage src={p.profile.user.image || undefined} />
                                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px] font-bold">
                                        {(p.profile.pseudoDofus || p.profile.discordNickname || "??").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        ))}

                        {/* Empty Spots */}
                        {Array.from({ length: Math.min(spotsLeft, 10) }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-9 h-9 rounded-full border-2 border-dashed border-white/5 bg-white/[0.02] flex items-center justify-center transition-colors hover:border-white/10">
                                <Users className="w-3.5 h-3.5 text-white/[0.03]" />
                            </div>
                        ))}
                    </div>

                    {/* Wanted achievements */}
                    {post.wantedAchievementIds.length > 0 && post.dungeon && (
                        <div className="flex gap-1.5 flex-wrap">
                            {post.dungeon.achievements
                                .filter((a) => post.wantedAchievementIds.includes(a.id))
                                .slice(0, 5)
                                .map((a) => (
                                    <div
                                        key={a.id}
                                        title={a.challenge.name}
                                        className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-1 shrink-0 shadow-sm transition-transform hover:scale-110"
                                    >
                                        {a.challenge.iconUrl && (
                                            <img src={a.challenge.iconUrl} alt={a.challenge.name} className="w-full h-full object-contain" />
                                        )}
                                    </div>
                                ))}
                            {post.wantedAchievementIds.length > 5 && (
                                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-400 border border-white/5 shadow-inner">
                                    +{post.wantedAchievementIds.length - 5}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Required Classes */}
                    {post.requiredClasses && post.requiredClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {post.requiredClasses.map(c => {
                                const cls = getClass(c);
                                return (
                                    <div key={c} title={c} className="w-7 h-7 rounded-lg bg-zinc-950 border border-white/5 p-1 overflow-hidden shadow-inner transition-transform hover:scale-110">
                                        {cls ? (
                                            <img src={cls.icon} alt={c} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-[10px] font-black flex items-center justify-center h-full w-full rounded text-white"
                                                style={{ backgroundColor: `hsl(${(c.charCodeAt(0) * 47) % 360}, 55%, 35%)` }}>
                                                {c[0]?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Quest link & Dungeon Guide Links (DofusDB, Dofuspourlesnoobs, Dofensive) */}
                    <div className="pt-1 flex flex-wrap gap-2">
                        {post.dungeon?.dofuspourlesnoobsUrl && (
                            <a href={post.dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-white bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 w-max transition-all shadow-lg hover:bg-amber-500 hover:border-amber-400 hover:scale-[1.03] shadow-amber-500/5 hover:shadow-amber-500/20">
                                <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                Guide DPNL
                            </a>
                        )}
                        {post.dungeon?.dofensiveUrl && (
                            <a href={post.dungeon.dofensiveUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-white bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 w-max transition-all shadow-lg hover:bg-emerald-500 hover:border-emerald-400 hover:scale-[1.03] shadow-emerald-500/5 hover:shadow-emerald-500/20">
                                <span className="text-xs">🛡️</span>
                                Dofensive
                            </a>
                        )}
                        {(post.questId && post.questId > 0) || (post.mode === "QUETE" && post.questUrl) ? (
                            <>
                                {post.questId && post.questId > 0 ? (
                                    <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                            "inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 w-max transition-all border shadow-lg hover:scale-[1.03]",
                                            isDonjon
                                                ? "text-cyan-400 hover:text-white bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500 hover:border-cyan-400 shadow-cyan-500/5 hover:shadow-cyan-500/20"
                                                : "text-zinc-400 hover:text-white bg-zinc-950 border-white/10 hover:bg-zinc-800"
                                        )}>
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="DofusDB" className="w-3.5 h-3.5 rounded-sm" />
                                        {isDonjon && post.questName ? post.questName : "Ouvrir DofusDB"}
                                    </a>
                                ) : post.questUrl && !post.dungeon?.dofuspourlesnoobsUrl && (
                                    <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-white bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 w-max transition-all shadow-lg hover:bg-amber-500 hover:border-amber-400 hover:scale-[1.03] shadow-amber-500/5 hover:shadow-amber-500/20">
                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="DPLN" className="w-3.5 h-3.5 rounded-sm" />
                                        DofusPourLesNoobs
                                    </a>
                                )}
                            </>
                        ) : null}
                    </div>

                    {/* Message */}
                    {post.message && (
                        <div className={cn(
                            "text-[11px] text-zinc-300 italic border-l-4 pl-4 py-2 line-clamp-2 leading-relaxed rounded-r-lg shadow-inner",
                            isOpen
                                ? isDonjon
                                    ? "border-indigo-500/40 bg-indigo-500/[0.02]"
                                    : "border-cyan-500/40 bg-cyan-500/[0.02]"
                                : "border-zinc-700 bg-zinc-950/50"
                        )}>
                            "{post.message}"
                        </div>
                    )}

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Target date */}
                    {post.targetDate && (
                        <div className={cn(
                            "flex items-center justify-center gap-2.5 text-[11px] font-black w-full px-4 py-2.5 rounded-xl border shadow-inner mt-2 group/date transition-colors duration-300",
                            isOpen
                                ? isDonjon
                                    ? "text-indigo-300 bg-indigo-500/5 border-indigo-500/20"
                                    : "text-cyan-300 bg-cyan-500/5 border-cyan-500/20"
                                : "text-zinc-500 bg-zinc-950 border-zinc-900"
                        )}>
                            <Calendar className={cn(
                                "w-4 h-4 shrink-0 group-hover/date:scale-110 transition-transform",
                                isOpen ? (isDonjon ? "text-indigo-400" : "text-cyan-400") : "text-zinc-600"
                            )} />
                            <span className="uppercase tracking-tight">
                                {new Date(post.targetDate).toLocaleDateString("fr-FR", {
                                    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                                }).replace(/, /g, " à ")}
                            </span>
                        </div>
                    )}

                    {/* Creator Header (pushed to bottom) */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-auto">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0 ring-1 ring-white/10 shadow-lg">
                            {post.profile.user.image && (
                                <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <span className="text-[11px] font-black text-zinc-400 truncate flex-1 tracking-tight">
                            {isOwner && <Crown className="w-3 h-3 inline mr-1 text-amber-500 -mt-1" />}
                            {post.profile.pseudoDofus || post.profile.discordNickname || "Inconnu"}
                        </span>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1 shrink-0 font-bold uppercase tracking-tighter">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDistanceToNow(new Date(post.createdAt), { locale: fr, addSuffix: true })}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDetailOpen(true)}
                            className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest bg-zinc-950 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900 shadow-lg transition-all"
                        >
                            Détails
                        </Button>

                        {post.status === "OPEN" && !isOwner && !myParticipation && (
                            <Button
                                size="sm"
                                onClick={handleQuickJoin}
                                disabled={isPending}
                                className={cn(
                                    "flex-1 h-10 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all duration-300 hover:scale-[1.03] active:scale-95",
                                    isDonjon 
                                        ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-500/25 hover:shadow-indigo-500/40" 
                                        : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-cyan-500/25 hover:shadow-cyan-500/40"
                                )}
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                Rejoindre
                            </Button>
                        )}

                        {myParticipation && myParticipation.status === "PENDING" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 h-10 text-[11px] font-black uppercase tracking-widest border-rose-500/30 text-rose-400 hover:text-white hover:bg-rose-600 transition-all shadow-lg"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Annuler
                            </Button>
                        )}

                        {myParticipation?.status === "ACCEPTED" && (
                            <div className="flex-1 flex items-center justify-center h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-black text-[10px] uppercase tracking-widest shadow-lg">
                                <CheckCircle2 className="w-4 h-4 mr-2 shadow-[0_0_10px_currentColor]" /> Accepté
                            </div>
                        )}

                        {myParticipation?.status === "REJECTED" && (
                            <div className="flex-1 flex items-center justify-center h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 font-black text-[10px] uppercase tracking-widest">
                                <XCircle className="w-4 h-4 mr-2" /> Refusé
                            </div>
                        )}

                        {isOwner && post.status === "OPEN" && (
                            <div className="flex flex-1 gap-2">
                                {post.participants.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleReminder}
                                        disabled={isPending}
                                        title="Envoyer un rappel aux participants sur Discord"
                                        className="h-10 px-3 border-indigo-500/20 text-indigo-400 hover:text-white hover:bg-indigo-600 transition-all shadow-lg"
                                    >
                                        <Bell className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={() => setIsCloseModalOpen(true)}
                                    disabled={isPending}
                                    title="Valider et donner des points"
                                    className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-400 shadow-emerald-500/5 hover:shadow-emerald-500/20 transition-all"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Terminer
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={isPending}
                                    title="Fermer sans donner de points"
                                    className="h-10 px-3 border-rose-500/20 text-rose-400 hover:text-white hover:bg-rose-600 transition-all shadow-lg"
                                >
                                    <XCircle className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                        {isAdmin && !isOwner && post.status === "OPEN" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleClose}
                                disabled={isPending}
                                className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest border-zinc-800 text-zinc-500 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition-all shadow-lg"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Fermer
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>

            <DjPostDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                post={post}
                guildId={guildId}
                currentProfileId={currentProfileId}
                isAdmin={isAdmin}
                onRefresh={onRefresh}
            />

            {isOwner && (
                <DjCloseModal
                    isOpen={isCloseModalOpen}
                    post={post}
                    guildId={guildId}
                    onClose={() => setIsCloseModalOpen(false)}
                    onClosed={onRefresh}
                />
            )}
        </>
    );
}

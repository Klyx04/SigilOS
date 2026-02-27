"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Swords, Map, Users, Clock, Calendar, CheckCircle2,
    XCircle, LogIn, LogOut, Crown, Link2
} from "lucide-react";
import { closeDjPost, joinDjPost, leaveDjPost } from "@/server/actions/dungeon-finder-actions";
import { DjPostDetailModal } from "./DjPostDetailModal";
import { DjCloseModal } from "./DjCloseModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getClass } from "@/lib/dofus-assets";

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const MODE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    DONJON: { label: "Donjon", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: Swords },
    QUETE: { label: "Quête", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: Map },
};

const STATUS_META: Record<string, { label: string; dot: string }> = {
    OPEN: { label: "Ouvert", dot: "bg-emerald-500" },
    FULL: { label: "Complet", dot: "bg-yellow-500" },
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
}

export function DjPostCard({ post, guildId, currentProfileId, isAdmin, onRefresh }: DjPostCardProps) {
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

    const title = post.mode === "DONJON" ? post.dungeon?.name : post.questName;
    const subtitle = post.mode === "DONJON" ? `${post.dungeon?.bossName} · Lvl ${post.dungeon?.level}` : "Quête";
    const coverImage = post.dungeon?.imageUrl;

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative rounded-2xl border bg-slate-900/60 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col ${post.status === "OPEN"
                    ? "border-white/10 hover:border-indigo-500/40 hover:bg-slate-900/80 h-full"
                    : "border-white/5 opacity-70 h-full"
                    }`}
            >
                {/* Glow accent (top-left) */}
                <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full pointer-events-none"
                    style={{ background: post.status === "OPEN" ? "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)" : "none" }}
                />

                {/* Banner */}
                <div className="relative h-24 bg-slate-950/80 overflow-hidden flex items-center shrink-0 border-b border-white/5">
                    {coverImage && (
                        <img
                            src={coverImage}
                            alt={subtitle}
                            className="absolute inset-0 w-full h-full object-cover opacity-25 scale-105 group-hover:scale-110 transition-transform duration-700"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                    <div className="relative flex items-center gap-4 px-5 w-full">
                        <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 flex flex-col items-center justify-center border shadow-lg ${post.mode === "DONJON" ? "bg-slate-800/80 border-white/10" : "bg-cyan-950/80 border-cyan-500/30 shadow-cyan-900/20"}`}>
                            {coverImage ? (
                                <img src={coverImage} alt={subtitle} className="w-full h-full object-cover" />
                            ) : (
                                <ModIcon className={`w-6 h-6 ${post.mode === "DONJON" ? "text-slate-400" : "text-cyan-400"}`} />
                            )}
                        </div>
                        <div className="min-w-0 pr-16 flex-1 drop-shadow-md">
                            <h3 className="font-black text-white text-[15px] truncate leading-tight" title={title || ""}>{title}</h3>
                            <p className="text-xs font-medium text-slate-300 truncate mt-0.5">{subtitle}</p>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-300 backdrop-blur-md">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} shadow-[0_0_8px_currentColor]`} />
                        {statusMeta.label}
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1 gap-4">
                    {/* Mode + Slots */}
                    <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-lg border ${modeMeta.color}`}>
                            <ModIcon className="w-3 h-3" strokeWidth={2.5} />
                            {modeMeta.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                            <Users className="w-3.5 h-3.5 text-slate-300" />
                            <span className={spotsLeft === 0 ? "text-amber-400" : "text-white"}>
                                {acceptedCount}/{post.maxMembers}
                            </span>
                            {spotsLeft > 0 && (
                                <span className="text-emerald-400 ml-1">+{spotsLeft}</span>
                            )}
                        </div>
                    </div>

                    {/* Wanted achievements */}
                    {post.wantedAchievementIds.length > 0 && post.dungeon && (
                        <div className="flex gap-1 flex-wrap">
                            {post.dungeon.achievements
                                .filter((a) => post.wantedAchievementIds.includes(a.id))
                                .slice(0, 5)
                                .map((a) => (
                                    <div
                                        key={a.id}
                                        title={a.challenge.name}
                                        className="w-6 h-6 rounded bg-yellow-950/40 border border-yellow-900/40 p-0.5 shrink-0"
                                    >
                                        {a.challenge.iconUrl && (
                                            <img src={a.challenge.iconUrl} alt={a.challenge.name} className="w-full h-full object-contain" />
                                        )}
                                    </div>
                                ))}
                            {post.wantedAchievementIds.length > 5 && (
                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[9px] text-slate-500 border border-slate-700">
                                    +{post.wantedAchievementIds.length - 5}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Required Classes */}
                    {post.requiredClasses && post.requiredClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {post.requiredClasses.map(c => {
                                const cls = getClass(c);
                                return (
                                    <div key={c} title={c} className="w-6 h-6 rounded-md bg-indigo-950/30 border border-indigo-900/30 p-0.5 overflow-hidden">
                                        {cls ? (
                                            <img src={cls.icon} alt={c} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-[8px] font-bold flex items-center justify-center h-full w-full rounded text-white"
                                                style={{ backgroundColor: `hsl(${(c.charCodeAt(0) * 47) % 360}, 55%, 35%)` }}>
                                                {c[0]?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Quest link — Quête MANUELLE avec lien dofuspourlesnoobs */}
                    {post.mode === "QUETE" && (!post.questId || post.questId <= 0) && post.questUrl && post.questUrl.includes("dofuspourlesnoobs") && (
                        <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium bg-amber-950/20 border border-amber-900/30 rounded-lg px-2 py-1.5 w-max transition-colors">
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                            Voir la quête
                        </a>
                    )}

                    {/* Quest link — DofusDB (questId connu et valide) */}
                    {post.questId && post.questId > 0 && (post.mode === "QUETE" || post.mode === "DONJON") && (
                        <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-1.5 w-max transition-colors border ${post.mode === "DONJON"
                                ? "text-cyan-400 hover:text-cyan-300 bg-cyan-500/5 border-cyan-500/20"
                                : "text-slate-400 hover:text-white bg-white/5 border-white/10"
                                }`}>
                            <Map className="w-3 h-3" />
                            {post.mode === "DONJON" && post.questName
                                ? <span className="truncate max-w-[120px]">{post.questName}</span>
                                : "Ouvrir sur DofusDB"
                            }
                        </a>
                    )}

                    {/* Message */}
                    {post.message && (
                        <div className="text-xs text-slate-300 italic border-l-2 border-indigo-500/50 pl-3 py-0.5 line-clamp-2 leading-relaxed opacity-90">
                            "{post.message}"
                        </div>
                    )}

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Target date */}
                    {post.targetDate && (
                        <div className="flex items-center justify-center gap-2 text-[11px] text-indigo-200 font-bold bg-indigo-500/10 w-full px-3 py-2 rounded-xl border border-indigo-500/20">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                            {new Date(post.targetDate).toLocaleDateString("fr-FR", {
                                weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                            }).replace(/, /g, " à ")}
                        </div>
                    )}

                    {/* Creator Header (pushed to bottom) */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/10 mt-2">
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-700 shrink-0 ring-1 ring-white/10">
                            {post.profile.user.image && (
                                <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-300 truncate flex-1">
                            {isOwner && <Crown className="w-3 h-3 inline mr-1 text-yellow-500/80 -mt-0.5" />}
                            {post.profile.pseudoDofus || post.profile.discordNickname || "Inconnu"}
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 font-medium">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDistanceToNow(new Date(post.createdAt), { locale: fr, addSuffix: true })}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDetailOpen(true)}
                            className="flex-1 h-9 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300"
                        >
                            Détails
                        </Button>

                        {post.status === "OPEN" && !isOwner && !myParticipation && (
                            <Button
                                size="sm"
                                onClick={handleQuickJoin}
                                disabled={isPending}
                                className={`flex-1 h-9 text-xs font-black text-white shadow-md ${post.mode === "DONJON" ? "bg-indigo-600 hover:bg-indigo-500" : "bg-cyan-600 hover:bg-cyan-500"}`}
                            >
                                <LogIn className="w-3.5 h-3.5 mr-1" />
                                Rejoindre
                            </Button>
                        )}

                        {myParticipation && myParticipation.status === "PENDING" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLeave}
                                disabled={isPending}
                                className="flex-1 h-9 text-xs font-bold border-rose-900/50 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                            >
                                <LogOut className="w-3.5 h-3.5 mr-1" />
                                Annuler
                            </Button>
                        )}

                        {myParticipation?.status === "ACCEPTED" && (
                            <Badge className="flex-1 justify-center h-8 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Accepté
                            </Badge>
                        )}

                        {myParticipation?.status === "REJECTED" && (
                            <Badge className="flex-1 justify-center h-8 bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-[11px]">
                                <XCircle className="w-3 h-3 mr-1" /> Refusé
                            </Badge>
                        )}

                        {isOwner && post.status === "OPEN" && (
                            <Button
                                size="sm"
                                onClick={() => setIsCloseModalOpen(true)}
                                disabled={isPending}
                                className="flex-1 h-8 text-xs font-bold bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 hover:border-violet-500/50"
                            >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Terminer
                            </Button>
                        )}
                        {isAdmin && !isOwner && post.status === "OPEN" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleClose}
                                disabled={isPending}
                                className="flex-1 h-8 text-xs font-bold border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-900"
                            >
                                <XCircle className="w-3 h-3 mr-1" />
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

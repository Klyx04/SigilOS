"use client";

import { cn } from "@/lib/utils";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Users, CheckCircle2, XCircle, Crown, Swords, Clock,
    Trophy, Map, Link2, LogIn, LogOut, Trash2, Pencil, Bell
} from "lucide-react";
import {
    acceptDjParticipant,
    rejectDjParticipant,
    closeDjPost,
    joinDjPost,
    leaveDjPost,
    deleteDjPost,
    sendDjReminder,
} from "@/server/actions/dungeon-finder-actions";
import { DjCloseModal } from "./DjCloseModal";
import { DjEditModal } from "./DjEditModal";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";

const MODE_LABELS: Record<string, string> = {
    FARM: "Farm", SUCCES: "Succès", MIXED: "Mixte", QUETE: "Quête", DONJON: "Donjon",
};
const STATUS_COLORS: Record<string, string> = {
    PENDING: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    ACCEPTED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    REJECTED: "text-red-400 bg-red-500/10 border-red-500/20",
};

// Helper: Discord server nick > Dofus pseudo (set on registration) > Dofus in-game pseudo
function displayName(profile: { discordNickname?: string | null; pseudoDofus?: string | null; dofusPseudo?: string | null }) {
    return profile.discordNickname || profile.pseudoDofus || profile.dofusPseudo || "Membre";
}

interface DjPostDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: DjPostWithDetails;
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
    onRefresh: () => void;
}

export function DjPostDetailModal({
    isOpen, onClose, post, guildId, currentProfileId, isAdmin, onRefresh
}: DjPostDetailModalProps) {
    const [classe, setClasse] = useState("");
    const [message, setMessage] = useState("");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = post.profileId === currentProfileId;
    const myParticipation = currentProfileId
        ? post.participants.find((p) => p.profile.id === currentProfileId)
        : null;

    // Creator counts as 1 slot, participants are separate
    const acceptedParticipants = post.participants.filter((p) => p.status === "ACCEPTED");
    const acceptedCount = acceptedParticipants.length + 1; // +1 for creator
    const spotsLeft = post.maxMembers - acceptedCount;

    function handleJoin() {
        startTransition(async () => {
            const res = await joinDjPost(guildId, post.id, { classe: classe || null, message: message || null });
            if (res.success) {
                toast.success("Candidature envoyée !");
                onRefresh();
                onClose();
            } else {
                toast.error(res.error);
            }
        });
    }

    function handleLeave() {
        startTransition(async () => {
            const res = await leaveDjPost(guildId, post.id);
            if (res.success) { toast.success("Parti du post."); onRefresh(); onClose(); }
            else toast.error(res.error);
        });
    }

    function handleDelete() {
        if (!confirm("Voulez-vous vraiment supprimer ce post définitivement ?")) return;
        startTransition(async () => {
            const res = await deleteDjPost(guildId, post.id);
            if (res.success) {
                toast.success("Post supprimé définitivement.");
                onRefresh();
                onClose();
            } else toast.error(res.error);
        });
    }

    function handleAccept(participantId: string) {
        startTransition(async () => {
            const res = await acceptDjParticipant(guildId, post.id, participantId);
            if (res.success) { toast.success("Participant accepté !"); onRefresh(); }
            else toast.error(res.error);
        });
    }

    function handleReject(participantId: string) {
        startTransition(async () => {
            const res = await rejectDjParticipant(guildId, post.id, participantId);
            if (res.success) { toast.success("Participant retiré."); onRefresh(); }
            else toast.error(res.error);
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

    const visibleParticipants = post.participants.filter(p => p.status !== "REJECTED");

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[95vw] max-w-2xl bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white overflow-y-auto max-h-[90vh] p-0 gap-0 custom-scrollbar">

                    {/* Hero Image / Banner */}
                    <div className="relative h-28 bg-slate-900 border-b border-white/5 overflow-hidden shrink-0">
                        {post.mode === "DONJON" && post.dungeon?.imageUrl && (
                            <img src={post.dungeon?.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

                        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
                            <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border shadow-lg ${post.mode === "DONJON" ? "bg-slate-800/80 border-white/10" : "bg-cyan-950/80 border-cyan-500/30"}`}>
                                {post.mode === "DONJON" && post.dungeon?.imageUrl ? (
                                    <img src={post.dungeon?.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : post.mode === "DONJON" ? (
                                    <Swords className="w-6 h-6 text-slate-400" />
                                ) : (
                                    <Map className="w-6 h-6 text-cyan-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                                <h2 className="text-xl font-black text-white truncate drop-shadow-md">
                                    {post.mode === "DONJON" ? post.dungeon?.name : post.questName || "Quête"}
                                </h2>
                                <p className="text-sm font-medium text-slate-300">
                                    {post.mode === "DONJON" ? `Niv. ${post.dungeon?.level} — ${post.dungeon?.bossName}` : "Mode Quête"}
                                </p>
                            </div>
                            <Badge className={`mb-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 backdrop-blur-md ${post.status === "OPEN" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-white/5 text-slate-400 border-white/10"}`}>
                                {post.status === "OPEN" ? "Ouvert" : post.status === "FULL" ? "Complet" : "Fermé"}
                            </Badge>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-slate-900/40 rounded-xl p-4 border border-white/5 shadow-inner">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Mode</p>
                                <p className="font-black text-white text-base">{MODE_LABELS[post.mode] ?? post.mode}</p>
                            </div>
                            <div className="bg-slate-900/40 rounded-xl p-4 border border-white/5 shadow-inner">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Places</p>
                                <p className={`font-black text-base ${spotsLeft === 0 ? "text-amber-400" : "text-emerald-400"}`}>
                                    {acceptedCount}/{post.maxMembers} — {spotsLeft > 0 ? <span className="text-slate-300 font-medium">{`${spotsLeft} dispo${spotsLeft > 1 ? "s" : ""}`}</span> : "Complet"}
                                </p>
                            </div>
                            {post.targetDate && (
                                <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10 col-span-2 shadow-inner">
                                    <p className="text-indigo-400/80 text-[10px] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Date prévue</p>
                                    <p className="font-bold text-indigo-300">
                                        {new Date(post.targetDate).toLocaleDateString("fr-FR", {
                                            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                                        }).replace(/, /g, " à ")}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Quest info */}
                        {post.questName && (
                            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex flex-1 items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-950/50 flex items-center justify-center shrink-0 border border-cyan-900/50">
                                        <Map className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <div>
                                        {post.mode === "DONJON" && (
                                            <p className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-widest mb-0.5">Quête associée</p>
                                        )}
                                        <span className="text-sm text-cyan-300 font-bold">{post.questName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {post.questUrl && post.questUrl.includes("dofuspourlesnoobs") && (
                                        <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 border border-amber-900/40 hover:border-amber-500/50 bg-amber-950/20 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5">
                                            <Link2 className="w-3.5 h-3.5" /> Tutoriel
                                        </a>
                                    )}
                                    {post.questId && post.questId !== -1 && (
                                        <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-slate-300 hover:text-white border border-white/5 hover:border-white/10 bg-white/5 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5">
                                            <Map className="w-3.5 h-3.5" /> DofusDB
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Message */}
                        {post.message && (
                            <div className="bg-slate-900/40 rounded-xl p-4 border-l-2 border-indigo-500 shadow-inner">
                                <p className="text-sm text-slate-300 leading-relaxed italic opacity-90">"{post.message}"</p>
                            </div>
                        )}

                        {/* Wanted achievements */}
                        {post.wantedAchievementIds.length > 0 && post.dungeon && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Succès visés</p>
                                <div className="flex gap-2 flex-wrap">
                                    {post.dungeon.achievements
                                        .filter((a) => post.wantedAchievementIds.includes(a.id))
                                        .map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 shadow-sm">
                                                {a.challenge.iconUrl && (
                                                    <img src={a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                                )}
                                                <span className="text-xs text-amber-300 font-bold">{a.challenge.name}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Required classes */}
                        {post.requiredClasses && post.requiredClasses.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Classes demandées</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {post.requiredClasses.map((c) => {
                                        const classData = getClass(c);
                                        return (
                                            <div key={c} className="flex items-center bg-indigo-500/10 border border-indigo-500/20 rounded-md p-1 shadow-sm px-2 gap-1.5">
                                                <div className="w-4 h-4 rounded overflow-hidden">
                                                    <img src={classData?.icon} alt={classData?.name || c} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </div>
                                                <span className="text-[11px] text-indigo-200 font-medium">{classData?.name || c}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Participants list */}
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                                <Users className="w-3 h-3" /> Participants ({acceptedCount}/{post.maxMembers})
                            </p>
                            <div className="space-y-1.5">
                                {/* Creator row */}
                                <div className="flex items-center gap-4 bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 shadow-sm relative overflow-hidden">
                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                        {post.profile.user.image && <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0 z-10">
                                        <p className="text-sm font-black text-white truncate drop-shadow-sm">{displayName(post.profile)}</p>
                                        <span className="text-[10px] text-amber-500/80 font-bold flex items-center mt-0.5"><Crown className="w-3 h-3 mr-1 inline" /> Créateur du groupe</span>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
                                </div>

                                {/* Participants */}
                                {visibleParticipants.map((p) => (
                                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-900/40 rounded-xl p-3 border border-white/5 hover:bg-slate-900/60 transition-colors group">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0 ring-1 ring-white/10">
                                                {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">{displayName(p.profile)}</p>
                                                    {p.classe && <Badge variant="outline" className="text-[9px] h-4 border-slate-700 text-slate-400 px-1.5">{p.classe}</Badge>}
                                                </div>
                                                {p.message && <p className="text-[11px] text-slate-500 italic truncate mt-0.5 leading-tight">"{p.message}"</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                            <Badge className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[p.status] || STATUS_COLORS.PENDING}`}>
                                                {p.status === "PENDING" ? "En attente" : p.status === "ACCEPTED" ? "Approuvé" : "Refusé"}
                                            </Badge>

                                            {/* Owner actions */}
                                            {(isOwner || isAdmin) && post.status === "OPEN" && (
                                                <div className="flex gap-1 shrink-0 bg-slate-900/80 rounded-lg border border-white/5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                                                    {p.status === "PENDING" && (
                                                        <Button size="icon" variant="ghost"
                                                            className="w-8 h-8 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md"
                                                            onClick={() => handleAccept(p.id)} disabled={isPending}>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button size="icon" variant="ghost"
                                                        className="w-8 h-8 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-md"
                                                        onClick={() => handleReject(p.id)} disabled={isPending}
                                                        title={p.status === "PENDING" ? "Refuser" : "Retirer"}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {visibleParticipants.length === 0 && (
                                    <p className="text-center text-sm text-slate-600 py-4">Aucun participant pour l'instant</p>
                                )}
                            </div>
                        </div>

                        {/* Join form */}
                        {!isOwner && !myParticipation && post.status === "OPEN" && spotsLeft > 0 && (
                            <div className="border-t border-white/5 pt-6 space-y-4">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Candidature</p>
                                <div className="bg-slate-900/40 rounded-xl p-4 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-inner">
                                    <div className="sm:col-span-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Ta classe</label>
                                        <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-slate-900 border border-white/10 shadow-inner">
                                            {DOFUS_CLASSES.map((c) => {
                                                const isSelected = classe === c.name;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        title={c.name}
                                                        onClick={() => setClasse(isSelected ? "" : c.name)}
                                                        className={cn(
                                                            "aspect-square rounded-lg flex items-center justify-center transition-all border group/class",
                                                            isSelected 
                                                                ? "border-indigo-500/50 bg-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)] scale-110 z-10" 
                                                                : "border-transparent opacity-40 hover:opacity-100 hover:bg-white/5 hover:border-white/10"
                                                        )}
                                                    >
                                                        <img 
                                                            src={c.icon} 
                                                            alt={c.name} 
                                                            className="w-5 h-5 object-contain drop-shadow-md group-hover/class:scale-110 transition-transform" 
                                                            onError={(e) => e.currentTarget.style.display = 'none'} 
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1.5">Message (opt.)</label>
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                                            placeholder="Ex: Dispo toute la soirée, j'ai le stuff..."
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner"
                                        />
                                    </div>
                                </div>
                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 font-black h-12 shadow-lg shadow-indigo-900/20"
                                    onClick={handleJoin}
                                    disabled={isPending}
                                >
                                    <LogIn className="w-5 h-5 mr-2" />
                                    Envoyer ma candidature
                                </Button>
                            </div>
                        )}

                        {/* My pending status */}
                        {myParticipation?.status === "PENDING" && (
                            <div className="border-t border-white/5 pt-5 flex items-center justify-between">
                                <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Candidature en cours d'examen...
                                </p>
                                <Button size="sm" variant="outline" onClick={handleLeave} disabled={isPending}
                                    className="border-rose-900/50 bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300">
                                    <LogOut className="w-4 h-4 mr-1.5" /> Se retirer
                                </Button>
                            </div>
                        )}

                        {/* Creator actions */}
                        {(isOwner || isAdmin) && post.status === "OPEN" && (
                            <div className="border-t border-white/5 pt-5 flex gap-3">
                                {isOwner && (
                                    <>
                                        {post.isDiscordPublished && post.discordMessageId && acceptedCount > 1 && (
                                            <Button
                                                variant="outline"
                                                className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 font-bold h-11 transition-all px-4"
                                                onClick={handleReminder}
                                                disabled={isPending}
                                                title="Envoyer un rappel aux participants sur Discord"
                                            >
                                                <Bell className="w-4 h-4 mr-2" />
                                                Rappel
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-11 transition-all"
                                            onClick={() => setIsEditModalOpen(true)}
                                            disabled={isPending}
                                        >
                                            <Pencil className="w-4 h-4 mr-2" strokeWidth={2.5} />
                                            Modifier le groupe
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="outline"
                                    className="flex-1 border-rose-900/40 bg-rose-950/20 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300 font-bold h-11 transition-all"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer le groupe
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {isOwner && (
                <DjEditModal
                    isOpen={isEditModalOpen}
                    post={post}
                    guildId={guildId}
                    onClose={() => setIsEditModalOpen(false)}
                    onSaved={() => { onRefresh(); }}
                />
            )}
        </>
    );
}

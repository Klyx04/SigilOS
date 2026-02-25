"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Users, CheckCircle2, XCircle, Crown, Swords, Clock,
    Trophy, Map, Link2, LogIn, LogOut, Trash2, Pencil
} from "lucide-react";
import {
    acceptDjParticipant,
    rejectDjParticipant,
    closeDjPost,
    joinDjPost,
    leaveDjPost,
    deleteDjPost,
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

    const visibleParticipants = post.participants.filter(p => p.status !== "REJECTED");

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[95vw] max-w-2xl bg-slate-950 border-slate-800 text-white overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border ${post.mode === "DONJON" ? "bg-slate-800 border-slate-700" : "bg-cyan-950 border-cyan-900/50"}`}>
                                {post.mode === "DONJON" && post.dungeon?.imageUrl ? (
                                    <img src={post.dungeon?.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : post.mode === "DONJON" ? (
                                    <Swords className="w-4 h-4 text-slate-500" />
                                ) : (
                                    <Map className="w-4 h-4 text-cyan-500/70" />
                                )}
                            </div>
                            {post.mode === "DONJON" ? post.dungeon?.name : post.questName || "Quête"}
                            <Badge className={`ml-auto text-[10px] font-bold ${post.status === "OPEN" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                                {post.status === "OPEN" ? "Ouvert" : post.status === "FULL" ? "Complet" : "Fermé"}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">Mode</p>
                                <p className="font-bold text-white">{MODE_LABELS[post.mode] ?? post.mode}</p>
                            </div>
                            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">Places</p>
                                <p className={`font-bold ${spotsLeft === 0 ? "text-yellow-400" : "text-emerald-400"}`}>
                                    {acceptedCount}/{post.maxMembers} — {spotsLeft > 0 ? `${spotsLeft} disponible${spotsLeft > 1 ? "s" : ""}` : "Complet"}
                                </p>
                            </div>
                            {post.targetDate && (
                                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 col-span-2">
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">Date souhaitée</p>
                                    <p className="font-bold text-cyan-400">
                                        {new Date(post.targetDate).toLocaleDateString("fr-FR", {
                                            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Quest info */}
                        {post.questName && (
                            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 flex flex-wrap items-center gap-3">
                                <div className="flex flex-1 items-center gap-2">
                                    <Map className="w-4 h-4 text-cyan-400 shrink-0" />
                                    <div>
                                        {post.mode === "DONJON" && (
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Quête associée</p>
                                        )}
                                        <span className="text-sm text-cyan-300 font-medium">{post.questName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-auto">
                                    {post.questUrl && (
                                        <a href={post.questUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-slate-400 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/50 bg-slate-900 rounded-md px-2 py-1 transition-colors flex items-center gap-1.5">
                                            <Link2 className="w-3 h-3" /> Tutoriel
                                        </a>
                                    )}
                                    {post.questId && post.questId !== -1 && (
                                        <a href={`https://dofusdb.fr/fr/database/quest/${post.questId}`} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-900 rounded-md px-2 py-1 transition-colors flex items-center gap-1.5">
                                            <Map className="w-3 h-3" /> DofusDB
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Message */}
                        {post.message && (
                            <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800">
                                <p className="text-sm text-slate-300 leading-relaxed">{post.message}</p>
                            </div>
                        )}

                        {/* Wanted achievements */}
                        {post.wantedAchievementIds.length > 0 && post.dungeon && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Succès visés</p>
                                <div className="flex gap-2 flex-wrap">
                                    {post.dungeon.achievements
                                        .filter((a) => post.wantedAchievementIds.includes(a.id))
                                        .map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 bg-yellow-950/20 border border-yellow-900/30 rounded-lg px-2 py-1">
                                                {a.challenge.iconUrl && (
                                                    <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain" />
                                                )}
                                                <span className="text-xs text-yellow-300 font-medium">{a.challenge.name}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Required classes */}
                        {post.requiredClasses && post.requiredClasses.length > 0 && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Classes requises</p>
                                <div className="flex gap-2 flex-wrap">
                                    {post.requiredClasses.map((c) => {
                                        const classData = getClass(c);
                                        return (
                                            <div key={c} className="flex items-center gap-2 bg-indigo-950/20 border border-indigo-900/30 rounded-lg px-2 py-1">
                                                <div className="w-5 h-5 rounded overflow-hidden">
                                                    <img src={classData?.icon} alt={classData?.name || c} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                </div>
                                                <span className="text-xs text-indigo-300 font-medium">{classData?.name || c}</span>
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
                                <div className="flex items-center gap-3 bg-yellow-950/10 rounded-xl p-2.5 border border-yellow-900/20">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 ring-2 ring-yellow-500/30 shrink-0">
                                        {post.profile.user.image && <img src={post.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{displayName(post.profile)}</p>
                                    </div>
                                    <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shrink-0">
                                        <Crown className="w-2.5 h-2.5 mr-1" /> Créateur
                                    </Badge>
                                </div>

                                {/* Participants */}
                                {visibleParticipants.map((p) => (
                                    <div key={p.id} className="flex items-center gap-3 bg-slate-900/40 rounded-xl p-2.5 border border-slate-800 group">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0">
                                            {p.profile.user.image && <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{displayName(p.profile)}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {p.classe && <span className="text-[10px] text-slate-400">{p.classe}</span>}
                                                {p.message && <span className="text-[10px] text-slate-500 italic truncate">"{p.message}"</span>}
                                            </div>
                                        </div>
                                        <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[p.status] || STATUS_COLORS.PENDING}`}>
                                            {p.status === "PENDING" ? "En attente" : p.status === "ACCEPTED" ? "Accepté" : "Refusé"}
                                        </Badge>

                                        {/* Owner actions */}
                                        {(isOwner || isAdmin) && post.status === "OPEN" && (
                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {p.status === "PENDING" && (
                                                    <Button size="icon" variant="ghost"
                                                        className="w-7 h-7 text-emerald-400 hover:bg-emerald-500/10"
                                                        onClick={() => handleAccept(p.id)} disabled={isPending}>
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button size="icon" variant="ghost"
                                                    className="w-7 h-7 text-red-400 hover:bg-red-500/10"
                                                    onClick={() => handleReject(p.id)} disabled={isPending}
                                                    title={p.status === "PENDING" ? "Refuser" : "Retirer"}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {visibleParticipants.length === 0 && (
                                    <p className="text-center text-sm text-slate-600 py-4">Aucun participant pour l'instant</p>
                                )}
                            </div>
                        </div>

                        {/* Join form */}
                        {!isOwner && !myParticipation && post.status === "OPEN" && spotsLeft > 0 && (
                            <div className="border-t border-slate-800 pt-4 space-y-3">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Rejoindre ce groupe</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Ta classe</label>
                                        <select
                                            value={classe}
                                            onChange={(e) => setClasse(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        >
                                            <option value="">Sélectionner…</option>
                                            {DOFUS_CLASSES.map((c) => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Message (opt.)</label>
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                                            placeholder="Dispo ce soir…"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                </div>
                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold h-10"
                                    onClick={handleJoin}
                                    disabled={isPending}
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Envoyer ma candidature
                                </Button>
                            </div>
                        )}

                        {/* My pending status */}
                        {myParticipation?.status === "PENDING" && (
                            <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                                <p className="text-sm text-yellow-400 font-medium">Candidature en attente…</p>
                                <Button size="sm" variant="outline" onClick={handleLeave} disabled={isPending}
                                    className="border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-900">
                                    <LogOut className="w-3 h-3 mr-1" /> Annuler
                                </Button>
                            </div>
                        )}

                        {/* Creator actions */}
                        {(isOwner || isAdmin) && post.status === "OPEN" && (
                            <div className="border-t border-slate-800 pt-4 flex gap-3">
                                {isOwner && (
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800 font-bold h-10"
                                        onClick={() => setIsEditModalOpen(true)}
                                        disabled={isPending}
                                    >
                                        <Pencil className="w-4 h-4 mr-2 hidden sm:block" />
                                        Modifier
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="flex-1 border-red-900/40 text-red-400 hover:bg-red-500/10 font-bold h-10"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                >
                                    <Trash2 className="w-4 h-4 mr-2 hidden sm:block" />
                                    Supprimer
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

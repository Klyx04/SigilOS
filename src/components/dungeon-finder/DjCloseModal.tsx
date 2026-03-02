"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Trophy, X, Loader2, Star, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeDjPostWithContributions } from "@/server/actions/dungeon-finder-actions";
import { toast } from "sonner";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";

interface DjCloseModalProps {
    isOpen: boolean;
    post: DjPostWithDetails;
    guildId: string;
    onClose: () => void;
    onClosed: () => void;
}

/** Mirror of server-side getContributionPoints */
function getPointsFromLevel(level?: number | null): number {
    if (!level) return 1;
    if (level >= 200) return 4;
    if (level >= 150) return 3;
    if (level >= 100) return 2;
    return 1;
}

export function DjCloseModal({ isOpen, post, guildId, onClose, onClosed }: DjCloseModalProps) {
    const [isPending, startTransition] = useTransition();

    // Only accepted participants (not the creator)
    const acceptedParticipants = post.participants.filter(
        (p) => p.status === "ACCEPTED" && p.profile.id !== post.profileId
    );

    // All validated by default
    const [validated, setValidated] = useState<Set<string>>(
        new Set(acceptedParticipants.map((p) => p.profile.id))
    );

    function toggle(profileId: string) {
        setValidated((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) next.delete(profileId);
            else next.add(profileId);
            return next;
        });
    }

    // Contribution points based on dungeon level
    const dungeonLevel = post.dungeon?.level ?? null;
    const pts = getPointsFromLevel(dungeonLevel);

    function handleConfirm() {
        startTransition(async () => {
            const res = await closeDjPostWithContributions(guildId, post.id, Array.from(validated));
            if (res.success) {
                const count = validated.size;
                const awarded = (res as any).data?.pointsAwarded ?? pts;
                toast.success(`Groupe clôturé ! ${count} membre${count > 1 ? "s ont" : " a"} reçu +${awarded} point${awarded > 1 ? "s" : ""} de contribution.`);
                onClosed();
                onClose();
            } else {
                toast.error(res.error);
            }
        });
    }

    const title = post.mode === "DONJON" ? post.dungeon?.name : post.questName;
    const validatedCount = validated.size;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header glow */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-white/5 bg-slate-900/30">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 shadow-inner flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">Clôturer le groupe</h2>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px]">{title}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors mt-0.5">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">
                            {/* Info banner */}
                            <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3.5 py-3">
                                <Trophy className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Valide les membres qui ont <strong className="text-white">réellement participé</strong> pour leur attribuer{" "}
                                    <strong className="text-violet-300">+{pts} point{pts > 1 ? "s" : ""} de contribution</strong>.
                                    {post.dungeon && (
                                        <span className="ml-1 text-slate-500">(Donjon niveau {post.dungeon.level})</span>
                                    )}
                                    {" "}<span className="text-slate-500">Tu ne reçois pas de point en tant que créateur.</span>
                                </p>
                            </div>

                            {/* Participants list */}
                            {acceptedParticipants.length === 0 ? (
                                <div className="text-center py-6 text-slate-600">
                                    <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Aucun membre à valider.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                                        Participants acceptés
                                    </p>
                                    {acceptedParticipants.map((p) => {
                                        const isVal = validated.has(p.profile.id);
                                        return (
                                            <button
                                                key={p.profile.id}
                                                onClick={() => toggle(p.profile.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${isVal
                                                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-inner"
                                                    : "bg-slate-900/40 border-white/5 hover:bg-slate-900/60"
                                                    }`}
                                            >
                                                {/* Avatar */}
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0 ring-2 ring-offset-1 ring-offset-slate-900 ring-transparent">
                                                    {p.profile.user.image && (
                                                        <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                                {/* Name */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">
                                                        {p.profile.discordNickname || p.profile.pseudoDofus || (p.profile as any).dofusPseudo || "Membre"}
                                                    </p>
                                                    {p.classe && (
                                                        <p className="text-[10px] text-slate-500">{p.classe}</p>
                                                    )}
                                                </div>
                                                {/* Point badge */}
                                                {isVal && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-sm">
                                                        <Star className="w-2.5 h-2.5" /> +{pts} pt{pts > 1 ? "s" : ""}
                                                    </span>
                                                )}
                                                {/* Checkbox */}
                                                {isVal
                                                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                                    : <Circle className="w-5 h-5 text-slate-600 shrink-0" />
                                                }
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Summary */}
                            {acceptedParticipants.length > 0 && (
                                <p className="text-[11px] text-slate-500 text-center">
                                    <strong className="text-slate-300">{validatedCount}</strong> membre{validatedCount > 1 ? "s" : ""} recevra{validatedCount > 1 ? "ont" : ""}{" "}
                                    <strong className="text-violet-300">+{pts} point{pts > 1 ? "s" : ""} de contribution</strong>
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isPending}
                                className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold max-h-12 h-12 transition-all"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={isPending}
                                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-black max-h-12 h-12 shadow-md shadow-violet-900/20"
                            >
                                {isPending ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Clôture…</>
                                ) : (
                                    <><ShieldCheck className="w-5 h-5 mr-2" /> Confirmer</>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

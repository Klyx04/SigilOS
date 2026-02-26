"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, CheckCircle2, CalendarClock, MessageSquare, Users, Swords, ScrollText, Link2 } from "lucide-react";
import { updateDjPost } from "@/server/actions/dungeon-finder-actions";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";

interface DjEditModalProps {
    isOpen: boolean;
    post: DjPostWithDetails;
    guildId: string;
    onClose: () => void;
    onSaved: () => void;
}

export function DjEditModal({ isOpen, post, guildId, onClose, onSaved }: DjEditModalProps) {
    const [isPending, startTransition] = useTransition();

    // Pre-fill from existing post
    const [maxMembers, setMaxMembers] = useState(post.maxMembers);
    const [message, setMessage] = useState(post.message ?? "");
    const [targetDate, setTargetDate] = useState(
        post.targetDate ? new Date(post.targetDate).toISOString().slice(0, 16) : ""
    );
    const [selectedAchievements, setSelectedAchievements] = useState<string[]>(
        post.wantedAchievementIds ?? []
    );
    const [requiredClasses, setRequiredClasses] = useState<string[]>(
        post.requiredClasses ?? []
    );

    // Quête manuelle = pas de questId valide
    const isManualQuest = post.mode === "QUETE" && (!post.questId || post.questId <= 0);
    const [questName, setQuestName] = useState(post.questName ?? "");
    const [questUrl, setQuestUrl] = useState(post.questUrl ?? "");

    function toggleAchievement(id: string) {
        setSelectedAchievements(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    }

    function toggleClass(className: string) {
        setRequiredClasses(prev =>
            prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
        );
    }

    function handleSave() {
        if (!targetDate) {
            toast.error("La date prévue est obligatoire.");
            return;
        }
        startTransition(async () => {
            const res = await updateDjPost(guildId, post.id, {
                maxMembers,
                message: message.trim() || null,
                targetDate: new Date(targetDate),
                wantedAchievementIds: selectedAchievements,
                requiredClasses,
                ...(isManualQuest && {
                    questName: questName.trim() || null,
                    questUrl: questUrl.trim() || null,
                }),
            });
            if (res.success) {
                toast.success("Post mis à jour !");
                onSaved();
                onClose();
            } else {
                toast.error(res.error ?? "Erreur lors de la modification.");
            }
        });
    }

    const title = post.mode === "DONJON" ? post.dungeon?.name : post.questName;
    const achievements = post.dungeon?.achievements ?? [];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-lg bg-slate-950 border-slate-800 text-white max-h-[90vh] overflow-y-auto p-0 gap-0">
                {/* Header */}
                <div className="p-5 pb-4 border-b border-slate-800">
                    <DialogTitle className="text-base font-black flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div>
                            <span className="text-white">Modifier le post</span>
                            <p className="text-[11px] font-normal text-slate-500 mt-0.5 truncate max-w-[300px]">{title}</p>
                        </div>
                    </DialogTitle>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">
                    {/* Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
                            Date prévue <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            required
                            value={targetDate}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                        />
                    </div>

                    {/* Nom et lien quête manuelle */}
                    {isManualQuest && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                    <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
                                    Nom de la quête
                                </label>
                                <input
                                    type="text"
                                    value={questName}
                                    onChange={(e) => setQuestName(e.target.value)}
                                    maxLength={100}
                                    placeholder="Ex : Bijoux de famille"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                    <Link2 className="w-3.5 h-3.5 text-amber-400" />
                                    Lien Dofus pour les Noobs
                                    <span className="text-[10px] text-slate-500 font-normal">(optionnel)</span>
                                </label>
                                <input
                                    type="url"
                                    value={questUrl}
                                    onChange={(e) => setQuestUrl(e.target.value)}
                                    placeholder="https://dofuspourlesnoobs.com/quetes/..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                {questUrl && !questUrl.includes("dofuspourlesnoobs") && (
                                    <p className="text-xs text-amber-500">⚠️ Seuls les liens dofuspourlesnoobs.com sont affichés sur la carte.</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Group size */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            Taille du groupe
                        </label>
                        <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-1 gap-0.5">
                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setMaxMembers(n)}
                                    className={`flex-1 py-2 text-sm font-bold transition-all rounded-lg ${maxMembers === n ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Achievements — only for dungeons that have them */}
                    {post.mode === "DONJON" && achievements.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <Swords className="w-3.5 h-3.5 text-yellow-400" />
                                Succès visés
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {achievements.map((a) => {
                                    const selected = selectedAchievements.includes(a.id);
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => toggleAchievement(a.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${selected
                                                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
                                                : "border-slate-800 bg-slate-900 hover:border-slate-600 text-slate-400"
                                                }`}
                                        >
                                            {a.challenge.iconUrl && (
                                                <img src={a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                            )}
                                            {a.challenge.name}
                                            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-yellow-500 ml-1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Required Classes */}
                    <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-300 flex justify-between">
                            Classes demandées
                            <span className="text-xs text-slate-500 font-normal">{requiredClasses.length} sélec.</span>
                        </p>
                        <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800">
                            {DOFUS_CLASSES.map((c) => {
                                const isSelected = requiredClasses.includes(c.name);
                                return (
                                    <button
                                        key={c.id}
                                        title={c.name}
                                        onClick={() => toggleClass(c.name)}
                                        className={`aspect-square rounded-lg flex items-center justify-center transition-all border ${isSelected
                                            ? "border-indigo-500 bg-indigo-500/20"
                                            : "border-transparent opacity-50 hover:opacity-100 hover:bg-slate-800"
                                            }`}
                                    >
                                        <img
                                            src={c.icon}
                                            alt={c.name}
                                            className="w-6 h-6 object-contain"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            Message (optionnel)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Ex : Je cherche des gens stuffs pour clean vite…"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                        <p className="text-[10px] text-slate-600 text-right">{message.length}/500</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex gap-3 border-t border-slate-800 pt-4">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-lg shadow-indigo-900/30"
                    >
                        {isPending ? "Sauvegarde…" : "Enregistrer"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

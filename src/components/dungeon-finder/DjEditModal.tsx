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
import { DateTimePicker } from "@/components/ui/date-time-picker";

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
            <DialogContent className="w-[95vw] max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white max-h-[90vh] overflow-y-auto p-0 gap-0 custom-scrollbar">
                {/* Header */}
                <div className="p-5 pb-4 border-b border-white/5 bg-slate-900/30">
                    <DialogTitle className="text-base font-black flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <Pencil className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <span className="text-white">Modifier le groupe</span>
                            <p className="text-xs font-medium text-slate-500 mt-0.5 truncate max-w-[300px]">{title}</p>
                        </div>
                    </DialogTitle>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Date */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
                            Date prévue <span className="text-rose-500">*</span>
                            <span className="text-slate-600 font-normal text-[10px] normal-case ml-1">(heure optionnelle)</span>
                        </label>
                        <DateTimePicker
                            value={targetDate}
                            onChange={setTargetDate}
                            minDate={new Date()}
                            timeOptional={true}
                        />
                    </div>

                    {/* Nom et lien quête manuelle */}
                    {isManualQuest && (
                        <div className="p-4 bg-cyan-950/10 border border-cyan-900/30 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                    <ScrollText className="w-3.5 h-3.5 text-cyan-400" />
                                    Nom de la quête
                                </label>
                                <input
                                    type="text"
                                    value={questName}
                                    onChange={(e) => setQuestName(e.target.value)}
                                    maxLength={100}
                                    placeholder="Ex : Bijoux de famille"
                                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                    <Link2 className="w-3.5 h-3.5 text-amber-400" />
                                    Tutoriel Noobs
                                    <span className="text-[10px] text-slate-500 font-normal">(optionnel)</span>
                                </label>
                                <input
                                    type="url"
                                    value={questUrl}
                                    onChange={(e) => setQuestUrl(e.target.value)}
                                    placeholder="https://dofuspourlesnoobs.com/quetes/..."
                                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner transition-all"
                                />
                                {questUrl && !questUrl.includes("dofuspourlesnoobs") && (
                                    <p className="text-xs text-amber-500 font-medium">⚠️ Seuls les liens dofuspourlesnoobs.com sont affichés.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Group size */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            Taille du groupe
                        </label>
                        <div className="flex bg-slate-900/80 border border-white/5 rounded-xl p-1 shadow-inner h-12 items-center">
                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setMaxMembers(n)}
                                    className={`flex-1 flex justify-center items-center h-full text-sm font-bold transition-all rounded-lg ${maxMembers === n ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Achievements */}
                    {post.mode === "DONJON" && achievements.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                <Swords className="w-3.5 h-3.5 text-amber-400" />
                                Succès visés
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {achievements.map((a) => {
                                    const selected = selectedAchievements.includes(a.id);
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => toggleAchievement(a.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${selected
                                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                                : "border-white/5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-300"
                                                }`}
                                        >
                                            {a.challenge.iconUrl && (
                                                <img src={a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                            )}
                                            {a.challenge.name}
                                            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Required Classes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center mb-1.5">
                            Classes demandées
                            <span className="text-[10px] text-slate-500 font-normal normal-case">{requiredClasses.length} sélec.</span>
                        </label>
                        <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800">
                            {DOFUS_CLASSES.map((c) => {
                                const isSelected = requiredClasses.includes(c.name);
                                return (
                                    <button
                                        key={c.id}
                                        title={c.name}
                                        onClick={() => toggleClass(c.name)}
                                        className={`aspect-square rounded-lg flex items-center justify-center transition-all border ${isSelected
                                            ? "border-indigo-500/40 bg-indigo-500/20 shadow-inner"
                                            : "border-transparent opacity-40 hover:opacity-100 hover:bg-white/5"
                                            }`}
                                    >
                                        <img
                                            src={c.icon}
                                            alt={c.name}
                                            className="w-6 h-6 object-contain drop-shadow-md"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            Message (optionnel)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Ex : Je cherche des gens stuffs pour clean vite…"
                            className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner resize-none transition-all"
                        />
                        <p className="text-[10px] text-slate-500 text-right font-medium">{message.length}/500</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3 border-t border-white/5 pt-5 bg-slate-900/30">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-12 transition-all"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black h-12 shadow-md shadow-indigo-900/20"
                    >
                        {isPending ? "Sauvegarde…" : "Enregistrer"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

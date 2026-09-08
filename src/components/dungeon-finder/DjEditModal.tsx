"use client";

import { useState, useMemo, useTransition } from "react";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, CheckCircle2, CalendarClock, MessageSquare, Users, Swords, ScrollText, Link2, Layers } from "lucide-react";
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

    // #228 — Snapshot initial (post) pour la garde anti-navigation.
    const initialSnapshot = useMemo(() => ({
        maxMembers: post.maxMembers,
        message: post.message ?? "",
        targetDate: post.targetDate ? new Date(post.targetDate).toISOString().slice(0, 16) : "",
        selectedAchievements: post.wantedAchievementIds ?? [],
        requiredClasses: post.requiredClasses ?? [],
        questName: post.questName ?? "",
        questUrl: post.questUrl ?? "",
    }), [post]);

    const dirty = isDirty({
        maxMembers,
        message,
        targetDate,
        selectedAchievements,
        requiredClasses,
        questName,
        questUrl,
    }, initialSnapshot);

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
        if (!isMulti && !targetDate) {
            toast.error("La date prévue est obligatoire.");
            return;
        }
        startTransition(async () => {
            const res = await updateDjPost(guildId, post.id, {
                maxMembers,
                message: message.trim() || null,
                targetDate: isMulti ? null : new Date(targetDate),
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

    const isMulti = (post.dungeonsJson?.length ?? 0) > 0;
    const title = isMulti
        ? `Multi-donjons — ${post.dungeonsJson?.length}`
        : (post.mode === "DONJON" ? post.dungeon?.name : post.mode === "DEFI" ? (post.defiName || "Défi") : post.mode === "TITAN" ? (post.titanName || "Titan") : post.questName);
    const achievements = post.dungeon?.achievements ?? [];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-lg bg-background border border-border shadow-2xl rounded-2xl text-foreground max-h-[90vh] overflow-y-auto p-0 gap-0 custom-scrollbar">
                {/* Header */}
                <div className="p-5 pb-4 border-b border-border bg-surface/30">
                    <DialogTitle className="text-base font-black flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-info/20 border border-info/30 flex items-center justify-center shrink-0 shadow-inner">
                            <Pencil className="w-4 h-4 text-info" strokeWidth={2.5} />
                        </div>
                        <div>
                            <span className="text-foreground">Modifier le groupe</span>
                            <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate max-w-[300px]">{title}</p>
                        </div>
                    </DialogTitle>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Multi-donjons : liste en lecture seule */}
                    {isMulti && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-info" /> Donjons de la session
                            </p>
                            {(post.dungeonsJson ?? []).map((d: any, idx: number) => (
                                <div key={d.dungeonId ?? idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface/60 border border-border">
                                    {d.imageUrl ? (
                                        <img src={d.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-background border border-border shrink-0 p-0.5" />
                                    ) : (
                                        <span className="w-9 h-9 rounded-lg bg-background border border-border shrink-0 flex items-center justify-center text-muted-foreground">
                                            <Swords className="w-4 h-4" />
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-foreground truncate">{d.name}</p>
                                        <p className="text-caption text-muted-foreground">
                                            Lvl {d.level}
                                            {(d.wantedAchievementIds?.length ?? 0) > 0 && ` · ${d.wantedAchievementIds.length} succès`}
                                            {d.targetDate && ` · ${new Date(d.targetDate).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Date (simple uniquement — le multi gère ses dates par donjon) */}
                    {!isMulti && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5 text-info" />
                            Date prévue <span className="text-danger">*</span>
                            <span className="text-muted-foreground font-normal text-caption normal-case ml-1">(heure optionnelle)</span>
                        </label>
                        <DateTimePicker
                            value={targetDate}
                            onChange={setTargetDate}
                            minDate={new Date()}
                            timeOptional={true}
                        />
                    </div>
                    )}

                    {/* Nom et lien quête manuelle */}
                    {isManualQuest && (
                        <div className="p-4 bg-info/10 border border-info/30 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                    <ScrollText className="w-3.5 h-3.5 text-info" />
                                    Nom de la quête
                                </label>
                                <input
                                    type="text"
                                    value={questName}
                                    onChange={(e) => setQuestName(e.target.value)}
                                    maxLength={100}
                                    placeholder="Ex : Bijoux de famille"
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info/50 shadow-inner transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                    <Link2 className="w-3.5 h-3.5 text-warning" />
                                    Tutoriel Noobs
                                    <span className="text-caption text-muted-foreground font-normal">(optionnel)</span>
                                </label>
                                <input
                                    type="url"
                                    value={questUrl}
                                    onChange={(e) => setQuestUrl(e.target.value)}
                                    placeholder="https://dofuspourlesnoobs.com/quetes/..."
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info/50 shadow-inner transition-all"
                                />
                                {questUrl && !questUrl.includes("dofuspourlesnoobs") && (
                                    <p className="text-xs text-warning font-medium">⚠️ Seuls les liens dofuspourlesnoobs.com sont affichés.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Group size */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-info" />
                            Taille du groupe
                        </label>
                        <div className="flex bg-surface/80 border border-border rounded-xl p-1 shadow-inner h-12 items-center">
                            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setMaxMembers(n)}
                                    className={`flex-1 flex justify-center items-center h-full text-sm font-bold transition-all rounded-lg ${maxMembers === n ? "bg-info/20 text-info border border-info/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface"}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Achievements */}
                    {post.mode === "DONJON" && achievements.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                <Swords className="w-3.5 h-3.5 text-warning" />
                                Succès visés
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {achievements.map((a) => {
                                    const selected = selectedAchievements.includes(a.id);
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => toggleAchievement(a.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-caption font-bold transition-all ${selected
                                                ? "border-warning/40 bg-warning/10 text-warning"
                                                : "border-border bg-surface/50 hover:bg-elevated text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            {a.challenge.iconUrl && (
                                                <img src={a.challenge.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                            )}
                                            {a.challenge.name}
                                            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-warning ml-1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Required Classes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex justify-between items-center mb-1.5">
                            Classes demandées
                            <span className="text-caption text-muted-foreground font-normal normal-case">{requiredClasses.length} sélec.</span>
                        </label>
                        <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5 p-3 rounded-xl bg-surface border border-border">
                            {DOFUS_CLASSES.map((c) => {
                                const isSelected = requiredClasses.includes(c.name);
                                return (
                                    <button
                                        key={c.id}
                                        title={c.name}
                                        onClick={() => toggleClass(c.name)}
                                        className={`aspect-square rounded-lg flex items-center justify-center transition-all border ${isSelected
                                            ? "border-info/40 bg-info/20 shadow-inner"
                                            : "border-transparent opacity-40 hover:opacity-100 hover:bg-surface"
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
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            Message (optionnel)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Ex : Je cherche des gens stuffs pour clean vite…"
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 shadow-inner resize-none transition-all"
                        />
                        <p className="text-caption text-muted-foreground text-right font-medium">{message.length}/500</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3 border-t border-border pt-5 bg-surface/30">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-12 transition-all"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-12 shadow-md shadow-indigo-900/20"
                    >
                        {isPending ? "Sauvegarde…" : "Enregistrer"}
                    </Button>
                </div>
            </DialogContent>

            {/* #228 — Garde anti-navigation (perte de modifications de l'édition). */}
            <UnsavedChangesGuard hasUnsavedChanges={dirty} />
        </Dialog>
    );
}

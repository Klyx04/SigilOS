"use client";

import { useState, useTransition } from "react";
import { MessageSquareWarning, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitQuestFeedbackAction } from "@/server/actions/feedback-actions";
import { FEEDBACK_TYPES, FEEDBACK_LABELS, type FeedbackType } from "@/lib/feedback-types";

interface QuestFeedbackButtonProps {
    guildId: string;
    /** Contexte de la page : "hub-dofus" | "dofus:ocre" | "guide:rush-sylvestre" */
    sourcePage: string;
    /** Slug de la cible (Dofus ou guide) si pertinent */
    targetSlug?: string;
    /** Variante visuelle compacte (coin) */
    compact?: boolean;
}

/**
 * Bouton « Signaler / Feedback » visible sur les pages du module
 * « Les Dofus Dofus ». Ouvre une modale avec les 8 catégories demandées.
 */
export function QuestFeedbackButton({ guildId, sourcePage, targetSlug, compact = false }: QuestFeedbackButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
    const [description, setDescription] = useState("");
    const [isPending, startTransition] = useTransition();

    const reset = () => {
        setSelectedType(null);
        setDescription("");
    };

    const close = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = () => {
        if (!selectedType) return toast.error("Choisis une catégorie.");
        if (!description.trim()) return toast.error("Décris brièvement ton retour.");

        startTransition(async () => {
            const res = await submitQuestFeedbackAction({
                feedbackType: selectedType,
                description: description.trim(),
                sourcePage,
                targetSlug: targetSlug || null,
                guildId,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            });

            if (res.success) {
                toast.success("Merci ! Ton retour a bien été envoyé à l'équipe.");
                close();
            } else {
                toast.error(res.error || "Erreur d'envoi.");
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500/40 hover:text-white transition-all ${
                    compact ? "px-3 py-2 text-[10px] font-black uppercase tracking-widest" : "px-4 py-2.5 text-xs font-bold"
                }`}
                title="Signaler un bug, proposer une amélioration ou un ajout"
            >
                <MessageSquareWarning className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
                <span className="hidden sm:inline">Signaler</span>
            </button>

            <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(true); }}>
                <DialogContent className="sm:max-w-[560px] bg-zinc-950/95 border-white/10 rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-5 border-b border-white/5 bg-zinc-900/30">
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <MessageSquareWarning className="w-5 h-5" />
                            </div>
                            Faire un retour
                        </DialogTitle>
                        <button onClick={close} className="absolute right-5 top-5 text-zinc-500 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </DialogHeader>

                    <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <p className="text-xs text-zinc-400 font-medium">
                            Ton retour est transmis directement à l'équipe (tracker interne + Discord). Choisis une catégorie :
                        </p>

                        {/* Choix de catégorie */}
                        <div className="grid gap-2">
                            {FEEDBACK_TYPES.map((type) => {
                                const meta = FEEDBACK_LABELS[type];
                                const active = selectedType === type;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedType(type)}
                                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                                            active
                                                ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                                                : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25 hover:bg-white/[0.04]"
                                        }`}
                                    >
                                        <span className="text-base">{meta.emoji}</span>
                                        <span className="text-xs font-semibold">{meta.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                Description
                            </label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explique brièvement ton problème ou ton idée…"
                                className="bg-zinc-900/50 border-white/10 text-zinc-200 placeholder:text-zinc-600 min-h-[110px] resize-none focus-visible:ring-1 focus-visible:ring-indigo-500/50"
                            />
                            <p className="text-[10px] text-zinc-600 text-right">{description.length}/2000</p>
                        </div>
                    </div>

                    <DialogFooter className="px-5 py-4 border-t border-white/5 bg-zinc-900/30 flex gap-3 sm:justify-end">
                        <Button type="button" variant="ghost" onClick={close} disabled={isPending} className="text-zinc-400 hover:text-white hover:bg-white/5">
                            Annuler
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending || !selectedType || !description.trim()} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-7 shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
                            <Send className="w-3.5 h-3.5 mr-2" />
                            {isPending ? "Envoi…" : "Envoyer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Bug, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_LABELS, FEEDBACK_TYPES, type FeedbackType } from "@/lib/feedback-types";
import { submitVisitorFeedbackAction } from "@/server/actions/feedback-actions";
import { cn } from "@/lib/utils";

interface VisitorFeedbackButtonProps {
    /** Contexte de la page ; par défaut, le chemin courant. */
    sourcePage?: string;
    targetSlug?: string;
    context?: string;
    compact?: boolean;
    iconOnly?: boolean;
    className?: string;
}

/**
 * Bouton « Signaler un problème » des surfaces **publiques connectées**
 * (en-tête public, profil visiteur, élevage, guides). Il ne demande aucune
 * appartenance à une guilde : l'action serveur rattache le retour à la guilde
 * d'accueil du compte si elle existe, sinon à la plateforme.
 */
export function VisitorFeedbackButton({
    sourcePage,
    targetSlug,
    context,
    compact = false,
    iconOnly = false,
    className,
}: VisitorFeedbackButtonProps) {
    const pathname = usePathname();
    const page = (sourcePage ?? `public:${pathname || "inconnu"}`).slice(0, 100);
    const [open, setOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
    const [description, setDescription] = useState("");
    const [isPending, startTransition] = useTransition();

    const close = () => {
        setOpen(false);
        setSelectedType(null);
        setDescription("");
    };

    const submit = () => {
        if (!selectedType) return toast.error("Choisis une catégorie.");
        if (!description.trim()) return toast.error("Décris brièvement ton retour.");

        startTransition(async () => {
            const response = await submitVisitorFeedbackAction({
                feedbackType: selectedType,
                description: description.trim(),
                sourcePage: page,
                targetSlug: targetSlug || null,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
                context: context || null,
            });

            if (response.success) {
                toast.success("Merci ! Ton retour a bien été envoyé à l'équipe.");
                close();
            } else {
                toast.error(response.error || "Erreur d'envoi.");
            }
        });
    };

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size={iconOnly ? "icon" : "sm"}
                onClick={() => setOpen(true)}
                aria-label="Signaler un problème"
                title="Signaler un problème"
                className={cn(
                    "gap-1.5 rounded-xl text-muted-foreground hover:text-foreground",
                    compact && "h-8 px-2 text-caption",
                    className,
                )}
            >
                <Bug className="h-4 w-4" />
                {!iconOnly && <span>Signaler</span>}
            </Button>

            <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Signaler un problème</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Décris le problème ou l&apos;idée. Ton retour part directement à l&apos;équipe SigilOS.
                        </p>

                        {context && (
                            <div className="rounded-xl border border-border bg-surface px-3 py-2">
                                <p className="text-caption text-muted-foreground">Position</p>
                                <p className="break-words text-xs font-medium text-foreground">{context}</p>
                            </div>
                        )}

                        <div className="grid gap-2">
                            {FEEDBACK_TYPES.map((type) => {
                                const meta = FEEDBACK_LABELS[type];
                                const active = selectedType === type;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSelectedType(type)}
                                        aria-pressed={active}
                                        className={cn(
                                            "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                                            active
                                                ? "border-primary/50 bg-primary/10 text-foreground"
                                                : "border-border bg-surface text-foreground hover:bg-elevated",
                                        )}
                                    >
                                        <span className="shrink-0 text-base" aria-hidden="true">{meta.emoji}</span>
                                        <span className="text-xs font-medium leading-tight">{meta.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="visitor-feedback-description" className="text-xs font-medium text-foreground">
                                Description
                            </label>
                            <Textarea
                                id="visitor-feedback-description"
                                value={description}
                                maxLength={2000}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Explique brièvement ce qui ne va pas ou ce que tu proposes…"
                                className="min-h-[120px]"
                            />
                            <p className="text-right text-caption text-muted-foreground">{description.length}/2000</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={close} disabled={isPending}>Annuler</Button>
                        <Button
                            onClick={submit}
                            disabled={isPending || !selectedType || !description.trim()}
                            className="gap-2"
                        >
                            <Send className="h-3.5 w-3.5" />
                            {isPending ? "Envoi…" : "Envoyer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Bug, X, Send, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitQuestFeedbackAction } from "@/server/actions/feedback-actions";
import { FEEDBACK_TYPES, FEEDBACK_LABELS, type FeedbackType } from "@/lib/feedback-types";

interface RushOverlayFeedbackPanelProps {
  guildId: string;
  sourcePage: string;
  targetSlug?: string;
  /** Étape/position calculée pré-remplie dans le retour */
  context?: string;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onClose: () => void;
}

/**
 * Formulaire de retour intégré à l'overlay (fenêtre PiP / popup).
 * Même action serveur que la modale dashboard (`submitQuestFeedbackAction`),
 * mais rendu en `fixed` dans le viewport de l'overlay — jamais dans la
 * fenêtre principale. Compact par construction (overlay souvent étroit).
 *
 * Apparence : jetons de thème uniquement (l'overlay pose `.light` sur sa racine
 * en thème clair), rayon 6 px, filets, casse normale. Les emoji des catégories
 * viennent de `FEEDBACK_LABELS`, partagé avec le formulaire du dashboard.
 */
export function RushOverlayFeedbackPanel({
  guildId,
  sourcePage,
  targetSlug,
  context,
  onClose,
}: RushOverlayFeedbackPanelProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  // Échap ferme le panneau : même comportement que les autres modales du rush.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        context: context || null,
      });

      if (res.success) {
        toast.success("Merci ! Ton retour a bien été envoyé à l'équipe.");
        onClose();
      } else {
        toast.error(res.error || "Erreur d'envoi.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5">
      {/* Fond */}
      <button
        type="button"
        aria-label="Fermer le formulaire de retour"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Faire un retour"
        className="relative z-10 flex max-h-[92vh] w-full max-w-[25rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated"
      >
        {/* En-tête */}
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-3.5 py-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] border border-danger/25 bg-danger/10 text-danger">
            <Bug className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Faire un retour</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Corps scrollable */}
        <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Ton retour est transmis directement à l'équipe (tracker interne + Discord). Choisis une catégorie :
          </p>

          {context && (
            <div className="flex items-start gap-2 rounded-[4px] border border-border bg-surface px-3 py-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Position</p>
                <p className="break-words text-[11px] font-medium text-foreground">{context}</p>
              </div>
            </div>
          )}

          {/* Catégories */}
          <div className="grid gap-1.5">
            {FEEDBACK_TYPES.map((type) => {
              const meta = FEEDBACK_LABELS[type];
              const selected = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[4px] border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-warning/50 bg-warning/10 text-foreground"
                      : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-elevated"
                  )}
                >
                  <span className="shrink-0 text-sm" aria-hidden="true">{meta.emoji}</span>
                  <span className="text-[11px] font-medium leading-tight">{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="overlay-feedback-desc" className="text-[11px] text-muted-foreground">
              Description
            </label>
            <textarea
              id="overlay-feedback-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="Explique brièvement ton problème ou ton idée…"
              rows={4}
              className="w-full resize-none rounded-[4px] border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none placeholder:text-subtle-foreground focus:border-warning/50"
            />
            <p className="text-right text-[11px] tabular-nums text-muted-foreground">{description.length}/2000</p>
          </div>
        </div>

        {/* Pied */}
        <div className="flex shrink-0 gap-2 border-t border-border bg-background/60 px-3.5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-[4px] py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !selectedType || !description.trim()}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-[4px] bg-accent py-2 text-[12px] font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {isPending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

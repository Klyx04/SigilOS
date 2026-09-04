"use client";

import React, { useState, useTransition } from "react";
import { Bug, X, Send } from "lucide-react";
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
  isLightMode: boolean;
  onClose: () => void;
}

/**
 * Formulaire de retour intégré à l'overlay (fenêtre PiP / popup).
 * Même action serveur que la modale dashboard (`submitQuestFeedbackAction`),
 * mais rendu en `fixed` dans le viewport de l'overlay — jamais dans la
 * fenêtre principale. Compact par construction (overlay souvent étroit).
 */
export function RushOverlayFeedbackPanel({
  guildId,
  sourcePage,
  targetSlug,
  context,
  isLightMode,
  onClose,
}: RushOverlayFeedbackPanelProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

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
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fermer le formulaire de retour"
        onClick={onClose}
        className={cn(
          "absolute inset-0",
          isLightMode ? "bg-slate-900/40" : "bg-black/60 backdrop-blur-sm"
        )}
      />

      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Faire un retour"
        className={cn(
          "relative z-10 flex flex-col w-full max-w-[400px] max-h-[92vh] rounded-2xl border overflow-hidden shadow-2xl",
          isLightMode ? "bg-white border-slate-200" : "bg-[#111419] border-[#2a3646]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 border-b shrink-0",
            isLightMode ? "border-slate-200" : "border-[#28303a]/70"
          )}
        >
          <span
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center border shrink-0",
              isLightMode ? "bg-red-50 border-red-200 text-red-500" : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            <Bug className="w-4 h-4" />
          </span>
          <h2 className={cn("text-sm font-bold flex-1 min-w-0 truncate", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>
            Faire un retour
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isLightMode
                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                : "text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className={cn("text-[11px] leading-relaxed", isLightMode ? "text-slate-500" : "text-[#6e7784]")}>
            Ton retour est transmis directement à l'équipe (tracker interne + Discord). Choisis une catégorie :
          </p>

          {context && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2",
                isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#181c22] border-[#28303a]"
              )}
            >
              <span className="text-sm leading-none" aria-hidden="true">📍</span>
              <div className="min-w-0">
                <p className={cn("text-[9px] font-black uppercase tracking-widest", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
                  Position
                </p>
                <p className={cn("text-[11px] font-medium break-words", isLightMode ? "text-slate-700" : "text-[#c4cad2]")}>
                  {context}
                </p>
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
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all",
                    selected
                      ? isLightMode
                        ? "border-amber-400 bg-amber-50 text-slate-900"
                        : "border-[#d5a94e]/50 bg-[#d5a94e]/10 text-[#f2f0e9]"
                      : isLightMode
                        ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        : "border-[#28303a] bg-[#0d1117] text-[#e8e4da] hover:border-[#3a4550]"
                  )}
                >
                  <span className="text-sm shrink-0" aria-hidden="true">{meta.emoji}</span>
                  <span className="text-[11px] font-semibold leading-tight">{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="overlay-feedback-desc"
              className={cn("text-[9px] font-black uppercase tracking-widest", isLightMode ? "text-slate-400" : "text-[#6e7784]")}
            >
              Description
            </label>
            <textarea
              id="overlay-feedback-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="Explique brièvement ton problème ou ton idée…"
              rows={4}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-xs outline-none resize-none",
                isLightMode
                  ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-400"
                  : "bg-[#0d1117] border-[#28303a] text-[#f2f0e9] placeholder:text-[#6e7784] focus:border-[#d5a94e]/50"
              )}
            />
            <p className={cn("text-[10px] text-right tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
              {description.length}/2000
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex gap-2 px-4 py-3 border-t shrink-0",
            isLightMode ? "border-slate-200 bg-slate-50/60" : "border-[#28303a]/70 bg-[#0d1117]/60"
          )}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              "flex-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors",
              isLightMode ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1c2129]"
            )}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !selectedType || !description.trim()}
            className="flex-[2] py-2 rounded-xl bg-[#39bc95] hover:bg-[#2b9f7d] disabled:opacity-40 disabled:cursor-not-allowed text-[#06251b] text-[11px] font-black uppercase tracking-widest transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isPending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

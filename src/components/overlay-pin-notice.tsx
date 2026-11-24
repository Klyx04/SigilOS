"use client";

import { useState } from "react";
import { PinOff, X } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";
/**
 * Bandeau affiché en haut d'un overlay (guide Rush / fiche Boss) quand la fenêtre
 * N'EST PAS épinglée toujours-au-dessus — i.e. le navigateur n'a pas ouvert de
 * Document Picture-in-Picture et on est tombé sur la popup `about:blank` de secours.
 *
 * Le texte reste **neutre** : on ne nomme plus un navigateur précis (Opera 102+ expose
 * l'API ; si elle est absente/refusée, c'est le fallback qui parle).
 *
 * Couleurs explicites (pas de tokens alpha) : lisible en mode sombre comme en mode clair.
 */
export function OverlayPinNotice() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="note"
      className="mx-2 mt-2 mb-1 flex items-start gap-2 rounded-xl border border-[#b45309]/50 bg-[#fef3c7] px-2.5 py-2"
    >
      <PinOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b45309]" />
      <p className="min-w-0 flex-1 text-[10px] leading-snug text-[#78350d]">
        <span className="font-bold text-[#92400e]">
          {isEn ? "Window not pinned." : "Fenêtre non épinglée."}
        </span>{" "}
        {isEn
          ? "This window is not pinned. Keep it visible next to the game; PowerToys 'Always on Top' (Win + Ctrl + T) can help."
          : "Fenêtre simple, non épinglée. Gardez-la visible à côté du jeu ; PowerToys « Always on Top » (Win + Ctrl + T) peut aider."}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={isEn ? "Dismiss this notice" : "Masquer cet avertissement"}
        className="rounded-md p-0.5 text-[#92400e]/70 transition-colors hover:bg-[#b45309]/15 hover:text-[#92400e]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

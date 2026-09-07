"use client";

import { useState } from "react";
import { PinOff, X } from "lucide-react";

/**
 * Bandeau affiché en haut d'un overlay (guide Rush / fiche Boss) quand la fenêtre
 * N'EST PAS épinglée toujours-au-dessus — i.e. le navigateur ne supporte pas
 * Document Picture-in-Picture (cas constaté : Opera GX, qui n'expose pas l'API
 * malgré son Chromium récent) et on est tombé sur la popup `about:blank` de secours.
 *
 * Couleurs explicites (pas de tokens alpha) : lisible en mode sombre comme en mode clair.
 */
export function OverlayPinNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="note"
      className="mx-2 mt-2 mb-1 flex items-start gap-2 rounded-xl border border-[#b45309]/50 bg-[#fef3c7] px-2.5 py-2"
    >
      <PinOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b45309]" />
      <p className="min-w-0 flex-1 text-[10px] leading-snug text-[#78350d]">
        <span className="font-bold text-[#92400e]">Fenêtre non épinglée.</span> Ce navigateur
        (ex. Opera GX) ne supporte pas l&apos;overlay toujours-au-dessus. Astuce : PowerToys
        « Always on Top » (Win + Ctrl + T) pour la garder au-dessus du jeu.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer cet avertissement"
        className="rounded-md p-0.5 text-[#92400e]/70 transition-colors hover:bg-[#b45309]/15 hover:text-[#92400e]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlayFooterProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** Libellé central, ex : "1 / 5" */
  label?: string;
  className?: string;
}

/**
 * Pied de page fixe : navigation Précédent / Suivant entre les chapitres + libellé de
 * position. Le bouton « mode compact » (vue de jeu) **n'est plus ici** : c'est un réglage
 * d'affichage, il vit dans l'en-tête à côté du thème (retour user du 21/09/2026).
 *
 * ⚠️ **Pas de balise `footer`** : le guide interne injecte
 * `footer,.site-footer,.app-footer,nav[class*="footer"]{display:none!important}` pour
 * masquer le pied de site ; cette feuille est copiée dans la PiP, donc la balise footer
 * disparaissait de l'overlay (mesure du 26/11/2026). Un `div role="contentinfo"` garde
 * la sémantique sans subir la règle globale.
 */
export function RushOverlayFooter({
  onPrev,
  onNext,
  canPrev,
  canNext,
  label,
  className,
}: RushOverlayFooterProps) {
  // Bouton planche de la DA : le relief vient de `.da-btn::before` (coin 7/2,
  // rayures de bois, bord « rough »), plus une bordure Tailwind empilée.
  const baseBtn = "da-btn gap-1.5 px-3 py-1.5 text-xs";

  return (
    <div
      role="contentinfo"
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-t border-border-strong bg-surface px-4 py-2.5",
        className
      )}
    >
      <button type="button" onClick={onPrev} disabled={!canPrev} className={baseBtn}>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Précédent</span>
      </button>

      <div className="flex items-center gap-2">
        {label && (
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">{label}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        data-variant="main"
        className={baseBtn}
      >
        <span>Suivant</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

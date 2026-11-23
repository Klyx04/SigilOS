"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Toast de retour après un saut vers un prérequis.
 *
 * 30 s avec compte à rebours : dans une PiP, le joueur peut être concentré sur
 * la quête cible et rater un toast de 10 s. Le bouton reste cliquable jusqu'à
 * la fin ; le compteur dit combien de temps il reste.
 */
export function RushOverlayReturnToast({
  questName,
  seconds = 30,
  onReturn,
  onDismiss,
}: {
  questName: string;
  seconds?: number;
  onReturn: () => void;
  onDismiss: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold">Retour à la quête d'origine</p>
        <p className="truncate text-[10px]" style={{ color: "var(--da-muted, #a3afa1)" }}>
          {questName}
        </p>
      </div>
      <button
        type="button"
        data-button=""
        onClick={onReturn}
        aria-label={`Revenir à ${questName} (${left} secondes restantes)`}
      >
        Revenir · {left} s
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer le rappel de retour"
        className="shrink-0 rounded-[3px] p-1 transition-colors hover:bg-white/10"
        style={{ color: "var(--da-muted, #a3afa1)" }}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

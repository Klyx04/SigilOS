"use client";

import React, { useEffect, useState } from "react";

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
}: {
  questName: string;
  seconds?: number;
  onReturn: () => void;
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
    </div>
  );
}

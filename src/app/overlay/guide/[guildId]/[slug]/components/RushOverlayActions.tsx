"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rangée d'actions de l'overlay — celle de la maquette, entre le dock et la recherche.
 *
 * `Reprendre` ramène à la **prochaine quête à faire** (le premier nœud ni validé ni
 * verrouillé du chapitre affiché) ; `Ressources` ouvre la même modale que l'ancienne
 * icône de l'en-tête — désormais **un seul point d'entrée**, avec le compte des
 * ressources déjà cochées (`n/N`), comme le badge de la maquette.
 *
 * Aucun libellé n'est inventé côté métier : « Reprendre » et « Ressources » sont les
 * deux actions de la maquette, et le badge ne fait que compter `resourceChecks`.
 */
export function RushOverlayActions({
  onResume,
  onOpenResources,
  checked,
  total,
  className,
}: {
  /** Fait défiler la liste jusqu'à la prochaine quête à faire. */
  onResume: () => void;
  /** Ouvre « Ressources à prévoir » (modale existante). */
  onOpenResources: () => void;
  /** Ressources déjà cochées dans la modale. */
  checked: number;
  /** Ressources agrégées du guide. */
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("da-actions", className)}>
      <button
        type="button"
        onClick={onResume}
        title="Aller à la prochaine quête à faire"
        className="da-btn"
        data-variant="main"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        <span>Reprendre</span>
      </button>

      <button
        type="button"
        onClick={onOpenResources}
        title="Ressources à prévoir"
        className="da-btn"
      >
        {/* Picto du jeu (asset Dofus du module Ressources, coloré dans les deux thèmes). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/dofus/modules/resources.png"
          alt=""
          className="h-4 w-4 object-contain"
          loading="lazy"
        />
        <span>Ressources</span>
        {total > 0 && (
          <b className="da-badge" aria-hidden="true">
            {checked}/{total}
          </b>
        )}
      </button>
    </div>
  );
}

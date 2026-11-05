"use client";

import React from "react";
import type { RushQuestCounts, RushQuestFilter } from "@/lib/rush-quest-filter";

/**
 * Filtre segmenté de la liste des quêtes — DA « Carnet de campagne ».
 *
 * Trois plaques dans un rail de bronze : l'actif prend le filet d'or, les autres
 * restent des surfaces neutres. `role="group"` + `aria-pressed` : c'est un choix
 * d'affichage, pas une navigation.
 */
const OPTIONS: Array<{ value: RushQuestFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "active", label: "En cours" },
  { value: "done", label: "Faites" },
  { value: "locked", label: "Verrouillées" },
];

export function RushOverlayQuestFilter({
  value,
  onChange,
  counts,
}: {
  value: RushQuestFilter;
  onChange: (value: RushQuestFilter) => void;
  /** Compteurs par filtre (règle pure `countRushQuests`). Absent ⇒ pas de compteur. */
  counts?: RushQuestCounts;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrer les quêtes"
      className="da-filters mx-3 mt-2"
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="flex h-7 cursor-pointer items-center text-[12px] font-semibold transition-colors motion-reduce:transition-none"
          >
            {option.label}
            {counts ? <b>{counts[option.value]}</b> : null}
          </button>
        );
      })}
    </div>
  );
}

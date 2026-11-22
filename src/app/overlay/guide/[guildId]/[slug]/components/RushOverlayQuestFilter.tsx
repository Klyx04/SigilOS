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
  compact = false,
}: {
  value: RushQuestFilter;
  onChange: (value: RushQuestFilter) => void;
  /** Compteurs par filtre (règle pure `countRushQuests`). Absent ⇒ pas de compteur. */
  counts?: RushQuestCounts;
  /** PiP étroite : un seul select thématisé, jamais quatre onglets qui wrappent. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="da-filter-select">
        <span className="sr-only">Filtrer les quêtes</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as RushQuestFilter)}
          aria-label="Filtrer les quêtes"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {counts ? ` (${counts[option.value]})` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      role="group"
      aria-label="Filtrer les quêtes"
      className="da-filters"
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

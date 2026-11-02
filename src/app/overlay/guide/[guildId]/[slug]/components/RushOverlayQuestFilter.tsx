"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { RushQuestFilter } from "@/lib/rush-quest-filter";

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
  { value: "locked", label: "Verrouillées" },
];

export function RushOverlayQuestFilter({
  value,
  onChange,
}: {
  value: RushQuestFilter;
  onChange: (value: RushQuestFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrer les quêtes"
      className="mx-3 mt-2 flex gap-1 rounded-[4px] border border-border-strong bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex h-7 flex-1 cursor-pointer items-center justify-center rounded-[3px] border text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors motion-reduce:transition-none",
              active
                ? "border-gold/60 bg-gold/10 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-elevated hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

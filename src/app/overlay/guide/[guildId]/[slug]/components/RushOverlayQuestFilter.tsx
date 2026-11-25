"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
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
  hideCompleted = false,
  onToggleHideCompleted,
}: {
  value: RushQuestFilter;
  onChange: (value: RushQuestFilter) => void;
  /** Compteurs par filtre (règle pure `countRushQuests`). Absent ⇒ pas de compteur. */
  counts?: RushQuestCounts;
  /** PiP étroite : un seul dropdown DA, jamais quatre onglets qui wrappent. */
  compact?: boolean;
  /** Contrôle « masquer les faites » VISIBLE dans la barre de filtres (demande 25/11). */
  hideCompleted?: boolean;
  onToggleHideCompleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
      <div className="da-filter-select relative" ref={rootRef}>
        <button
          type="button"
          className="da-filter-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Filtrer les quêtes"
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            {current.label}
            {counts ? ` (${counts[current.value]})` : ""}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        {open && (
          <div className="da-filter-menu" role="listbox" aria-label="Filtrer les quêtes">
            {OPTIONS.map((option) => {
              const active = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="da-filter-option"
                >
                  <span>{option.label}</span>
                  {counts ? <b>{counts[option.value]}</b> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {onToggleHideCompleted ? (
        <button
          type="button"
          onClick={onToggleHideCompleted}
          aria-pressed={hideCompleted}
          aria-label={hideCompleted ? "Afficher les quêtes faites" : "Masquer les quêtes faites"}
          title={hideCompleted ? "Afficher les quêtes faites" : "Masquer les quêtes faites"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
        >
          {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      ) : null}
      </div>
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
      {onToggleHideCompleted ? (
        <button
          type="button"
          onClick={onToggleHideCompleted}
          aria-pressed={hideCompleted}
          title={hideCompleted ? "Afficher les quêtes faites" : "Masquer les quêtes faites"}
          className="ml-auto flex h-7 cursor-pointer items-center gap-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="whitespace-nowrap">{hideCompleted ? "Afficher" : "Masquer"}</span>
        </button>
      ) : null}
    </div>
  );
}

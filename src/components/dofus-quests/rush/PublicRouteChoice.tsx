"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type PublicRouteCamp = "bontarien" | "brakmarien" | null;

const OPTIONS: Array<{ value: PublicRouteCamp; label: string; icon: string }> = [
  { value: "bontarien", label: "Bontarien", icon: "/ordres/bonta.png" },
  { value: null, label: "Neutre", icon: "/ordres/neutre.png" },
  { value: "brakmarien", label: "Brâkmarien", icon: "/ordres/brakmar.png" },
];

/**
 * Choix de **cité** du guide public (visiteur non connecté).
 *
 * ⚠️ Guide public : ce choix est **purement local** (aucune donnée de guilde, aucun
 * membre, aucune progression d'autrui). Il ne conditionne que la route affichée.
 */
export function PublicRouteChoice({
  value,
  onChange,
}: {
  value: PublicRouteCamp;
  onChange: (value: PublicRouteCamp) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Ma cité
      </span>
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={option.icon} alt="" className="h-3.5 w-3.5 object-contain" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

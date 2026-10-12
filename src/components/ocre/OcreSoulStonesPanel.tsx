"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildOcrePlan,
  soulStoneLevelLabel,
  type OcrePanelData,
  type OcrePlan,
  type SoulStone,
} from "@/lib/ocre-soul-stones";

/**
 * Pierres d'âme de la Quête Ocre — **rendu partagé** (overlay interne + module dashboard).
 *
 * Source unique de calcul : `@/lib/ocre-soul-stones` (`buildOcrePlan`).
 * Source unique d'images : nos WebP siphonnés (`/uploads/assets-dofus/items/<id>.webp`).
 * Aucune dépendance externe : si un WebP manque, la vignette disparaît (pas de 404).
 */

/** Vignette locale d'une pierre (masquée si le fichier local est absent). */
export function StoneImage({ stone, className }: { stone: SoulStone; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stone.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setOk(false)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * Grille compacte des pierres à prévoir : un palier = une tuile
 * (`×N` + nom + plage de niveaux). Les paliers à 0 sont masqués (rien à prévoir = rien
 * à afficher) — l'encart ne montre jamais de « recette ».
 */
export function SoulStoneTiles({
  plan,
  size = "sm",
  className,
}: {
  plan: OcrePlan;
  size?: "sm" | "md";
  className?: string;
}) {
  const stones = useMemo(() => plan.stones.filter((s) => s.count > 0), [plan.stones]);
  const isMd = size === "md";

  if (stones.length === 0) {
    return (
      <p
        className={cn(
          "rounded-md border border-success/30 bg-success/10 px-2.5 py-2 text-xs font-medium text-success",
          className
        )}
      >
        Rien à prévoir : toutes les cibles Ocre sont déjà capturées.
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-1 lg:grid-cols-4", className)}>
      {stones.map(({ stone, count }) => (
        <div
          key={stone.id}
          title={`${stone.name} — ${soulStoneLevelLabel(stone)}`}
          className={cn(
            "flex items-center gap-2 rounded-md border border-border bg-surface",
            isMd ? "px-2.5 py-2" : "px-1.5 py-1"
          )}
        >
          <StoneImage stone={stone} className={isMd ? "h-7 w-7" : "h-5 w-5"} />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-semibold text-foreground", isMd ? "text-xs" : "text-[10px]")}>
              <span className={cn("font-bold tabular-nums", isMd ? "text-sm" : "text-[12px]", "text-accent")}>
                ×{count}
              </span>{" "}
              {stone.name}
            </p>
            <p className={cn("truncate text-muted-foreground", isMd ? "text-[11px]" : "text-[9px]")}>
              {soulStoneLevelLabel(stone)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Encart du module Quête Ocre (page dashboard) : les pierres à prévoir + une astuce.
 * Placement : sous l'en-tête du module, avant la liste — c'est la question qu'on se pose
 * AVANT de partir chasser.
 */
export function OcreSoulStonesCard({ data, className }: { data: OcrePanelData; className?: string }) {
  const plan = useMemo(() => buildOcrePlan(data), [data]);

  return (
    <section
      className={cn("rounded-lg border border-border bg-card p-4 sm:p-5", className)}
      aria-labelledby="ocre-soul-stones-title"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="ocre-soul-stones-title"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dofus/icons/archimonster.png" alt="" className="h-4 w-4 object-contain" />
          Pierres d&apos;âme à prévoir
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold tabular-nums text-warning">{plan.stoneTotal}</span> pierre
          {plan.stoneTotal > 1 ? "s" : ""} · {plan.progress.missing} cible
          {plan.progress.missing > 1 ? "s" : ""} restante{plan.progress.missing > 1 ? "s" : ""}
          {plan.progress.total > 0 ? ` · ${plan.progress.percent}% de la quête` : ""}
        </p>
      </header>

      <div className="mt-3">
        <SoulStoneTiles plan={plan} size="md" />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Astuce : une pierre par capture réussie — garde la <strong className="font-semibold text-foreground">plus
        petite qui couvre le niveau</strong> du monstre visé, et garde les grosses pour les gardiens de donjon.
      </p>
    </section>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ocreMonsterIcon, ocreMonsterImage, ocreStateLabel } from "@/lib/ocre-soul-stones";

/**
 * Briques PARTAGÉES d'une cible de la Quête Ocre (archimonstre / gardien) :
 * la vignette et les pas ±1 — utilisées par l'overlay ET par la modale « Mon Ocre ».
 * Une seule source ⇒ mêmes images, mêmes libellés (« À capturer », « Possédé ×2 »),
 * même comportement d'écriture partout.
 */

/** Vignette d'un monstre : WebP LOCAL, repli sur nos pictos du jeu (jamais de réseau). */
export function OcreMonsterThumb({
  id,
  type,
  dimmed = false,
  className,
}: {
  id: number;
  type?: string | null;
  /** Cible déjà capturée : vignette légèrement atténuée. */
  dimmed?: boolean;
  className?: string;
}) {
  const src = ocreMonsterImage(id);
  const fallback = ocreMonsterIcon(type);
  const [current, setCurrent] = useState(src);

  useEffect(() => setCurrent(src), [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt=""
      loading="lazy"
      onError={() => { if (current !== fallback) setCurrent(fallback); }}
      className={cn("shrink-0 object-contain", dimmed && "opacity-70", className ?? "h-8 w-8")}
    />
  );
}

/**
 * Pas ±1 d'une cible — **le seul chemin d'écriture** vers Metamob.
 * Le libellé du badge vient de `ocreStateLabel` (même vocabulaire partout) et le `+`
 * déclare exactement ce que la quête demande quand rien n'est encore déclaré.
 */
export function OcreTargetStepper({
  owned,
  requiredCopies = 1,
  pending = false,
  disabled = false,
  onStep,
  label,
  className,
}: {
  owned: number;
  requiredCopies?: number;
  pending?: boolean;
  disabled?: boolean;
  onStep: (delta: 1 | -1) => void;
  /** Nom de la cible : rend les libellés d'action explicites (« … de Blop Coco Royal »). */
  label?: string;
  className?: string;
}) {
  const btn =
    "grid h-5 w-5 place-items-center rounded-[3px] border border-border bg-surface text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-40 disabled:hover:bg-surface";
  const suffix = label ? ` de ${label}` : "";

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={disabled || owned <= 0}
        aria-label={`Retirer un exemplaire${suffix} (Metamob)`}
        title="Retirer un exemplaire (Metamob)"
        className={btn}
      >
        <Minus className="h-3 w-3" />
      </button>

      <span
        title={
          owned > requiredCopies
            ? `Doublon : ${owned} exemplaires déclarés`
            : owned > 0
              ? `${owned} exemplaire(s) déclaré(s) — ${requiredCopies} demandé(s) par la quête`
              : `Rien de déclaré — ${requiredCopies} exemplaire(s) demandé(s)`
        }
        className={cn(
          "inline-flex min-w-[62px] items-center justify-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide tabular-nums",
          owned >= requiredCopies
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/40 bg-warning/10 text-warning"
        )}
      >
        {pending && <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />}
        {ocreStateLabel(owned, requiredCopies)}
      </span>

      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={disabled}
        aria-label={`Ajouter un exemplaire${suffix} (Metamob)`}
        title="Ajouter un exemplaire (Metamob)"
        className={btn}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

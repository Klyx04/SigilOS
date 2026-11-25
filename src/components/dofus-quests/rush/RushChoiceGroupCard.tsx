"use client";

import type { ReactNode } from "react";
import { DEFAULT_CHOICE_GROUP_NOTE } from "@/lib/rush-choice-groups";

/**
 * **Carte d'une étape à variantes exclusives** — partagée par les trois surfaces
 * (guide membre, guide public, overlay).
 *
 * Le groupe est déjà compté pour **une** étape par `stepCounts` ; cette carte ne
 * refait aucun calcul. Elle donne au joueur les deux informations que la liste
 * séparée ne pouvait pas dire : ces quêtes racontent la même étape, et une seule
 * sera jouée. Les lignes de variantes restent les composants de chaque surface
 * (icône, position, donjons, succès, prérequis) : on enveloppe, on ne réécrit pas.
 */
export function RushChoiceGroupCard({
  group,
  label,
  note,
  count,
  className,
  children,
}: {
  group: string;
  label?: string | null;
  note?: string | null;
  /** Nombre de variantes affichées (une seule peut être validée). */
  count: number;
  className?: string;
  /** Lignes de variantes ; absent = la carte ne porte que son en-tête. */
  children?: ReactNode;
}) {
  const title = (label ?? "").trim() || "Une seule quête à jouer";
  const text = (note ?? "").trim() || DEFAULT_CHOICE_GROUP_NOTE;

  return (
    <section
      className={`da-choice${className ? ` ${className}` : ""}`}
      data-choice-group={group}
      aria-label={`Étape à choix — ${title}`}
    >
      <header className="da-choice-head">
        <div className="da-choice-kicker">
          <span className="da-choice-badge">Étape à choix</span>
          <span className="da-choice-count">
            {count} variante{count > 1 ? "s" : ""} · 1 étape
          </span>
        </div>
        <p className="da-choice-title">{title}</p>
        <p className="da-choice-note">{text}</p>
      </header>
      {children}
    </section>
  );
}

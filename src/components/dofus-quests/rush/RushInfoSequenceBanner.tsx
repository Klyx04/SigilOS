"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { RushSequence } from "@/types/rush-guide-types";
import { RushRichText, RushTipLines } from "./RushRichText";
import {
  infoBannerTone,
  RUSH_INFO_TONE_ICON,
  RUSH_INFO_TONE_RAIL,
  RUSH_INFO_TONE_TEXT,
} from "./RushInfoBanner";

/**
 * RushInfoSequenceBanner — le bandeau d'une séquence marquée « info_sequence » au GOD.
 *
 * Une séquence info n'est PAS une quête : rien à cocher, aucune progression. C'est un
 * encart de conseil posé à un endroit précis du guide.
 *
 * SOURCE UNIQUE pour les trois surfaces (dashboard membre + guide public + overlay PiP).
 * Motif (21/09/2026) : le **guide public** jetait purement et simplement ces séquences
 * (`groupSequencesIntoQuests` faisait `continue`) alors que le dashboard et l'overlay les
 * affichaient — et comme il les **comptait** dans sa progression, son pourcentage ne pouvait
 * jamais atteindre 100 %. Deux surfaces sur trois en avaient donc une vision fausse.
 *
 * DA « Carnet de campagne » (02/11/2026) : même panneau que `RushInfoBanner` — plus de
 * dégradé ni d'emoji, un filet de registre sémantique et un texte lisible.
 */
export function RushInfoSequenceBanner({
  seq,
  accentColor,
  className,
  collapsible = false,
}: {
  seq: RushSequence;
  /** Couleur du bloc, utilisée seulement si la séquence n'a pas la sienne. */
  accentColor?: string | null;
  className?: string;
  /**
   * Overlay uniquement : rend un `<details>` (dépliable) au lieu de l'encart.
   * Faux par défaut ⇒ dashboard et guide public strictement inchangés.
   */
  collapsible?: boolean;
}) {
  const tag = (seq.activityTags || []).find((t) => t.type === "info_sequence");
  const rawColor = tag?.color || accentColor || "";
  const tone = infoBannerTone(rawColor);
  const ToneIcon = RUSH_INFO_TONE_ICON[tone.tone];
  const text = seq.tips || seq.subGuideName || seq.subGuideRef || "";

  /* DA « Gouache Wakfu » : dans l'overlay, un conseil est un DÉPLIABLE (filet
     haut/bas, `+` à droite) — plus un encadré. Opt-in : le dashboard et le guide
     public gardent l'encart toujours ouvert, donc un seul comportement change. */
  if (collapsible) {
    return (
      <details
        data-tone={tone.tone}
        className={cn("rush-carnet da-conseil select-none", className)}
      >
        <summary>
          <ToneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{tone.label}</span>
        </summary>
        <div className="da-conseil-body">
          <RushTipLines text={text} />
        </div>
      </details>
    );
  }

  return (
    <div
      data-tone={tone.tone}
      className={cn(
        "rush-carnet relative flex items-stretch overflow-hidden rounded-[6px] bg-surface select-none",
        className
      )}
    >
      <span aria-hidden="true" className={cn("w-[2px] shrink-0", RUSH_INFO_TONE_RAIL[tone.tone])} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5">
        <span
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
            RUSH_INFO_TONE_TEXT[tone.tone]
          )}
        >
          <ToneIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {tone.label}
        </span>
        <div className="text-xs leading-relaxed text-foreground/90 font-medium">
          <RushRichText text={text} />
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { RushSequence } from "@/types/rush-guide-types";
import { RushRichText } from "./RushRichText";
import { infoBannerTone } from "./RushInfoBanner";

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
 * Grammaire alignée sur `RushInfoBanner` (même famille d'encart) : filet d'accent à gauche,
 * eyebrow mono dont le **registre** vient de la couleur (« Attention / À savoir / Astuce /
 * Conseil ») avec son picto intégré, puis le texte enrichi (liens nommés + positions
 * copiables en `/w x,y`).
 */
export function RushInfoSequenceBanner({
  seq,
  accentColor,
  className,
}: {
  seq: RushSequence;
  /** Couleur du bloc, utilisée seulement si la séquence n'a pas la sienne. */
  accentColor?: string | null;
  className?: string;
}) {
  const tag = (seq.activityTags || []).find((t) => t.type === "info_sequence");
  const color = tag?.color || accentColor || "#10b981";
  const { label, icon } = infoBannerTone(color);
  const text = seq.tips || seq.subGuideName || seq.subGuideRef || "";

  return (
    <div
      className={cn(
        "relative flex items-stretch overflow-hidden rounded-[6px] border select-none",
        className
      )}
      style={{
        borderColor: `${color}25`,
        background: `linear-gradient(135deg, ${color}10 0%, rgba(0,0,0,0.4) 50%, ${color}06 100%)`,
      }}
    >
      <span aria-hidden="true" className="w-[3px] shrink-0" style={{ backgroundColor: color }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5">
        <span
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.055em]"
          style={{ color }}
        >
          <span aria-hidden="true" className="text-[11px] leading-none">{icon}</span>
          {label}
        </span>
        <div className="text-xs leading-relaxed text-foreground/90 font-medium">
          <RushRichText text={text} />
        </div>
      </div>
    </div>
  );
}

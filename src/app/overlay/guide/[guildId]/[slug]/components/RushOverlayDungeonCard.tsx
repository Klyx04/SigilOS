"use client";

import React, { useState } from "react";
import { DoorOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";

interface RushOverlayDungeonCardProps {
  dungeons: DungeonInfo[];
  guildId?: string;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode?: boolean;
  className?: string;
}

/**
 * Liste propre des donjons requis — chaque ligne est un LIEN vers la fiche boss
 * (`/dashboard/{guildId}/succes?dungeon={id}&view=boss`).
 *
 * La donnée de jeu porte l'immersion (vignette officielle du boss + nom du
 * donjon) ; le panneau, lui, reste neutre : surface `--surface`, un filet, un
 * rayon de 4 px. Le bleu décoratif de l'ancienne version (`bg-blue-50`,
 * `text-blue-600`) ne disait rien — il est remplacé par le neutre, et l'ocre est
 * réservé au badge « Ocre », qui est une information, pas une décoration.
 */
export function RushOverlayDungeonCard({ dungeons, guildId, className }: RushOverlayDungeonCardProps) {
  if (dungeons.length === 0) return null;

  return (
    <div className={cn("rounded-[4px] border border-border bg-surface p-2.5", className)}>
      <p className="text-[11px] font-semibold text-muted-foreground">
        {dungeons.length > 1 ? "Donjons requis" : "Donjon requis"}
      </p>

      <div className="mt-1.5 space-y-0.5">
        {dungeons.map((dj, i) => {
          // Segment d'URL : slug public si la donnée de jeu le porte, sinon identifiant.
          const segment = dj?.slug ?? dj?.id;
          const href = segment ? `/boss/${encodeURIComponent(segment)}` : (guildId && segment ? `/dashboard/${guildId}/succes?dungeon=${encodeURIComponent(segment)}&view=boss` : null);
          return <DungeonRow key={i} dj={dj} href={href} />;
        })}
      </div>
    </div>
  );
}

function DungeonRow({ dj, href }: { dj: DungeonInfo; href: string | null }) {
  const [imgError, setImgError] = useState(false);
  const rawName = dj?.name || "Donjon";
  const bossDisplayName = dj?.bossName || rawName.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
  const inner = (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-border bg-elevated">
        {dj.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dj.imageUrl}
            alt={bossDisplayName}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <DoorOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        {dj.isOcre && (
          <span className="absolute -top-px -right-px rounded-[3px] border border-warning/40 bg-warning/15 px-1 text-[9px] font-semibold leading-4 text-warning">
            Ocre
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-semibold text-foreground">{bossDisplayName}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{dj.name || "Donjon"}</span>
      </span>
      <ExternalLink
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Voir la fiche boss de ${bossDisplayName}`}
      className="group flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 transition-colors hover:bg-elevated"
    >
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-2.5 px-2 py-1.5">{inner}</div>
  );
}



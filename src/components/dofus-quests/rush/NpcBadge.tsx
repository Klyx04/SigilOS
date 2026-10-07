"use client";

import React, { useState } from "react";
import { npcPortraitUrl } from "@/lib/npc-portrait";
import { isSafeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

interface NpcBadgeProps {
  /** Identifiant client du PNJ (portrait par convention `/game-data/npcs/<id>.png`). */
  npcId?: number | null;
  /** Nom du PNJ (vrai nom du client — affiché en hover quand l'image parle). */
  name?: string | null;
  /**
   * Image importée en God (upload local, ex. `/uploads/guides/….webp`) :
   * prioritaire sur la convention — affichée **à la place du nom** (le nom
   * reste en hover), pour des lignes compactes façon overlay.
   */
  imageUrl?: string | null;
  className?: string;
}

/**
 * PNJ donneur d'une quête — image (import God ou convention) **à la place du
 * nom**, repli nom seul (jamais d'image cassée : le portrait absent se masque).
 * Partagé par les guides Sylvestre (interne, public, overlays) et les quêtes
 * par Dofus.
 */
export function NpcBadge({ npcId, name, imageUrl, className }: NpcBadgeProps) {
  const [imgOk, setImgOk] = useState(true);
  const custom = typeof imageUrl === "string" && imageUrl.trim() !== "" && isSafeImageUrl(imageUrl)
    ? imageUrl.trim()
    : null;
  const portrait = custom ?? (npcId ? npcPortraitUrl(npcId) : null);
  const showImage = !!portrait && imgOk;
  if (!name && !portrait) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-[3px] border border-border bg-surface px-1.5 py-0.5",
        "text-[11px] font-medium text-muted-foreground",
        className
      )}
      title={name ? `PNJ : ${name}` : "PNJ donneur"}
    >
      {showImage && portrait ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={portrait}
          alt={name ?? ""}
          className="h-4 w-4 shrink-0 rounded-full object-cover"
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : null}
      {(!showImage && name) ? <span className="truncate">{name}</span> : null}
    </span>
  );
}

"use client";

import React, { useState } from "react";
import { DoorOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";

interface RushOverlayDungeonCardProps {
  dungeons: DungeonInfo[];
  guildId?: string;
  isLightMode?: boolean;
  className?: string;
}

/**
 * Liste propre des donjons requis — chaque ligne est un LIEN vers la fiche boss
 * (`/dashboard/{guildId}/succes?dungeon={id}&view=boss`).
 */
export function RushOverlayDungeonCard({
  dungeons,
  guildId,
  isLightMode = false,
  className,
}: RushOverlayDungeonCardProps) {
  if (dungeons.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5",
        isLightMode
          ? "bg-blue-50 border-blue-200"
          : "bg-surface border-border",
        className
      )}
    >
      <p className={cn("text-[9px] font-black uppercase tracking-[0.12em]", isLightMode ? "text-blue-600" : "text-muted-foreground")}>
        {dungeons.length > 1 ? "Donjons requis" : "Donjon requis"}
      </p>

      <div className="mt-1.5 space-y-0.5">
        {dungeons.map((dj, i) => {
          const href = dj?.id ? `/boss/${encodeURIComponent(dj.id)}` : (guildId && dj?.id ? `/dashboard/${guildId}/succes?dungeon=${encodeURIComponent(dj.id)}&view=boss` : null);
          return <DungeonRow key={i} dj={dj} href={href} isLightMode={isLightMode} />;
        })}
      </div>
    </div>
  );
}

function DungeonRow({ dj, href, isLightMode }: { dj: DungeonInfo; href: string | null; isLightMode: boolean }) {
  const [imgError, setImgError] = useState(false);
  const rawName = dj?.name || "Donjon";
  const bossDisplayName = dj?.bossName || rawName.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
  const inner = (
    <>
      <div
        className={cn(
          "relative shrink-0 w-9 h-9 rounded-md overflow-hidden flex items-center justify-center border",
          isLightMode ? "bg-blue-100 border-blue-200" : "bg-elevated border-border"
        )}
      >
        {dj.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dj.imageUrl} alt={bossDisplayName} className="w-full h-full object-cover" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <DoorOpen className={cn("w-4 h-4", isLightMode ? "text-blue-500" : "text-muted-foreground")} />
        )}
        {dj.isOcre && (
          <div className="absolute -top-1 -right-1 bg-warning text-[8px] font-black text-warning-foreground px-1 py-0.5 rounded-full leading-none">Ocre</div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={cn("text-[12px] font-bold truncate", isLightMode ? "text-blue-900" : "text-foreground")}>{bossDisplayName}</p>
        <p className={cn("text-[10px] truncate", isLightMode ? "text-blue-600/70" : "text-muted-foreground")}>{dj.name || "Donjon"}</p>
      </div>
      <ExternalLink className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5", isLightMode ? "text-blue-600" : "text-muted-foreground group-hover:text-info")} />
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Voir la fiche boss de ${bossDisplayName}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors border border-transparent",
        isLightMode ? "hover:bg-blue-100/60 hover:border-blue-200" : "hover:bg-elevated hover:border-border-strong"
      )}
    >
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
      {inner}
    </div>
  );
}



"use client";

import React from "react";
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
          : "bg-[#111d2e] border-[#2a4a7a]/60",
        className
      )}
    >
      <p className={cn("text-[9px] font-black uppercase tracking-[0.12em]", isLightMode ? "text-blue-600" : "text-[#7baeff]")}>
        {dungeons.length > 1 ? "Donjons requis" : "Donjon requis"}
      </p>

      <div className="mt-1.5 space-y-0.5">
        {dungeons.map((dj, i) => {
          const href = guildId && dj?.id ? `/dashboard/${guildId}/succes?dungeon=${encodeURIComponent(dj.id)}&view=boss` : null;
          const inner = (
            <>
              <div
                className={cn(
                  "relative shrink-0 w-9 h-9 rounded-md overflow-hidden flex items-center justify-center border",
                  isLightMode ? "bg-blue-100 border-blue-200" : "bg-[#0d1827] border-[#2a4a7a]/50"
                )}
              >
                {dj.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dj.imageUrl} alt={dj.name || "Donjon"} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <DoorOpen className={cn("w-4 h-4", isLightMode ? "text-blue-500" : "text-[#5588cc]")} />
                )}
                {dj.isOcre && (
                  <div className="absolute -top-1 -right-1 bg-amber-500 text-[8px] font-black text-black px-1 py-0.5 rounded-full leading-none">Ocre</div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={cn("text-[12px] font-bold truncate", isLightMode ? "text-blue-900" : "text-[#c5d8f5]")}>{dj.name || "Donjon"}</p>
                {dj.bossName && (
                  <p className={cn("text-[10px] truncate", isLightMode ? "text-blue-600/70" : "text-[#7baeff]/60")}>Boss : {dj.bossName}</p>
                )}
              </div>
              <ExternalLink className={cn("w-3.5 h-3.5 shrink-0", isLightMode ? "text-blue-600" : "text-[#7baeff]")} />
            </>
          );
          return href ? (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Fiche boss : ${dj.bossName || dj.name}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors",
                isLightMode ? "hover:bg-blue-100/60" : "hover:bg-[#16294a]/40"
              )}
            >
              {inner}
            </a>
          ) : (
            <div key={i} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}



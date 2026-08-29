"use client";

import React from "react";
import { Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";

interface RushOverlayDungeonCardProps {
  dungeons: DungeonInfo[];
  isLightMode?: boolean;
  className?: string;
}

/**
 * Carte donjon bleue acier — jamais rouge.
 * Affiche 2 donjons max puis "+N voir tous" (expansion future).
 */
export function RushOverlayDungeonCard({
  dungeons,
  isLightMode = false,
  className,
}: RushOverlayDungeonCardProps) {
  if (dungeons.length === 0) return null;

  const visible = dungeons.slice(0, 2);
  const extra = dungeons.length - visible.length;

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 space-y-2",
        isLightMode
          ? "bg-blue-50 border-blue-200"
          : "bg-[#111d2e] border-[#2a4a7a]/60",
        className
      )}
    >
      {/* Label section */}
      <p
        className={cn(
          "text-[9px] font-black uppercase tracking-[0.12em]",
          isLightMode ? "text-blue-600" : "text-[#7baeff]"
        )}
      >
        {dungeons.length > 1 ? "Donjons requis" : "Donjon requis"}
      </p>

      {visible.map((dj, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {/* Vignette donjon */}
          <div
            className={cn(
              "relative shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center",
              isLightMode ? "bg-blue-100 border border-blue-200" : "bg-[#0d1827] border border-[#2a4a7a]/50"
            )}
          >
            {dj.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dj.imageUrl}
                alt={dj.name || "Donjon"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Sword
                className={cn(
                  "w-5 h-5",
                  isLightMode ? "text-blue-400" : "text-[#5588cc]"
                )}
              />
            )}
            {/* Badge Ocre */}
            {dj.isOcre && (
              <div className="absolute -top-1 -right-1 bg-amber-500 text-[8px] font-black text-black px-1 py-0.5 rounded-full leading-none">
                Ocre
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-[11px] font-bold truncate",
                isLightMode ? "text-blue-900" : "text-[#c5d8f5]"
              )}
            >
              {dj.name || "Donjon"}
            </p>
            {dj.bossName && (
              <p
                className={cn(
                  "text-[10px] truncate",
                  isLightMode ? "text-blue-600" : "text-[#7baeff]/80"
                )}
              >
                Boss : {dj.bossName}
              </p>
            )}
          </div>
        </div>
      ))}

      {extra > 0 && (
        <p
          className={cn(
            "text-[10px] font-bold",
            isLightMode ? "text-blue-500" : "text-[#7baeff]/70"
          )}
        >
          +{extra} autre{extra > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

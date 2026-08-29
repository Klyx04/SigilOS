"use client";

import React from "react";
import { X, Sun, Moon, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlayHeaderProps {
  guideName: string;
  guideSlug: string;
  guildId: string;
  dofusImageUrl: string;
  totalSteps: number;
  completedSteps: number;
  overallPct: number;
  isLightMode: boolean;
  onToggleTheme: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Header fixe de l'overlay.
 * - Nom du guide + progression explicite (N / M étapes · X%)
 * - Icône Dofus (œuf)
 * - Bascule thème Clair/Sombre
 * - Lien dashboard
 * - Bouton fermer (ne suppose pas window.close())
 */
export function RushOverlayHeader({
  guideName,
  guideSlug,
  guildId,
  dofusImageUrl,
  totalSteps,
  completedSteps,
  overallPct,
  isLightMode,
  onToggleTheme,
  onClose,
  className,
}: RushOverlayHeaderProps) {
  const handleClose = () => {
    onClose();
  };

  return (
    <header
      className={cn(
        "shrink-0 flex flex-col gap-2 px-4 pt-3 pb-2.5 border-b",
        isLightMode
          ? "bg-gradient-to-b from-white to-slate-50 border-slate-200"
          : "bg-gradient-to-b from-[#131820] to-[#0b0d10] border-[#1e2530]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Gauche : branding + titre + compteur */}
        <div className="flex-1 min-w-0">
          {/* Label discret */}
          <span
            className={cn(
              "block text-[9px] font-black uppercase tracking-[0.15em] mb-0.5",
              isLightMode ? "text-[#d5a94e]" : "text-[#d5a94e]/80"
            )}
          >
            Guide de progression
          </span>

          {/* Nom du guide */}
          <h1
            className={cn(
              "text-sm font-bold leading-tight truncate",
              isLightMode ? "text-slate-900" : "text-[#f2f0e9]"
            )}
          >
            {guideName}
          </h1>

          {/* Progression explicite */}
          <p
            className={cn(
              "text-[10px] mt-0.5 tabular-nums",
              isLightMode ? "text-slate-500" : "text-[#6e7784]"
            )}
          >
            <span className={cn("font-bold", isLightMode ? "text-slate-700" : "text-[#969daa]")}>
              {completedSteps} / {totalSteps}
            </span>{" "}
            étapes ·{" "}
            <span className="font-bold text-[#39bc95]">{overallPct}%</span>
          </p>
        </div>

        {/* Droite : actions + œuf Dofus */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Thème */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isLightMode ? "Passer en mode sombre" : "Passer en mode clair"}
            title={isLightMode ? "Mode Sombre" : "Mode Clair"}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                : "bg-[#181d23] border-[#2a3646] text-[#d5a94e] hover:bg-[#1f2733]"
            )}
          >
            {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Dashboard */}
          <a
            href={`/dashboard/${guildId}/quetes-dofus/guide/${guideSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ouvrir le guide complet"
            title="Ouvrir le guide complet"
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>


          {/* Œuf Dofus */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dofusImageUrl}
            alt="Dofus"
            className="w-9 h-9 object-contain drop-shadow-md transition-transform hover:scale-105"
          />

          {/* Fermer */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer l'overlay"
            title="Fermer"
            className={cn(
              "p-1 rounded-lg transition-colors",
              isLightMode
                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                : "text-[#4a5568] hover:text-red-400 hover:bg-red-950/20"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barre de progression globale */}
      <div
        className={cn(
          "w-full h-1 rounded-full overflow-hidden",
          isLightMode ? "bg-slate-200" : "bg-[#1e2530]"
        )}
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression globale : ${overallPct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${overallPct}%`,
            background: "linear-gradient(90deg, #2b9f7d, #39bc95)",
          }}
        />
      </div>
    </header>
  );
}

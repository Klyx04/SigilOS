"use client";

import { useEffect, useMemo, useState } from "react";
import GuideParticles from "./GuideParticles";
import { Settings2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Éclaircit un hex (#rrggbb ou #rgb) vers le blanc. */
function lighten(hex: string, amt: number): string {
  const m = (hex || "#6366f1").replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.length === 6 ? m : "6366f1";
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return "#6366f1";
  const r = Math.min(255, Math.round(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amt));
  const g = Math.min(255, Math.round(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amt));
  const b = Math.min(255, Math.round((num & 255) + (255 - (num & 255)) * amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

interface DofusPageOptionsProps {
  guildId: string;
  dofusSlug: string;
  /** Couleur officielle du Dofus (hex). */
  baseColor: string;
}

/**
 * Ambiance + options de la page par-Dofus :
 *  - particules de braises teintées à la couleur officielle du Dofus (halo inclus),
 *  - menu « Options » dans le bandeau du haut (activer/désactiver, localStorage scopé).
 */
export function DofusPageOptions({ guildId, dofusSlug, baseColor }: DofusPageOptionsProps) {
  const storageKey = `sigilos-dofus-particles-${guildId}-${dofusSlug}`;
  const [particles, setParticles] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v !== null) setParticles(v === "on");
    } catch {
      // localStorage indisponible → défaut ON, non bloquant
    }
  }, [storageKey]);

  const toggleParticles = (on: boolean) => {
    setParticles(on);
    try {
      localStorage.setItem(storageKey, on ? "on" : "off");
    } catch {
      // non bloquant
    }
  };

  const particleColors = useMemo(
    () => [baseColor, lighten(baseColor, 0.45), lighten(baseColor, 0.75)],
    [baseColor]
  );

  return (
    <>
      <GuideParticles active={particles} colors={particleColors} haloColor={baseColor} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-zinc-900/60 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 text-xs font-bold transition-colors"
            title="Options de la page"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Options</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Ambiance</p>
          <button
            type="button"
            onClick={() => toggleParticles(!particles)}
            className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
          >
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: particles ? baseColor : undefined }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">Particules Dofus</p>
              <p className="text-[10px] text-zinc-500">Braises teintées à la couleur du Dofus</p>
            </div>
            <span className={`inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ${particles ? "bg-emerald-500" : "bg-zinc-700"}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${particles ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </span>
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}

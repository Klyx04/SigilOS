"use client";

import { useState } from "react";
import { Swords, Tv2, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRaidOverlay } from "@/hooks/use-raid-overlay";
import { isDocumentPipSupported } from "@/hooks/use-guide-pip";
import { useI18n } from "@/lib/i18n/client";
import type { RaidSlug } from "@/store/raid-overlay-store";

interface RaidOverlayLaunchBannerProps {
  raidSlug: RaidSlug;
  raidName: string;
  /** Couleur de thème du raid (cyan pour Gigalodon, vert pour Jardin) */
  themeColor?: string;
  /** Mode compact pour la sidebar — masque la description verbose */
  compact?: boolean;
}

/**
 * Bandeau CTA affiché en haut de page sur les guides de raid.
 * Lance l'overlay de raid (Document PiP / popup fallback) au clic.
 */
export function RaidOverlayLaunchBanner({
  raidSlug,
  raidName,
  themeColor = "#06b6d4",
  compact = false,
}: RaidOverlayLaunchBannerProps) {
  const { openRaidOverlay, closeRaidOverlay, isOpen } = useRaidOverlay();
  const [loading, setLoading] = useState(false);
  const { locale } = useI18n();
  const isEn = locale === "en";
  const pipSupported = isDocumentPipSupported();

  const defaultEnName = raidSlug === "jardin-eternel" ? "Eternal Gardens Sanctuary" : "The Gigalodon Abyss";
  const displayRaidName = isEn
    ? (raidName === "Sanctuaire des Jardins Éternels" || raidName === "Gouffre du Gigalodon" ? defaultEnName : raidName)
    : raidName;

  const handleLaunch = async () => {
    if (isOpen) {
      closeRaidOverlay();
      return;
    }
    setLoading(true);
    try {
      await openRaidOverlay({ raidSlug });
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border p-3.5 space-y-3"
        style={{
          borderColor: `${themeColor}30`,
          background: `linear-gradient(135deg, ${themeColor}10 0%, rgba(255,255,255,0.02) 100%)`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border text-base"
            style={{
              backgroundColor: `${themeColor}15`,
              borderColor: `${themeColor}40`,
            }}
          >
            {raidSlug === "jardin-eternel" ? "🌹" : "🦈"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-foreground truncate">{displayRaidName}</span>
              {pipSupported && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0"
                  style={{
                    backgroundColor: `${themeColor}20`,
                    color: themeColor,
                    border: `1px solid ${themeColor}40`,
                  }}
                >
                  PiP ✓
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {pipSupported
                ? (isEn ? "Detachable PiP window" : "Fenêtre PiP détachable")
                : (isEn ? "Floating mini-window" : "Mini-fenêtre flottante")}
            </p>
          </div>
        </div>

        <button
          id={`raid-overlay-launch-compact-${raidSlug}`}
          onClick={handleLaunch}
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border shadow-sm",
            isOpen
              ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
              : "text-black hover:brightness-110 active:scale-[0.98]"
          )}
          style={
            isOpen
              ? {}
              : {
                  backgroundColor: themeColor,
                  borderColor: themeColor,
                  boxShadow: `0 2px 12px ${themeColor}30`,
                }
          }
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : isOpen ? (
            <Tv2 size={13} />
          ) : (
            <Swords size={13} />
          )}
          <span>{loading ? (isEn ? "Opening…" : "Ouverture…") : isOpen ? (isEn ? "Close Overlay" : "Fermer l'overlay") : (isEn ? "Launch Overlay" : "Lancer l'Overlay")}</span>
          {!loading && !isOpen && <ChevronRight size={13} />}
        </button>

        <a
          href={`/raids?raid=${raidSlug === "jardin-eternel" ? "sanctuaire" : "gigalodon"}`}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-colors"
        >
          <Swords size={12} style={{ color: themeColor }} />
          <span>{isEn ? "Raid Studio 3.6 (Tools & Roles)" : "Raid Studio 3.6 (Outils & Rôles)"}</span>
          <ExternalLink size={10} className="opacity-50" />
        </a>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border mb-8"
      style={{
        borderColor: `${themeColor}30`,
        background: `linear-gradient(135deg, ${themeColor}08 0%, transparent 60%)`,
      }}
    >
      {/* Glow effet background */}
      <div
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
        {/* Icône */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border text-xl"
          style={{
            backgroundColor: `${themeColor}15`,
            borderColor: `${themeColor}40`,
          }}
        >
          {raidSlug === "jardin-eternel" ? "🌹" : "🦈"}
        </div>

        {/* Texte */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-black uppercase tracking-widest mb-0.5"
            style={{ color: themeColor }}
          >
            {isEn ? "In-game overlay available" : "Overlay In-Game disponible"}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {isEn ? (
              <>Follow <strong>{displayRaidName}</strong> step by step, zero alt-tab</>
            ) : (
              <>Suivez le <strong>{displayRaidName}</strong> étape par étape, sans jamais alt-tab</>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEn
              ? `Floating mini-window ${pipSupported ? "always on top (PiP)" : "detachable"} · Strats, mechanics and coords in 1 click`
              : `Mini-fenêtre flottante ${pipSupported ? "toujours au premier plan (PiP)" : "détachable"} · Stratégies, mécaniques et coordonnées en 1 clic`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            id={`raid-overlay-launch-${raidSlug}`}
            onClick={handleLaunch}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all border w-full sm:w-auto justify-center",
              isOpen
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                : "text-black hover:brightness-110 active:scale-95 shadow-lg"
            )}
            style={
              isOpen
                ? {}
                : {
                    backgroundColor: themeColor,
                    borderColor: themeColor,
                    boxShadow: `0 4px 20px ${themeColor}40`,
                  }
            }
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isOpen ? (
              <Tv2 size={15} />
            ) : (
              <Swords size={15} />
            )}
            <span>{loading ? (isEn ? "Opening…" : "Ouverture…") : isOpen ? (isEn ? "Close Overlay" : "Fermer l'overlay") : (isEn ? "Launch Overlay" : "Lancer l'Overlay")}</span>
            {!loading && !isOpen && <ChevronRight size={14} />}
          </button>

          {/* Lien Raid Studio 3.6 */}
          <a
            href={`/raids?raid=${raidSlug === "jardin-eternel" ? "sanctuaire" : "gigalodon"}`}
            className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/5 text-white/70 hover:text-white transition-all shrink-0 flex items-center gap-1.5 text-xs font-semibold"
            title={isEn ? "Open Raid Studio 3.6 (Planner & Tools)" : "Ouvrir Raid Studio 3.6 (Planificateur & Outils)"}
          >
            <Swords size={13} style={{ color: themeColor }} />
            <span className="hidden sm:inline">Raid Studio</span>
          </a>

          {/* Lien guide complet en icon */}
          <a
            href={`/guides/${raidSlug === "gigalodon" ? "raid-gigalodon-dofus-guide" : "guide-sanctuaire-jardins-eternels"}`}
            className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/5 text-white/50 hover:text-white transition-all shrink-0"
            title={isEn ? "View full guide" : "Voir le guide complet"}
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </div>

      {/* Badge PiP */}
      {pipSupported && !isOpen && (
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: `${themeColor}20`,
            color: themeColor,
            border: `1px solid ${themeColor}40`,
          }}
        >
          PiP ✓
        </div>
      )}
    </div>
  );
}

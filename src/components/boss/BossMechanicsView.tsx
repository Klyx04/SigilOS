import React, { useMemo, useState } from "react";
import { Shield, RefreshCw, Users, Lock, Clock, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BossPassiveEffect {
  effectId?: number | null;
  label: string;
  type: "invulnerable" | "swap" | "resurrect" | "glyph" | "buff" | "unknown";
  duration: string;
  isLocked?: boolean;
}

export interface BossPassiveData {
  spellId?: number;
  name: string;
  description: string;
  iconId?: number;
  effects?: BossPassiveEffect[];
}

interface BossMechanicsViewProps {
  passive: BossPassiveData;
  className?: string;
  isCompact?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * Colorisation sémantique des mécaniques officielles Dofus.
 * Palette sobre : on s'appuie sur le design system (foreground/muted) avec
 * des accents discrets seulement là où c'est nécessaire à la lisibilité.
 */
function renderHighlightedText(text: string) {
  if (!text) return null;

  const paragraphs = text.split(/\n\s*\n/);

  return (
    <div className="space-y-2 leading-relaxed text-[12px]">
      {paragraphs.map((p, pIdx) => {
        const parts = p.split(
          /(Invuln[ée]rabilit[ée]|Invuln[ée]rable|Ind[ée]pla[çc]able|Intacleur|Sceaux?|glyphes?(?:-aura)?|ressuscit[ée]s?|ressuscite|tu[ée]s?|mort|N[ée]cronyx|Aurore|Z[ée]nith|Cr[ée]puscule|Nadir|\d+\s*(?:à|a)\s*\d+\s*%|\d+\s*(?:PM|PA|PO|cases?|tours?))/gi
        );

        return (
          <p key={pIdx} className="text-muted-foreground font-normal">
            {parts.map((part, i) => {
              const lower = part.toLowerCase();

              // États absolus : on souligne discrètement, pas de couleur flashy
              if (lower.includes("invuln") || lower.includes("indépla") || lower.includes("intacleur")) {
                return (
                  <strong key={i} className="text-foreground font-semibold underline decoration-border underline-offset-2">
                    {part}
                  </strong>
                );
              }

              // Sceaux / Glyphes : léger fond
              if (lower.includes("sceau") || lower.includes("glyphe")) {
                return (
                  <strong key={i} className="text-foreground font-semibold bg-accent/40 px-1 py-0.5 rounded">
                    {part}
                  </strong>
                );
              }

              // Morts / Résurrections
              if (lower.includes("ressuscit") || lower.includes("tué") || lower === "mort") {
                return (
                  <strong key={i} className="text-foreground font-medium">
                    {part}
                  </strong>
                );
              }

              // Phases nommées (Nécronyx, Aurore…)
              if (
                lower.includes("nécronyx") ||
                lower.includes("aurore") ||
                lower.includes("zénith") ||
                lower.includes("crépuscule") ||
                lower.includes("nadir")
              ) {
                return (
                  <strong key={i} className="text-warning font-semibold">
                    {part}
                  </strong>
                );
              }

              // Chiffres & mesures : monospace, légèrement mis en avant
              if (/\d+/.test(part)) {
                return (
                  <strong key={i} className="font-mono text-foreground/90 font-bold">
                    {part}
                  </strong>
                );
              }

              return <span key={i}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function BossMechanicsView({
  passive,
  className,
  isCompact = false,
  collapsible = true,
  defaultCollapsed = false,
}: BossMechanicsViewProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const iconSrc = useMemo(() => {
    if (passive.iconId && passive.iconId > 0) {
      return `/uploads/assets-dofus/spells/sort_${passive.iconId}.webp`;
    }
    return null;
  }, [passive.iconId]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/40 text-foreground overflow-hidden transition-colors",
        className
      )}
    >
      {/* ── En-tête du Sort Passif (cliquable si collapsible) ── */}
      <div
        onClick={collapsible ? () => setIsCollapsed((v) => !v) : undefined}
        className={cn(
          "flex items-center gap-3 p-3 bg-background/60 select-none",
          collapsible && "cursor-pointer hover:bg-background/80 transition-colors",
          !isCollapsed && "border-b border-border"
        )}
      >
        <div className="relative w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
          {iconSrc ? (
            <img
              src={iconSrc}
              alt={passive.name}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/dofus/modules/spells.png";
              }}
            />
          ) : (
            <Sparkles className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-foreground tracking-wide truncate">
              {passive.name}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
              Début de combat
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              Rang 1
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {isCollapsed ? "Cliquer pour afficher la mécanique détaillée" : "Mécanique officielle — client Unity"}
          </p>
        </div>

        {collapsible && (
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label={isCollapsed ? "Déplier la stratégie" : "Replier la stratégie"}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                !isCollapsed && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* ── Corps : Description colorisée ── */}
      {!isCollapsed && (
        <div className={cn("p-3.5", isCompact ? "space-y-2 text-xs" : "space-y-3")}>
          {renderHighlightedText(passive.description)}

        {/* ── Effets ── */}
        {passive.effects && passive.effects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Effets
            </span>
            <div className="space-y-1.5 rounded-lg bg-background border border-border/60 p-2.5">
              {passive.effects.map((eff, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    {eff.type === "invulnerable" && (
                      <span className="w-4 h-4 rounded bg-accent flex items-center justify-center shrink-0">
                        <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    )}
                    {eff.type === "swap" && (
                      <span className="w-4 h-4 rounded bg-accent flex items-center justify-center shrink-0">
                        <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    )}
                    {eff.type === "resurrect" && (
                      <span className="w-4 h-4 rounded bg-accent flex items-center justify-center shrink-0">
                        <Users className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    )}
                    {eff.type !== "invulnerable" && eff.type !== "swap" && eff.type !== "resurrect" && (
                      <span className="w-4 h-4 rounded bg-accent flex items-center justify-center shrink-0">
                        <Sparkles className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    )}

                    <span className="text-foreground/80 font-medium truncate">
                      {eff.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-muted-foreground">
                    <span>— {eff.duration}</span>
                    <Clock className="w-2.5 h-2.5 opacity-50" />
                    {eff.isLocked && <Lock className="w-2.5 h-2.5 opacity-40" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

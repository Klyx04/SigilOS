"use client";

import type { ReactNode } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

interface SimulationTacticalLegendProps {
  /** Déplié / replié — piloté par l'appelant (un seul état pour les deux modes). */
  open: boolean;
  onToggle: () => void;
  /** Carte réelle chargée ⇒ les entrées de terrain (sol / obstacle / trou) ont un sens. */
  isRealMap: boolean;
  showAllies: boolean;
  showEnemies: boolean;
  enemyIconUrl: string;
  /** `compact` = fenêtre de jeu (lignes serrées) · `full` = fiche / landing. */
  variant?: "compact" | "full";
  /** Rappel du mode « Boss libre » (une ligne) — affiché DANS le corps déplié. */
  freeBossHint: string;
  className?: string;
}

/** Pastille de couleur de la légende (on lit la couleur, pas un mot de plus). */
function Swatch({ background, border }: { background: string; border?: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
      style={{ background, border: border ? `1px solid ${border}` : undefined }}
    />
  );
}

/**
 * Légende du plateau tactique — **source unique** des deux modes (vue de jeu compacte et
 * simulation complète).
 *
 * 🎯 Retour user (21/09/2026) : « légende bcp trop grosse ». Elle était rendue **dépliée en
 * permanence** en mode complet (12 entrées + un paragraphe de 3 phrases) et **recopiée en
 * français codé en dur** dans le mode compact. Désormais : repliée par défaut **partout**,
 * structurée en **3 familles** (Cases · Ciblage · Personnages & états), entrées conditionnées
 * à ce qui est réellement affiché sur le plateau, et textes i18n (une seule source).
 */
export function SimulationTacticalLegend({
  open,
  onToggle,
  isRealMap,
  showAllies,
  showEnemies,
  enemyIconUrl,
  variant = "full",
  freeBossHint,
  className,
}: SimulationTacticalLegendProps) {
  const { t } = useI18n();
  const simT = t.tacticalSim;
  const isCompact = variant === "compact";

  const groups: { title: string; entries: { label: string; swatch: ReactNode }[] }[] = [
    {
      title: simT.legendGroups.cells,
      entries: isRealMap
        ? [
            { label: simT.legend.walkable, swatch: <Swatch background="#8D8A66" /> },
            { label: simT.legend.obstacle, swatch: <Swatch background="#777358" border="#5C5945" /> },
            { label: simT.legend.hole, swatch: <Swatch background="#050505" border="#3a3a3a" /> },
          ]
        : [],
    },
    {
      title: simT.legendGroups.targeting,
      entries: [
        { label: simT.legend.spellRange, swatch: <Swatch background="#79b638" /> },
        { label: simT.legend.aoe, swatch: <Swatch background="#e0a320" border="#ffcf5e" /> },
      ],
    },
    {
      title: simT.legendGroups.states,
      entries: [
        { label: simT.legend.boss, swatch: <Swatch background="#6b1d1d" border="#c53030" /> },
        ...(showAllies
          ? [
              {
                label: simT.legend.player,
                swatch: (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/assets/module-succes/feca.webp"
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 rounded-[2px] object-contain"
                  />
                ),
              },
              { label: simT.legend.outOfRange, swatch: <Swatch background="#1e3a5f" border="#3b82f6" /> },
              { label: simT.legend.hitByZone, swatch: <Swatch background="#a11c1c" border="#ef4444" /> },
            ]
          : []),
        ...(showEnemies
          ? [
              {
                label: simT.legend.enemy,
                swatch: (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={enemyIconUrl}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 rounded-[2px] object-contain"
                  />
                ),
              },
              { label: simT.legend.enemyHitByZone, swatch: <Swatch background="#a11c1c" border="#ef4444" /> },
            ]
          : []),
        { label: simT.legend.startPlayers, swatch: <Swatch background="#8a3a30" border="#c65a4a" /> },
        { label: simT.legend.startMonsters, swatch: <Swatch background="#2e5a8a" border="#4a86c4" /> },
      ],
    },
  ];

  return (
    <div
      className={cn(
        "relative z-30 w-full shrink-0 border-t",
        // Vue de jeu : palette du plateau (sombre, comme la carte). Fiche / landing : jetons
        // de thème, pour rester lisible en thème clair.
        isCompact ? "mt-1.5 border-white/5 bg-[#161614] pt-1" : "mt-2 border-border pt-1.5",
        className
      )}
    >
      {/* Une seule ligne visible quand c'est replié : c'est tout l'objet du correctif. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 transition-colors",
          isCompact
            ? "text-[10px] text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            : "text-[11px] text-muted-foreground hover:bg-surface hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {simT.legendTitle}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 space-y-2 px-1">
          {groups
            .filter((group) => group.entries.length > 0)
            .map((group) => (
              <div key={group.title} className="space-y-1">
                <p
                  className={cn(
                    "text-[9px] font-black uppercase tracking-[0.14em]",
                    isCompact ? "text-zinc-500" : "text-muted-foreground"
                  )}
                >
                  {group.title}
                </p>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px]",
                    isCompact ? "text-zinc-400" : "text-muted-foreground"
                  )}
                >
                  {group.entries.map((entry) => (
                    <span key={entry.label} className="inline-flex items-center gap-1.5">
                      {entry.swatch}
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}

          <p
            className={cn(
              "text-[10px] leading-tight",
              isCompact ? "text-zinc-500" : "text-muted-foreground"
            )}
          >
            💡 {freeBossHint}
            {simT.helpers.mouseControls}
          </p>
        </div>
      )}
    </div>
  );
}

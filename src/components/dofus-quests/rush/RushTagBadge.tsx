"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Swords, X } from "lucide-react";
import type { RushActivityTag } from "@/types/rush-guide-types";
import { RUSH_ACTIVITY_TAG_CONFIG } from "@/lib/rush-guide-utils";
import { getTagBadgeIcon } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { cn } from "@/lib/utils";

/**
 * La fiche interne tire une action serveur : on la charge **à la demande**, pour
 * ne pas l'importer dans le graphe du badge (guides public/overlay) ni dans les
 * tests qui ne font que rendre l'étiquette.
 */
const RushMonsterFicheModal = dynamic(
  () => import("./RushMonsterFicheModal").then((mod) => mod.RushMonsterFicheModal),
  { ssr: false }
);

/** Surface du badge : la fiche interne n'est ouverte qu'aux membres. */
export type RushTagViewer = "member" | "visitor" | "preview";

/** Vignette d'un monstre : proxy d'assets maison, repli arme (jamais de 404). */
function RushMonsterThumb({ id, alt }: { id?: number; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!id || failed) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-surface text-muted-foreground/40">
        <Swords className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/assets-dofus/monsters/${id}`}
      alt={alt}
      className="h-8 w-8 shrink-0 rounded-[3px] bg-surface object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

interface RushTagBadgeProps {
  tag: RushActivityTag;
  size?: "sm" | "md";
  className?: string;
  /** Surface : `member` ouvre la fiche interne, `visitor` le lien public. */
  viewer?: RushTagViewer;
}

/**
 * Étiquette d'activité d'une étape (item, combat, donjon, condition…).
 * Le clic ouvre le détail du badge.
 *
 * Le détail est une modale **inline**, pas un portail Radix : elle doit rester
 * dans l'arbre DOM qui porte le thème (l'overlay pose `.light` sur sa racine ;
 * un portail s'échapperait vers `<body>` et retrouverait le thème sombre). D'où
 * aussi le rayon 6 px et les libellés en casse normale, comme la modale
 * « Détails de la quête ».
 */
export function RushTagBadge({ tag, size = "sm", className, viewer = "preview" }: RushTagBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheet, setSheet] = useState<{ slug: string; name: string } | null>(null);

  // Fermeture au clavier : une modale cède à Échap, sauf quand la fiche interne
  // est ouverte (elle a son propre Échap et reste au-dessus).
  useEffect(() => {
    if (!modalOpen || sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // Tags techniques non affichés comme badges interactifs (`npc` a son
  // affichage dédié `NpcBadge` : nom + portrait par convention).
  if (["pos_tags", "prereq_text", "tougli_box", "info_sequence", "dofus_link", "npc"].includes(tag.type)) {
    return null;
  }

  const config = RUSH_ACTIVITY_TAG_CONFIG[tag.type];
  const monsters = tag.monsters ?? [];
  const hasMonsters = monsters.length > 0;
  const rawLabel = tag.name || config?.label || tag.type;
  const label = hasMonsters
    ? `Groupe · ${monsters.length} monstre${monsters.length > 1 ? "s" : ""}`
    : rawLabel;
  const iconSrc = getTagBadgeIcon({ type: tag.type, name: tag.name });

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title={`Cliquer pour détails : ${rawLabel}`}
        aria-label={`Détails du tag ${rawLabel}`}
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[3px] border border-border bg-surface text-left text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground",
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
          className
        )}
      >
        {iconSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
        )}
        {label && <span className="min-w-0 truncate font-medium">{label}</span>}
        {tag.level && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">Niv. {tag.level}</span>}
        {tag.count && tag.count > 1 && (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-warning">×{tag.count}</span>
        )}
      </button>

      {/* Détail du badge */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
          aria-label={`Détail du badge ${rawLabel}`}
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => {
              setModalOpen(false);
              setSheet(null);
            }}
            className="fixed inset-0 bg-black/60"
          />
          <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{config?.label ?? "Badge"}</p>
                <h3 className="mt-0.5 break-words text-[14px] font-semibold leading-snug text-foreground">{rawLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSheet(null);
                }}
                aria-label="Fermer"
                className="-mr-1 -mt-1 shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 text-[12px] text-muted-foreground">
              {hasMonsters && (
                <div className="space-y-1">
                  {monsters.map((monster, index) => (
                    <div
                      key={`${monster.slug ?? monster.name}-${index}`}
                      className="flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
                    >
                      <RushMonsterThumb id={monster.gfxId ?? monster.monsterId} alt={monster.name} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                        {monster.name}
                      </span>
                      {monster.slug && viewer === "member" && (
                        <button
                          type="button"
                          onClick={() => setSheet({ slug: monster.slug!, name: monster.name })}
                          className="shrink-0 rounded-[4px] border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-elevated"
                        >
                          Fiche
                        </button>
                      )}
                      {monster.slug && viewer === "visitor" && (
                        <a
                          href={`/bestiaire/${monster.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-[4px] border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-elevated"
                        >
                          Fiche
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {tag.name && !hasMonsters && <p className="break-words font-semibold text-foreground">{tag.name}</p>}
              {tag.level && (
                <p>
                  Niveau requis : <strong className="font-semibold text-foreground">{tag.level}</strong>
                </p>
              )}
              {tag.count && tag.count > 1 && (
                <p>
                  Quantité : <strong className="font-semibold text-foreground">×{tag.count}</strong>
                </p>
              )}
              {tag.url && (
                <a
                  href={tag.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block pt-0.5 text-[12px] font-semibold text-accent underline decoration-1 underline-offset-[0.28em] transition-colors hover:text-foreground"
                >
                  Ouvrir la source
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <RushMonsterFicheModal
          slug={sheet.slug}
          name={sheet.name}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { RushActivityTag } from "@/types/rush-guide-types";
import { RUSH_ACTIVITY_TAG_CONFIG } from "@/lib/rush-guide-utils";
import { getTagBadgeIcon } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { cn } from "@/lib/utils";

interface RushTagBadgeProps {
  tag: RushActivityTag;
  size?: "sm" | "md";
  className?: string;
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
export function RushTagBadge({ tag, size = "sm", className }: RushTagBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Fermeture au clavier : une modale cède à Échap.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // Tags techniques non affichés comme badges interactifs
  if (["pos_tags", "prereq_text", "tougli_box", "info_sequence", "dofus_link"].includes(tag.type)) {
    return null;
  }

  const config = RUSH_ACTIVITY_TAG_CONFIG[tag.type];
  const label = tag.name || config?.label || tag.type;
  const iconSrc = getTagBadgeIcon({ type: tag.type, name: tag.name });

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title={`Cliquer pour détails : ${label}`}
        aria-label={`Détails du tag ${label}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[3px] border border-border bg-surface text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground",
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
          className
        )}
      >
        {iconSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
        )}
        {label && <span className="truncate font-medium">{label}</span>}
        {tag.level && <span className="text-[10px] tabular-nums text-muted-foreground">Niv. {tag.level}</span>}
        {tag.count && tag.count > 1 && (
          <span className="text-[10px] font-semibold tabular-nums text-warning">×{tag.count}</span>
        )}
      </button>

      {/* Détail du badge */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
          aria-label={`Détail du badge ${label}`}
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-black/60"
          />
          <div className="relative z-10 w-full max-w-[20rem] overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
            <header className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{config?.label ?? "Badge"}</p>
                <h3 className="mt-0.5 text-[14px] font-semibold leading-snug text-foreground">{label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="-mr-1 -mt-1 shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-1.5 px-3.5 py-3 text-[12px] text-muted-foreground">
              {tag.name && <p className="font-semibold text-foreground">{tag.name}</p>}
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
    </>
  );
}

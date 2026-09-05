"use client";

import React, { useState } from "react";
import type { RushActivityTag } from "@/types/rush-guide-types";
import { RUSH_ACTIVITY_TAG_CONFIG } from "@/lib/rush-guide-utils";
import { getTagBadgeIcon } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RushTagBadgeProps {
  tag: RushActivityTag;
  size?: "sm" | "md";
  className?: string;
}

export function RushTagBadge({ tag, size = "sm", className }: RushTagBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

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
          "inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none",
          "bg-elevated hover:bg-muted text-muted-foreground hover:text-foreground border-border hover:border-border-strong",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        {iconSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" className="w-3.5 h-3.5 object-contain shrink-0" loading="lazy" />
        )}
        {label && (
          <span className="font-medium truncate max-w-[140px]">{label}</span>
        )}
        {tag.level && (
          <span className="text-[10px] text-muted-foreground font-mono">Niv.{tag.level}</span>
        )}
        {tag.count && tag.count > 1 && (
          <span className="text-[10px] text-warning/90 font-mono font-bold">×{tag.count}</span>
        )}
      </button>

      {/* Mini-Modal de détail */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[320px] bg-background border-border text-foreground p-5 rounded-2xl">
          <DialogHeader className="flex flex-col items-center text-center gap-2">
            <DialogTitle className="text-base font-bold font-serif text-foreground mt-1">
              {config?.label || label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2 text-center text-xs text-muted-foreground">
            {tag.name && <p className="font-semibold text-warning/90">{tag.name}</p>}
            {tag.level && <p className="text-muted-foreground">Niveau requis : <strong className="text-foreground">{tag.level}</strong></p>}
            {tag.count && tag.count > 1 && (
              <p className="text-muted-foreground">Quantité : <strong className="text-foreground">×{tag.count}</strong></p>
            )}
            {tag.url && (
              <a
                href={tag.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline text-[11px] mt-1 inline-block"
              >
                Lien externe →
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

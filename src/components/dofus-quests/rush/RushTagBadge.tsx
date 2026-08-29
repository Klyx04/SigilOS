"use client";

import React, { useState } from "react";
import type { RushActivityTag } from "@/types/rush-guide-types";
import { RUSH_ACTIVITY_TAG_CONFIG, getMetierIconPath } from "@/lib/rush-guide-utils";
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
  const iconPath =
    tag.imageUrl ||
    (tag.type === "metier" ? getMetierIconPath(tag.name) : config?.imagePath);

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
          "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10 hover:border-white/20",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        {iconPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconPath}
            alt={label}
            className={cn("object-contain shrink-0", size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")}
          />
        )}
        <span className="font-medium truncate max-w-[140px]">{label}</span>
        {tag.level && (
          <span className="text-[10px] text-zinc-500 font-mono">Niv.{tag.level}</span>
        )}
        {tag.count && tag.count > 1 && (
          <span className="text-[10px] text-amber-400/90 font-mono font-bold">×{tag.count}</span>
        )}
      </button>

      {/* Mini-Modal de détail */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[320px] bg-zinc-950/95 border-white/10 text-zinc-100 p-5 rounded-2xl">
          <DialogHeader className="flex flex-col items-center text-center gap-2">
            {iconPath && (
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center p-2.5 shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconPath} alt={label} className="w-full h-full object-contain" />
              </div>
            )}
            <DialogTitle className="text-base font-bold font-serif text-zinc-100 mt-1">
              {config?.label || label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2 text-center text-xs text-zinc-300">
            {tag.name && <p className="font-semibold text-amber-300/90">{tag.name}</p>}
            {tag.level && <p className="text-zinc-400">Niveau requis : <strong className="text-zinc-200">{tag.level}</strong></p>}
            {tag.count && tag.count > 1 && (
              <p className="text-zinc-400">Quantité : <strong className="text-zinc-200">×{tag.count}</strong></p>
            )}
            {tag.url && (
              <a
                href={tag.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-[11px] mt-1 inline-block"
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

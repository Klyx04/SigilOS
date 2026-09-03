"use client";

import React, { useState } from "react";
import { Package, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import type { RushActivityTag } from "@/types/rush-guide-types";
import { resolveItemImage } from "./overlay-utils";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";

interface RushOverlayResourceListProps {
  items: RushActivityTag[];
  isLightMode?: boolean;
  /** Max éléments visibles avant "voir plus" */
  maxVisible?: number;
  className?: string;
}

/**
 * Liste verticale "À PRÉVOIR" — jamais de chips horizontales.
 * Deux éléments max visibles ; au-delà, bouton "+ N autres".
 */
export function RushOverlayResourceList({
  items,
  isLightMode = false,
  maxVisible = 2,
  className,
}: RushOverlayResourceListProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, maxVisible);
  const extra = items.length - maxVisible;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-[9px] font-black uppercase tracking-[0.12em]",
            isLightMode ? "text-amber-600" : "text-[#d5a94e]/80"
          )}
        >
          À prévoir
        </p>
        <span
          className={cn(
            "text-[9px] font-mono tabular-nums",
            isLightMode ? "text-slate-400" : "text-[#6e7784]"
          )}
        >
          {items.length}
        </span>
      </div>

      {/* Liste */}
      <div className="space-y-1">
        {visible.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Image ou fallback */}
            <div
              className={cn(
                "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border",
                isLightMode
                  ? "bg-amber-50 border-amber-200"
                  : "bg-[#1c2129] border-[#2c3646]"
              )}
            >
              {resolveItemImage(item.id, item.imageUrl) ? (
                <ResourceImage
                  id={item.id}
                  imageUrl={item.imageUrl}
                  alt={item.name || ""}
                  className="w-5 h-5 object-contain"
                />
              ) : (
                <Package
                  className={cn(
                    "w-3.5 h-3.5",
                    isLightMode ? "text-amber-400" : "text-[#d5a94e]/60"
                  )}
                />
              )}
            </div>

            {/* Nom + Niveau */}
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => { copyToClipboard(item.name || "").then((ok) => { if (ok) toast.success(`Nom copié : ${item.name}`, { duration: 1600 }); }); }}
                title={`Copier le nom « ${item.name} »`}
                aria-label={`Copier le nom ${item.name}`}
                className={cn(
                  "text-[11px] font-semibold truncate leading-tight min-w-0 block w-full max-w-full text-left",
                  isLightMode ? "text-slate-800" : "text-[#e8e4da]",
                  "hover:text-[#d5a94e] transition-colors cursor-pointer"
                )}
              >
                {item.name}
              </button>
              {item.level && (
                <p
                  className={cn(
                    "text-[9px]",
                    isLightMode ? "text-slate-400" : "text-[#6e7784]"
                  )}
                >
                  Niveau {item.level}
                </p>
              )}
            </div>

            {/* Quantité */}
            <span
              className={cn(
                "shrink-0 text-[11px] font-bold font-mono tabular-nums",
                isLightMode ? "text-amber-700" : "text-[#e6c16f]"
              )}
            >
              ×{(item as any).count || (item as any).quantity || 1}
            </span>
          </div>
        ))}
      </div>

      {/* Voir plus */}
      {!expanded && extra > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold transition-colors",
            isLightMode
              ? "text-amber-600 hover:text-amber-700"
              : "text-[#d5a94e]/70 hover:text-[#d5a94e]"
          )}
        >
          <ChevronDown className="w-3 h-3" />
          +{extra} autre{extra > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

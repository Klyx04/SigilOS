"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RushTagBadge } from "@/components/dofus-quests/rush/RushTagBadge";
import type { TagClassification } from "./overlay-utils";

interface RushOverlayTagSectionProps {
  tags: TagClassification;
  isLightMode?: boolean;
  className?: string;
}

/**
 * Tags classifiés A / B / C.
 * A (nature) — affichés directement, max 4.
 * B (conditions) — section repliable courte.
 * C (outils) — masqués, accessible via "Détails utiles".
 */
export function RushOverlayTagSection({
  tags,
  isLightMode = false,
  className,
}: RushOverlayTagSectionProps) {
  const [showConditions, setShowConditions] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const hasNature = tags.nature.length > 0;
  const hasCondition = tags.condition.length > 0;
  const hasTools = tags.tool.length > 0;

  if (!hasNature && !hasCondition && !hasTools) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* A — Nature de l'étape */}
      {hasNature && (
        <div className="flex flex-wrap gap-1">
          {tags.nature.slice(0, 4).map((tag, i) => (
            <RushTagBadge key={i} tag={tag} size="sm" />
          ))}
          {tags.nature.length > 4 && (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                isLightMode
                  ? "bg-slate-100 border-slate-200 text-slate-500"
                  : "bg-[#1c2129] border-[#2c3646] text-[#6e7784]"
              )}
            >
              +{tags.nature.length - 4}
            </span>
          )}
        </div>
      )}

      {/* B — Conditions (repliable) */}
      {hasCondition && (
        <div>
          <button
            type="button"
            onClick={() => setShowConditions((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold transition-colors",
              isLightMode
                ? "text-slate-500 hover:text-slate-700"
                : "text-[#6e7784] hover:text-[#969daa]"
            )}
            aria-expanded={showConditions}
          >
            {showConditions ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {tags.condition.length} condition{tags.condition.length > 1 ? "s" : ""}
          </button>

          {showConditions && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.condition.map((tag, i) => (
                <RushTagBadge key={i} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* C — Outils / Détails utiles (repliable) */}
      {hasTools && (
        <div>
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold transition-colors",
              isLightMode
                ? "text-slate-400 hover:text-slate-600"
                : "text-[#50606e] hover:text-[#6e7784]"
            )}
            aria-expanded={showTools}
          >
            {showTools ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            Détails utiles
          </button>

          {showTools && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.tool.map((tag, i) => (
                <RushTagBadge key={i} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

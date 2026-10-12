"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RushTagBadge } from "@/components/dofus-quests/rush/RushTagBadge";
import type { TagClassification } from "./overlay-utils";

interface RushOverlayTagSectionProps {
  tags: TagClassification;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode?: boolean;
  className?: string;
}

/**
 * Tags classifiés A / B / C.
 * A (nature) — affichés directement, max 4.
 * B (conditions) — section repliable courte.
 * C (outils) — masqués, accessible via "Détails utiles".
 *
 * Un badge est une étiquette, pas une décoration : rayon 3 px, filet 1 px,
 * surface du thème. Les étiquettes portent des icônes de jeu (`RushTagBadge`
 * résout l'icône officielle) — c'est l'immersion, sans couleur ajoutée.
 */
export function RushOverlayTagSection({ tags, className }: RushOverlayTagSectionProps) {
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
            <span className="inline-flex items-center rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showConditions}
          >
            {showConditions ? (
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
            {tags.condition.length} condition{tags.condition.length > 1 ? "s" : ""}
          </button>

          {showConditions && (
            <div className="mt-1.5 flex flex-wrap gap-1">
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
            className="flex items-center gap-1 text-[11px] font-semibold text-subtle-foreground transition-colors hover:text-muted-foreground"
            aria-expanded={showTools}
          >
            {showTools ? (
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
            Détails utiles
          </button>

          {showTools && (
            <div className="mt-1.5 flex flex-wrap gap-1">
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

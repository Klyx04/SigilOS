"use client";

import { ChevronDown } from "lucide-react";
import { splitDofusDexTip } from "@/lib/rush-dofusdex-tip";
import { cn } from "@/lib/utils";
import type { RushQuestConstraints as RushQuestConstraintsModel } from "@/types/rush-constraints";
import { RushTipLines } from "./RushTipLines";

/**
 * Tips d'un bloc du Rush, avec le **pavé DofusDex replié**.
 *
 * Mesure du 19/11/2026 : 13 blocs portent un tips de 13 à 51 lignes (« DofusDex officiel »
 * + une puce par objectif), rendu entier dans le dashboard et l'overlay. Le dépliable
 * n'enlève aucune donnée : il garde le **nom du Dofus**, le **nombre d'objectifs**, et
 * laisse visibles les sections `Prérequis` / `Donjons` qui suivent.
 *
 * Sans section officielle reconnaissable, le composant rend le tips tel quel (aucune
 * régression pour les quêtes et les blocs sans DofusDex).
 */
export function RushDofusDexTip({
  text,
  constraints,
  className,
}: {
  text: string | null | undefined;
  constraints?: RushQuestConstraintsModel | null;
  className?: string;
}) {
  const { official, rest } = splitDofusDexTip(text);
  if (!official) return <RushTipLines text={text} constraints={constraints} className={className} />;

  return (
    <div className={cn("space-y-2", className)}>
      <details className="group overflow-hidden rounded-[4px] border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown
            className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{official.summary}</span>
          <span className="shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground">
            {official.count} objectifs
          </span>
        </summary>
        <div className="border-t border-border px-2.5 py-2">
          <RushTipLines text={official.body} />
        </div>
      </details>
      {rest.trim().length > 0 && <RushTipLines text={rest} constraints={constraints} />}
    </div>
  );
}

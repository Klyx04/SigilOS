"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parseBlockTips } from "@/lib/rush-block-tips";
import { splitDofusDexTip } from "@/lib/rush-dofusdex-tip";
import { RushRichText } from "./RushRichText";

/**
 * Conseil d un BLOC — une puce par ligne, replie au-dela de 3 lignes.
 *
 * Retour user (22/11/2026) : « ces gigantesques paves sur certains blocs ».
 * La trame met le programme complet dans `tips` ; on le rend lisible sans le tronquer :
 * 3 lignes visibles, le reste derriere un bouton.
 */
export function RushBlockTips({ text, className }: { text: string | null | undefined; className?: string }) {
  // Meme regle que l overlay : la section « DofusDex officiel » ne s affiche plus.
  const { official, rest } = splitDofusDexTip(text);
  const lines = parseBlockTips(official ? rest : text);
  const [expanded, setExpanded] = useState(false);
  if (lines.length === 0) return null;
  const collapsible = lines.length > 3;
  const visible = collapsible && !expanded ? lines.slice(0, 3) : lines;
  return (
    <div className={className}>
      <ul className="space-y-1">
        {visible.map((line, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <span aria-hidden="true" className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-warning/70" />
            <span className="min-w-0 flex-1">
              <RushRichText text={line} />
            </span>
          </li>
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" aria-hidden="true" /> Reduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" aria-hidden="true" /> Voir les {lines.length} lignes
            </>
          )}
        </button>
      )}
    </div>
  );
}
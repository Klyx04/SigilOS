"use client";

import { GameIcon } from "@/components/shared/game-icon";
import type { RushConstraintInfo } from "@/lib/rush-constraints";
import { cn } from "@/lib/utils";

import { RushRichText } from "./RushRichText";

/**
 * Infos de quête illustrées — **jamais des conditions de blocage**.
 *
 * Les contraintes Tougli (joueurs, métier, horaire, sort, note) sont déjà du texte dans
 * `GuideSequence.tips` ; `parseRushConstraints` les a séparées. Ici on les rend avec de
 * **vrais assets Dofus** (`game-icons/` et `jobs/`), dans les trois surfaces : dashboard,
 * guide public et overlay. Aucun état, aucun clic, aucune règle : c'est de la lecture.
 */
export function RushQuestConstraints({
  constraints,
  className,
}: {
  constraints: RushConstraintInfo[];
  className?: string;
}) {
  if (constraints.length === 0) return null;

  return (
    <div role="list" className={cn("grid gap-1.5", className)}>
      {constraints.map((constraint, index) => (
        <div
          key={`${constraint.kind}-${index}`}
          role="listitem"
          className="flex items-start gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
        >
          <span className="mt-0.5 flex shrink-0 items-center gap-1" aria-hidden="true">
            <GameIcon src={constraint.icon} className="h-4 w-4" />
            {constraint.jobs.slice(1).map((job) => (
              <GameIcon
                key={job.slug}
                src={`/assets/dofus/jobs/${job.slug}.png`}
                className="h-4 w-4"
              />
            ))}
          </span>

          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {constraint.label}
              </span>
              {constraint.players !== undefined && (
                <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                  {constraint.players} joueur{constraint.players > 1 ? "s" : ""}
                </span>
              )}
              {constraint.hours?.variant === "window" && (
                <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                  {constraint.hours.from ?? "?"}
                  {constraint.hours.to ? ` → ${constraint.hours.to}` : " et +"}
                </span>
              )}
              {constraint.hours?.variant === "wait" && (
                <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                  {constraint.hours.minutes !== undefined
                    ? `${constraint.hours.minutes} min`
                    : "Attente"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-foreground">
              <RushRichText text={constraint.text} />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

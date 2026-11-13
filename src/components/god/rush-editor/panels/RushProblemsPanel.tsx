"use client";

/**
 * Onglet **Problèmes** (E3b, 12/11/2026) — ce qui manque dans le **contenu** du guide.
 *
 * L'onglet Branches couvre la **route** (camps, Ordres, classes) ; celui-ci couvre les
 * blocs et les quêtes : bloc vide, quête sans conseil, sans lien DofusDB, sans ressource,
 * quête d'Ordre sans palier, et les deux incohérences de route qu'une vue de couverture
 * ne peut pas voir (nom de classe contredit, Ordre ou palier sans cité). Chaque ligne est
 * un **geste** : elle ouvre la quête dans l'inspecteur (ou le bloc quand le manque est le
 * bloc lui-même).
 *
 * Aucune seconde règle ici : la liste vient de `analyzeRushEditorProblems` (règle pure,
 * verrouillée par `rush-editor-problems`).
 */

import { useState } from "react";
import { AlertTriangle, Check, ChevronRight } from "lucide-react";
import {
  analyzeRushEditorProblems,
  countRushEditorProblems,
  type RushProblemMilestone,
} from "@/lib/rush-editor-problems";

/** Première page d'une famille, puis 50 de plus par clic (jamais de liste infinie). */
const FIRST_PAGE = 12;
const PAGE_SIZE = 50;

export function RushProblemsPanel({
  milestones,
  onOpenQuest,
  onOpenBlock,
}: {
  milestones: RushProblemMilestone[];
  onOpenQuest: (blockId: string, questId: string) => void;
  onOpenBlock: (blockId: string) => void;
}) {
  const problems = analyzeRushEditorProblems(milestones);
  const total = countRushEditorProblems(problems);
  /** Combien de cibles sont affichées, par famille (défaut : première page). */
  const [shown, setShown] = useState<Record<string, number>>({});
  const visibleCount = (kind: string, count: number) => Math.min(shown[kind] ?? FIRST_PAGE, count);

  return (
    <div className="space-y-4 px-3 py-4" data-rush-problems-panel>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Problèmes du contenu</h2>
          <p className="text-caption text-muted-foreground">
            Ce qui manque aux blocs et aux quêtes — la route est dans l&apos;onglet Branches.
          </p>
        </div>
        <span
          className={`rounded-lg border px-2 py-1 text-caption font-semibold tabular-nums ${
            total === 0
              ? "border-border bg-surface text-muted-foreground"
              : "border-warning/30 bg-warning/5 text-warning"
          }`}
        >
          {total === 0 ? "aucun manque" : `${total} manque${total > 1 ? "s" : ""}`}
        </span>
      </header>

      {total === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-success" aria-hidden />
          Aucun manque détecté : blocs remplis, quêtes conseillées, liées et ressources posées.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {problems.filter((problem) => problem.count > 0).map((problem) => (
            <section
              key={problem.kind}
              className="space-y-2 rounded-xl border border-border bg-surface p-3"
              data-rush-problem={problem.kind}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                    {problem.label}
                  </h3>
                  <p className="text-caption text-muted-foreground">{problem.hint}</p>
                </div>
                <span className="shrink-0 text-caption font-semibold tabular-nums text-warning">{problem.count}</span>
              </div>

              <ul className="space-y-0.5">
                {problem.targets.slice(0, visibleCount(problem.kind, problem.count)).map((target) => (
                  <li key={`${target.blockId}:${target.questId ?? ""}`}>
                    <button
                      type="button"
                      onClick={() =>
                        target.questId ? onOpenQuest(target.blockId, target.questId) : onOpenBlock(target.blockId)
                      }
                      aria-label={
                        target.questId
                          ? `Ouvrir la quête ${target.questName} (bloc ${target.blockTitle})`
                          : `Ouvrir le bloc ${target.blockTitle}`
                      }
                      className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-caption text-foreground transition-colors hover:bg-elevated"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{target.questName ?? target.blockTitle}</span>
                      {target.questId && (
                        <span className="ml-auto shrink-0 truncate pl-2 text-caption text-muted-foreground">
                          {target.detail ?? target.blockTitle}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {problem.count > visibleCount(problem.kind, problem.count) && (
                <button
                  type="button"
                  onClick={() =>
                    setShown((prev) => ({
                      ...prev,
                      [problem.kind]: visibleCount(problem.kind, problem.count) + PAGE_SIZE,
                    }))
                  }
                  aria-label={`Afficher plus de manques pour « ${problem.label} »`}
                  className="w-full rounded-md border border-border px-2 py-1 text-caption font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  Afficher {Math.min(PAGE_SIZE, problem.count - visibleCount(problem.kind, problem.count))} de plus
                  {" · "}
                  {problem.count - visibleCount(problem.kind, problem.count)} restant
                  {problem.count - visibleCount(problem.kind, problem.count) > 1 ? "s" : ""}
                </button>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

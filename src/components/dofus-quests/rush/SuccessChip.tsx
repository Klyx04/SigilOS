"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { successIconUrl } from "@/lib/achievement-icon";
import type { RushGuideQuestRef, RushSuccessRef } from "@/lib/rush-guide-utils";
import { cn } from "@/lib/utils";

/**
 * Succès attaché à une quête — **pastille** dans la rangée de chips + **fiche** au clic.
 *
 * Un succès n'est jamais une case à cocher : la pastille dit quelles quêtes le valident, la
 * fiche les liste avec leur état (« nom + état »). Coût en hauteur : **zéro** (une chip de plus,
 * à côté des coordonnées et des donjons).
 *
 * Les quêtes du succès sont lues dans `public/game-data/achievements.json` (chargé une fois,
 * mis en cache par le navigateur) puis nommées avec `quests` (la map de la surface).
 */

const ACHIEVEMENTS_URL = "/game-data/achievements.json";

let achievementsPromise: Promise<Map<string, number[]>> | null = null;

function loadAchievementQuests(): Promise<Map<string, number[]>> {
  if (!achievementsPromise) {
    achievementsPromise = fetch(ACHIEVEMENTS_URL)
      .then((response) => (response.ok ? response.json() : { achievements: [] }))
      .then((data: { achievements?: Array<{ id?: number; questIds?: number[] }> }) => {
        const map = new Map<string, number[]>();
        for (const row of data.achievements ?? []) {
          if (row?.id == null) continue;
          map.set(String(row.id), Array.isArray(row.questIds) ? row.questIds : []);
        }
        return map;
      })
      .catch(() => new Map<string, number[]>());
  }
  return achievementsPromise;
}

function SuccessSheet({
  success,
  quests,
  onClose,
}: {
  success: RushSuccessRef;
  quests: RushGuideQuestRef[];
  onClose: () => void;
}) {
  const [ids, setIds] = useState<number[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadAchievementQuests().then((map) => {
      if (alive) setIds(map.get(success.id ?? "") ?? []);
    });
    return () => {
      alive = false;
    };
  }, [success.id]);

  const rows = useMemo(() => {
    if (!ids) return [];
    const byId = new Map(quests.map((quest) => [quest.id, quest]));
    return ids.map((id) => byId.get(id)).filter((quest): quest is RushGuideQuestRef => !!quest);
  }, [ids, quests]);

  const done = rows.filter((row) => row.done).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Succès ${success.name}`}
    >
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-elevated">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={successIconUrl(success.iconId)} alt="" className="h-5 w-5 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Succès
            </p>
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">{success.name}</h3>
          </div>
          {ids && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {done} / {rows.length}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche du succès"
            className="shrink-0 rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!ids ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
              Aucune quête de ce succès n'est dans le guide.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[12px]",
                    row.done ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border",
                      row.done ? "border-success/60 bg-success/15 text-success" : "border-border"
                    )}
                    aria-hidden="true"
                  >
                    {row.done ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="sr-only">{row.done ? "Validée" : "À faire"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function SuccessChip({
  successes,
  quests,
  className,
}: {
  successes: RushSuccessRef[];
  quests: RushGuideQuestRef[];
  className?: string;
}) {
  const [open, setOpen] = useState<RushSuccessRef | null>(null);
  if (successes.length === 0) return null;

  const first = successes[0];
  const label = successes.length > 1 ? `${successes.length} succès` : first.name;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(first);
        }}
        title={successes.map((success) => success.name).join(" · ")}
        className={cn(
          "inline-flex max-w-[16rem] items-center gap-1 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={successIconUrl(first.iconId)} alt="" className="h-3 w-3 shrink-0 object-contain" />
        <span className="truncate">{label}</span>
      </button>
      {open && <SuccessSheet success={open} quests={quests} onClose={() => setOpen(null)} />}
    </>
  );
}

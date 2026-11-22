"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { successIconUrl } from "@/lib/achievement-icon";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type { RushGuideQuestRef, RushSuccessRef } from "@/lib/rush-guide-utils";
import { questTypeIconPath } from "@/lib/quest-type-icon";
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

type AchievementQuestIndex = { byId: Map<string, number[]>; byName: Map<string, number[]> };
let achievementsPromise: Promise<AchievementQuestIndex> | null = null;

/** Cle de repli par NOM (casse, accents, ponctuation) : l id du tag peut etre un id Dofus. */
function normalizeAchievementName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadAchievementQuests(): Promise<AchievementQuestIndex> {
  if (!achievementsPromise) {
    achievementsPromise = fetch(ACHIEVEMENTS_URL)
      .then((response) => (response.ok ? response.json() : { achievements: [] }))
      .then((data: { achievements?: Array<{ id?: number; name?: string; questIds?: number[] }> }) => {
        const byId = new Map<string, number[]>();
        const byName = new Map<string, number[]>();
        for (const row of data.achievements ?? []) {
          if (row?.id == null) continue;
          const questIds = Array.isArray(row.questIds) ? row.questIds : [];
          byId.set(String(row.id), questIds);
          const name = normalizeAchievementName(row.name);
          if (name) byName.set(name, questIds);
        }
        return { byId, byName };
      })
      .catch(() => ({ byId: new Map<string, number[]>(), byName: new Map<string, number[]>() }));
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
      if (alive) setIds(map.byId.get(String(success.id)) ?? map.byName.get(normalizeAchievementName(success.name)) ?? []);
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
              {ids.length > 0 ? `Les ${ids.length} quêtes de ce succès ne sont pas dans le guide.` : "Aucune quête de ce succès n est dans le guide."}
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
                  {/* L'asset de quête (sprite de type), jamais un carré générique : le
                      seed ne porte aucune icône de séquence (0/536 mesuré le 20/11/2026). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={questTypeIconPath("secondaire")}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-4 w-4 shrink-0 object-contain"
                  />
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
  compact = false,
  iconSrc = "/assets/icons/icone-succes.png",
}: {
  successes: RushSuccessRef[];
  quests: RushGuideQuestRef[];
  className?: string;
  /** Dashboard : icône seule, le nom complet reste en infobulle. */
  compact?: boolean;
  /** Icône normalisée de la pastille (la fiche garde l'icône du succès). */
  iconSrc?: string;
}) {
  const [open, setOpen] = useState<RushSuccessRef | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const daScope = daScopeProps(useDaTheme());

  if (successes.length === 0) return null;

  const first = successes[0];
  const label = successes.length > 1 ? `${successes.length} succès` : first.name;
  // ⚠️ La fiche doit sortir du contexte d'empilement de `.da-card` (`isolation:
  // isolate`) : sinon les cartes suivantes passent au-dessus et le `line-through`
  // d'une quête validée tombe sur son titre. On vise le document du bouton pour
  // que la PiP ouvre la fiche dans SA fenêtre, pas dans la page parente.
  const portalRoot =
    anchorRef.current?.ownerDocument.body ??
    (typeof document !== "undefined" ? document.body : null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(first);
        }}
        title={successes.map((success) => success.name).join(" · ")}
        aria-label={
          compact
            ? `Succès : ${successes.map((success) => success.name).join(", ")}`
            : undefined
        }
        className={cn(
          "inline-flex max-w-[16rem] items-center gap-1 rounded-[3px] border border-border bg-surface text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
          compact
            ? "border-0 bg-transparent px-1 py-0.5 hover:bg-elevated"
            : "px-1.5 py-0.5",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt="" className="h-3 w-3 shrink-0 object-contain" />
        {!compact && <span className="truncate">{label}</span>}
      </button>
      {open && portalRoot
        ? createPortal(
            <div className="da-portal" {...daScope}>
              <SuccessSheet success={open} quests={quests} onClose={() => setOpen(null)} />
            </div>,
            portalRoot
          )
        : null}
    </>
  );
}

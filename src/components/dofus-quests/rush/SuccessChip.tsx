"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type { RushGuideQuestRef, RushSuccessRef } from "@/lib/rush-guide-utils";
import { buildSuccessQuestRows } from "@/lib/rush-success-quests";
import {
  evaluateSuccess,
  parseRushSuccessMeta,
  type RushQuestCriteria,
  type RushQuestCriteriaMap,
  type RushSuccessCatalog,
  type RushSuccessEvaluation,
  type RushSuccessMeta,
  type RushSuccessPrerequisite,
} from "@/lib/rush-success-graph";
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

const ACHIEVEMENTS_URL = "/game-data/success-graph.json";
const SUCCESS_META_URL = "/game-data/rush-success-meta.json";
const QUEST_NAMES_URL = "/game-data/quest-names.json";

type QuestNames = Record<number, string>;
let questNamesPromise: Promise<QuestNames> | null = null;

function loadQuestNames(): Promise<QuestNames> {
  if (!questNamesPromise) {
    questNamesPromise = fetch(QUEST_NAMES_URL)
      .then(async (response) => {
        if (!response.ok) return {};
        const data = (await response.json()) as { quests?: Record<string, string> };
        const out: QuestNames = {};
        for (const [key, value] of Object.entries(data.quests ?? {})) {
          const id = Number(key);
          if (Number.isInteger(id) && id > 0 && typeof value === "string" && value.trim()) {
            out[id] = value;
          }
        }
        return out;
      })
      .catch(() => ({}));
  }
  return questNamesPromise;
}

type AchievementCatalogRow = {
  id: number;
  name: string;
  questIds: number[];
  successIds: number[];
  itemIds: number[];
};
type AchievementCatalogIndex = {
  byId: Map<string, AchievementCatalogRow>;
  byName: Map<string, AchievementCatalogRow>;
  rows: Map<number, AchievementCatalogRow>;
  questCriteria: RushQuestCriteriaMap;
  questNames: Record<number, string>;
  generatedAt: string | null;
  meta: RushSuccessMeta;
  ok: boolean;
};
let achievementsPromise: Promise<AchievementCatalogIndex> | null = null;

/** Cle de repli par NOM (casse, accents, ponctuation) : l id du tag peut être un id Dofus. */
function normalizeAchievementName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadAchievementQuests(): Promise<AchievementCatalogIndex> {
  if (!achievementsPromise) {
    achievementsPromise = Promise.all([
      fetch(ACHIEVEMENTS_URL),
      fetch(SUCCESS_META_URL).catch(() => null),
    ])
      .then(async ([response, metaResponse]) => {
        const ok = response.ok;
        const data: {
          generatedAt?: string;
          achievements?: Array<{
            id?: number;
            name?: string;
            questIds?: number[];
            successIds?: number[];
            itemIds?: number[];
          }>;
          quests?: Array<{
            id?: number;
            name?: string;
            level?: number | null;
            questIds?: number[];
            successIds?: number[];
            itemIds?: number[];
            criterion?: string;
          }>;
        } = ok ? await response.json() : { achievements: [], quests: [] };
        const metaRaw = metaResponse?.ok ? await metaResponse.json().catch(() => null) : null;
        const meta = parseRushSuccessMeta(metaRaw);

        const byId = new Map<string, AchievementCatalogRow>();
        const byName = new Map<string, AchievementCatalogRow>();
        const rows = new Map<number, AchievementCatalogRow>();
        for (const row of data.achievements ?? []) {
          if (row?.id == null) continue;
          const entry: AchievementCatalogRow = {
            id: row.id,
            name: row.name ?? `Succès ${row.id}`,
            questIds: Array.isArray(row.questIds) ? row.questIds : [],
            successIds: Array.isArray(row.successIds) ? row.successIds : [],
            itemIds: Array.isArray(row.itemIds) ? row.itemIds : [],
          };
          byId.set(String(row.id), entry);
          rows.set(row.id, entry);
          const name = normalizeAchievementName(entry.name);
          if (name) byName.set(name, entry);
        }

        const questCriteria = new Map<number, RushQuestCriteria>();
        const questNames: Record<number, string> = {};
        for (const row of data.quests ?? []) {
          if (row?.id == null) continue;
          const entry: RushQuestCriteria = {
            id: row.id,
            name: row.name ?? undefined,
            level: Number.isFinite(Number(row.level)) ? Number(row.level) : null,
            questIds: Array.isArray(row.questIds) ? row.questIds : [],
            successIds: Array.isArray(row.successIds) ? row.successIds : [],
            itemIds: Array.isArray(row.itemIds) ? row.itemIds : [],
            criterion: typeof row.criterion === "string" ? row.criterion : "",
          };
          questCriteria.set(row.id, entry);
          if (entry.name) questNames[row.id] = entry.name;
        }

        return {
          byId,
          byName,
          rows,
          questCriteria,
          questNames,
          generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : null,
          meta,
          ok,
        };
      })
      .catch(
        () => ({
          byId: new Map<string, AchievementCatalogRow>(),
          byName: new Map<string, AchievementCatalogRow>(),
          rows: new Map<number, AchievementCatalogRow>(),
          questCriteria: new Map<number, RushQuestCriteria>(),
          questNames: {} as Record<number, string>,
          generatedAt: null,
          meta: { overrides: {}, notes: {} },
          ok: false,
        })
      );
  }
  return achievementsPromise;
}

function SuccessSheet({
  success,
  quests,
  iconSrc,
  onClose,
}: {
  success: RushSuccessRef;
  quests: RushGuideQuestRef[];
  iconSrc: string;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<AchievementCatalogRow | null>(null);
  const [catalog, setCatalog] = useState<RushSuccessCatalog | null>(null);
  const [questCriteria, setQuestCriteria] = useState<RushQuestCriteriaMap | null>(null);
  const [overrides, setOverrides] = useState<Record<string, readonly number[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [catalogOk, setCatalogOk] = useState<boolean | null>(null);
  const [names, setNames] = useState<QuestNames>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = closeRef.current;
    const doc = close?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    const previous = doc?.activeElement as HTMLElement | null;
    close?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    doc?.addEventListener("keydown", handleKeyDown, true);
    return () => {
      doc?.removeEventListener("keydown", handleKeyDown, true);
      previous?.focus?.();
    };
  }, [onClose]);

  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const doc = event.currentTarget.ownerDocument;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    let alive = true;
    Promise.all([loadAchievementQuests(), loadQuestNames()]).then(([map, questNames]) => {
      if (alive) {
        setCatalogOk(map.ok);
        // Les noms du guide priment ; DofusDB nomme les quêtes hors guide.
        setNames({ ...map.questNames, ...questNames });
        setCatalog(map.rows);
        setQuestCriteria(map.questCriteria);
        setOverrides(map.meta.overrides);
        setNotes(map.meta.notes);
        setGeneratedAt(map.generatedAt);
        setEntry(
          map.byId.get(String(success.id)) ??
            map.byName.get(normalizeAchievementName(success.name)) ??
            null
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [success.id, success.name]);

  const rows = useMemo(
    () => buildSuccessQuestRows(entry?.questIds ?? [], quests, names),
    [entry, quests, names]
  );
  const evaluation = useMemo<RushSuccessEvaluation | null>(
    () =>
      entry && catalog
        ? evaluateSuccess(entry.id, {
            catalog,
            guideQuests: quests,
            questNames: names,
            questCriteria: questCriteria ?? undefined,
            overrides,
          })
        : null,
    [entry, catalog, questCriteria, overrides, quests, names]
  );

  const done = rows.filter((row) => row.done).length;
  const prerequisites = evaluation?.prerequisites ?? [];
  const prerequisitesDone = prerequisites.filter((row) => row.state === "done").length;
  const nestedPrerequisites = useMemo(() => {
    const out = new Map<number, RushSuccessPrerequisite[]>();
    if (!catalog || !questCriteria) return out;
    for (const prereq of prerequisites) {
      const nested = evaluateSuccess(prereq.id, {
        catalog,
        guideQuests: quests,
        questNames: names,
        questCriteria,
        overrides,
      });
      if (nested.prerequisites.length > 0) out.set(prereq.id, nested.prerequisites);
    }
    return out;
  }, [catalog, prerequisites, questCriteria, overrides, quests, names]);
  const possessionCount = evaluation?.requiredItemIds.length ?? 0;
  const editorialNote = entry ? notes[String(entry.id)] : "";
  const dataDate = generatedAt ? generatedAt.slice(0, 10) : null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Succès ${success.name}`}
      onKeyDown={trapTab}
    >
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-elevated">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} alt="" className="h-5 w-5 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Succès
            </p>
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">{success.name}</h3>
          </div>
          {rows.length > 0 && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {done} / {rows.length}
            </span>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche du succès"
            className="shrink-0 rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!entry ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 && prerequisites.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
              {catalogOk === false
                ? "Catalogue des succès indisponible."
                : "Aucune quête connue pour ce succès."}
            </p>
          ) : (
            <>
              {evaluation && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
                  <span
                    className={cn(
                      "rounded-[3px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      evaluation.state === "done"
                        ? "border-success/40 bg-success/10 text-success"
                        : evaluation.state === "pending"
                          ? "border-warning/40 bg-warning/10 text-warning"
                          : "border-border text-muted-foreground"
                    )}
                  >
                    {evaluation.state === "done"
                      ? "Succès validé"
                      : evaluation.state === "pending"
                        ? "En attente"
                        : "Hors guide"}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    Quêtes {done}/{rows.length}
                    {prerequisites.length > 0
                      ? ` · Prérequis ${prerequisitesDone}/${prerequisites.length}`
                      : ""}
                  </span>
                </div>
              )}
              {possessionCount > 0 && (
                <p className="mb-2 px-1 text-[10px] text-muted-foreground">
                  Possessions : {possessionCount} objet{possessionCount > 1 ? "s" : ""} à avoir
                  — différent des ressources de quête.
                </p>
              )}
              {editorialNote && (
                <p className="mb-2 px-1 text-[10px] italic text-muted-foreground">
                  Règle du guide : {editorialNote}
                </p>
              )}
              {rows.length > 0 && (
                <ul className="space-y-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[12px]",
                    row.inGuide ? "" : "border-dashed",
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
                  {!row.inGuide && (
                    <span
                      aria-hidden="true"
                      className="shrink-0 rounded-[3px] border border-border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Hors guide
                    </span>
                  )}
                  <span className="sr-only">{row.done ? "Validée" : row.inGuide ? "À faire" : "Hors guide"}</span>
                </li>
              ))}
            </ul>
              )}
              {prerequisites.length > 0 && (
                <section className="mt-3 border-t border-border pt-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Succès prérequis
                    </p>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {prerequisitesDone} / {prerequisites.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {prerequisites.map((prereq) => {
                      const children = nestedPrerequisites.get(prereq.id) ?? [];
                      return (
                        <li
                          key={prereq.id}
                          className="rounded-[4px] border border-border bg-surface"
                        >
                          <div className="flex items-center gap-2 px-2 py-1.5 text-[12px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={iconSrc}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              className="h-4 w-4 shrink-0 object-contain"
                            />
                            <span className="min-w-0 flex-1 truncate">{prereq.name}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded-[3px] border px-1 py-0.5 text-[9px] font-semibold",
                                prereq.state === "done"
                                  ? "border-success/40 bg-success/10 text-success"
                                  : prereq.state === "pending"
                                    ? "border-warning/40 bg-warning/10 text-warning"
                                    : "border-dashed border-border text-muted-foreground"
                              )}
                            >
                              {prereq.state === "done"
                                ? "Fait"
                                : prereq.state === "pending"
                                  ? "À faire"
                                  : "Hors guide"}
                            </span>
                          </div>
                          {children.length > 0 && (
                            <ul className="ml-6 border-l border-border pl-2 pb-1.5 space-y-0.5">
                              {children.slice(0, 8).map((child) => (
                                <li
                                  key={child.id}
                                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 shrink-0 rounded-full",
                                      child.state === "done"
                                        ? "bg-success"
                                        : child.state === "pending"
                                          ? "bg-warning"
                                          : "bg-border"
                                    )}
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0 truncate">{child.name}</span>
                                  <span className="sr-only">
                                    {child.state === "done"
                                      ? "Fait"
                                      : child.state === "pending"
                                        ? "À faire"
                                        : "Hors guide"}
                                  </span>
                                </li>
                              ))}
                              {children.length > 8 && (
                                <li className="text-[9px] text-muted-foreground">
                                  +{children.length - 8} autre(s)
                                </li>
                              )}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {evaluation &&
                    (evaluation.outsideGuideQuestIds.length > 0 ||
                      evaluation.outsideGuideSuccessIds.length > 0) && (
                      <p className="px-1 pt-1 text-[10px] text-muted-foreground">
                        Certains prérequis sont hors guide : le succès reste non vérifiable.
                      </p>
                    )}
                </section>
              )}
              {dataDate && (
                <p className="px-1 pt-2 text-[9px] text-muted-foreground">
                  Données DofusDB · {dataDate}
                </p>
              )}
            </>
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
  /** Icône de succès partagée par la pastille et la fiche (trophée). */
  iconSrc?: string;
}) {
  const [open, setOpen] = useState<RushSuccessRef | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const closeSheet = useCallback(() => setOpen(null), []);
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
              <SuccessSheet success={open} quests={quests} iconSrc={iconSrc} onClose={closeSheet} />
            </div>,
            portalRoot
          )
        : null}
    </>
  );
}

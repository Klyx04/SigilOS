"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Flag, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import {
  EMPTY_OVERVIEW_FILTER,
  buildRushDungeonsOverview,
  defaultOpenBlockId,
  filterRushDungeonsOverview,
  groupRushDungeonsByBlock,
  type RushOverviewDungeon,
  type RushOverviewFilter,
  type RushOverviewMe,
  type RushOverviewMember,
  type RushOverviewOccurrence,
} from "@/lib/rush-dungeons-overview";
import type { DaScopeProps } from "@/lib/da-scope";
import type { RushMilestone } from "@/types/rush-guide-types";

type Mode = "member" | "visitor" | "guest";

type PanelLabels = {
  title: string;
  all: string;
  todo: string;
  done: string;
  allSteps: string;
  search: string;
  flags: string;
  expand: string;
  collapse: string;
  steps: string;
  members: string;
  empty: string;
  reset: string;
  guest: string;
  noDungeons: string;
  doneState: string;
  todoState: string;
  covered: string;
  optional: string;
  achievements: string;
  goTo: string;
  post: string;
};

const LABELS: Record<"fr" | "en", PanelLabels> = {
  fr: {
    title: "Progression Donjons",
    all: "Tous",
    todo: "À faire",
    done: "Fait",
    allSteps: "Toutes les étapes",
    search: "Chercher un donjon ou un boss…",
    flags: "Repères",
    expand: "Tout déplier",
    collapse: "Tout replier",
    steps: "étapes",
    members: "membres",
    empty: "Aucun donjon ne correspond à ces filtres.",
    reset: "Réinitialiser les filtres",
    guest: "Vue perso : connecte-toi avec un profil visiteur pour voir la progression des autres.",
    noDungeons: "Aucun donjon sur cette route.",
    doneState: "Fait",
    todoState: "À faire",
    covered: "Au choix — couvert",
    optional: "Optionnel",
    achievements: "Succès du donjon",
    goTo: "Aller à l'étape",
    post: "Créer un post donjon / quête",
  },
  en: {
    title: "Dungeon progress",
    all: "All",
    todo: "To do",
    done: "Done",
    allSteps: "All steps",
    search: "Search a dungeon or a boss…",
    flags: "Bookmarks",
    expand: "Expand all",
    collapse: "Collapse all",
    steps: "steps",
    members: "members",
    empty: "No dungeon matches these filters.",
    reset: "Reset filters",
    guest: "Personal view: sign in with a visitor profile to see other players' progress.",
    noDungeons: "No dungeon on this route.",
    doneState: "Done",
    todoState: "To do",
    covered: "Choice — covered",
    optional: "Optional",
    achievements: "Dungeon achievements",
    goTo: "Go to the step",
    post: "Create a dungeon / quest post",
  },
};

function DungeonImage({ row }: { row: RushOverviewDungeon }) {
  const [broken, setBroken] = useState(false);
  const src = !broken && row.imageUrl ? row.imageUrl : "/assets/dofus-ui/pictos/donjon.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-8 w-8 shrink-0 rounded-[4px] border border-border object-contain"
    />
  );
}

/** Avatars de tous les membres avec leur état : fait / repère / pas fait. */
function MemberStatusStack({
  members,
  occurrence,
}: {
  members: RushOverviewMember[];
  occurrence: RushOverviewOccurrence;
}) {
  if (members.length === 0) return null;
  const done = new Set(occurrence.doneBy);
  const flagged = new Set(occurrence.flaggedBy);
  const shown = members.slice(0, 6);
  const rest = members.length - shown.length;
  return (
    <span
      className="flex items-center gap-0.5"
      title={members
        .map(
          (member) =>
            `${member.name} — ${
              done.has(member.key) ? "fait" : flagged.has(member.key) ? "repère" : "pas fait"
            }`
        )
        .join(" · ")}
    >
      {shown.map((member) => {
        const state = done.has(member.key)
          ? "done"
          : flagged.has(member.key)
            ? "flag"
            : "todo";
        return (
          <span
            key={member.key}
            className={cn(
              "relative grid h-4 w-4 place-items-center overflow-hidden rounded-full border bg-elevated",
              state === "done"
                ? "border-success/60"
                : state === "flag"
                  ? "border-warning/60"
                  : "border-border opacity-60"
            )}
          >
            <MemberAvatar
              src={member.avatar}
              name={member.name}
              fallbackClassName="text-[8px] font-semibold text-muted-foreground"
            />
            {state !== "todo" ? (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 grid h-2.5 w-2.5 place-items-center rounded-full text-background",
                  state === "done" ? "bg-success" : "bg-warning"
                )}
              >
                {state === "done" ? (
                  <Check className="h-1.5 w-1.5" aria-hidden="true" />
                ) : (
                  <Flag className="h-1.5 w-1.5" aria-hidden="true" />
                )}
              </span>
            ) : null}
          </span>
        );
      })}
      {rest > 0 ? (
        <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">+{rest}</span>
      ) : null}
    </span>
  );
}

function StateChip({ occurrence, labels }: { occurrence: RushOverviewOccurrence; labels: PanelLabels }) {
  if (occurrence.isDone) {
    return (
      <span className="shrink-0 rounded-[3px] border border-success/30 bg-success/10 px-1 py-0.5 text-[9px] font-semibold text-success">
        {labels.doneState}
      </span>
    );
  }
  if (occurrence.groupSatisfied) {
    return (
      <span className="shrink-0 rounded-[3px] border border-border bg-elevated px-1 py-0.5 text-[9px] text-muted-foreground">
        {labels.covered}
      </span>
    );
  }
  if (occurrence.isOptional) {
    return (
      <span className="shrink-0 rounded-[3px] border border-border px-1 py-0.5 text-[9px] text-muted-foreground">
        {labels.optional}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-[3px] border border-warning/30 bg-warning/10 px-1 py-0.5 text-[9px] font-semibold text-warning">
      {labels.todoState}
    </span>
  );
}

function DungeonRow({
  row,
  mode,
  labels,
  membersByKey,
  onGoToStep,
  onOpenAchievements,
  onOpenPost,
}: {
  row: RushOverviewDungeon;
  mode: Mode;
  labels: PanelLabels;
  membersByKey: Map<string, RushOverviewMember>;
  onGoToStep?: (sequenceId: string) => void;
  onOpenAchievements?: (dungeon: RushOverviewDungeon) => void;
  onOpenPost?: (dungeon: RushOverviewDungeon) => void;
}) {
  const identity = (
    <>
      <DungeonImage row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-foreground">{row.name}</span>
          {row.isOcre ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/assets/icons/ocre.png" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
          ) : null}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {[row.bossName, row.level != null ? `niv. ${row.level}` : null].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {row.doneOccurrences} / {row.totalOccurrences} {labels.steps}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {row.membersDone} / {row.membersTotal} {labels.members}
          </span>
        </span>
      </span>
    </>
  );

  return (
    <li className="border-t border-border/60 px-3 py-2 first:border-t-0">
      <div className="flex items-start gap-2">
        {onOpenPost && row.dungeonId ? (
          <button
            type="button"
            onClick={() => onOpenPost(row)}
            aria-label={`${labels.post} — ${row.name}`}
            title={labels.post}
            className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-[4px] text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-success/50 sm:min-h-0"
          >
            {identity}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2">{identity}</div>
        )}
        {onOpenAchievements && (row.dungeonId || row.slug) ? (
          <button
            type="button"
            onClick={() => onOpenAchievements(row)}
            aria-label={`${labels.achievements} — ${row.name}`}
            title={labels.achievements}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border border-border text-muted-foreground transition-colors hover:border-success/40 hover:text-success"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <ul className="mt-1 space-y-0.5 pl-10">
        {row.occurrences.map((occurrence) => (
          <li key={occurrence.occurrenceKey} className="flex items-center gap-1.5 py-0.5">
            <button
              type="button"
              onClick={() => onGoToStep?.(occurrence.sequenceId)}
              disabled={!onGoToStep}
              title={`${labels.goTo} : ${occurrence.sequenceName}`}
              className="min-w-0 flex-1 truncate text-left text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:hover:text-muted-foreground"
            >
              <span className="text-foreground/80">{occurrence.sequenceName}</span>
            </button>
            {occurrence.choiceGroup ? (
              <span
                className="shrink-0 rounded-[3px] border border-border px-1 text-[9px] text-muted-foreground"
                title={occurrence.choiceLabel ?? undefined}
              >
                {occurrence.choiceLabel ?? "Au choix"}
              </span>
            ) : null}
            {occurrence.flaggedBy.length > 0 ? (
              <Flag className="h-3 w-3 shrink-0 text-success/70" aria-label={labels.flags} />
            ) : null}
            <StateChip occurrence={occurrence} labels={labels} />
            {mode === "guest" ? null : (
              <span className="shrink-0">
                <MemberStatusStack
                  members={[...membersByKey.values()]}
                  occurrence={occurrence}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}


/**
 * Panneau « Progression Donjons » (Bloc J) — même anatomie sur les trois surfaces :
 * dashboard, guide public (connecté ou perso) et overlay. Aucune action serveur :
 * le parent fournit les états ; le panneau ne fait que lire et filtrer.
 */
export function RushDungeonsOverviewModal({
  open,
  onClose,
  milestones,
  me,
  members,
  mode,
  locale = "fr",
  routeLabel,
  variant = "page",
  quality,
  daScope,
  portalContainer,
  onGoToStep,
  onOpenAchievements,
  onOpenPost,
}: {
  open: boolean;
  onClose: () => void;
  milestones: readonly RushMilestone[];
  me: RushOverviewMe;
  members?: readonly RushOverviewMember[] | null;
  mode: Mode;
  locale?: "fr" | "en";
  routeLabel?: string | null;
  variant?: "page" | "overlay";
  /** `low` en PiP : grain et filtres coupés (règle de coût de rendu). */
  quality?: "low" | "high";
  /** Attributs de portée DA (`daScopeProps`) : les modales Radix sortent de l'arbre. */
  daScope?: DaScopeProps;
  portalContainer?: HTMLElement | null;
  onGoToStep?: (sequenceId: string) => void;
  onOpenAchievements?: (dungeon: RushOverviewDungeon) => void;
  /** Ouvre la création d'un post donjon/quête (contexte guilde uniquement). */
  onOpenPost?: (dungeon: RushOverviewDungeon) => void;
}) {
  const labels = LABELS[locale];
  const [filter, setFilter] = useState<RushOverviewFilter>(EMPTY_OVERVIEW_FILTER);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);

  const overview = useMemo(
    () => buildRushDungeonsOverview({ milestones, me, members }),
    [milestones, me, members]
  );
  const rows = useMemo(() => filterRushDungeonsOverview(overview, filter), [overview, filter]);
  const groups = useMemo(() => groupRushDungeonsByBlock(overview, rows), [overview, rows]);
  // Compteurs des filtres : sans eux, « À faire / Fait » ne dit pas combien de
  // donjons on va voir avant de cliquer (retour user 25/11/2026).
  const stateCounts = useMemo(() => {
    let done = 0;
    let todo = 0;
    for (const row of overview.rows) {
      if (row.totalOccurrences > 0 && row.doneOccurrences >= row.totalOccurrences) done += 1;
      else todo += 1;
    }
    return { done, todo };
  }, [overview.rows]);
  const membersByKey = useMemo(() => {
    const map = new Map<string, RushOverviewMember>();
    for (const member of members ?? []) map.set(member.key, member);
    return map;
  }, [members]);

  useEffect(() => {
    if (!open) return;
    const defaultBlock = defaultOpenBlockId(overview, me);
    setExpanded(defaultBlock ? new Set([defaultBlock]) : new Set());
    setAllExpanded(false);
  }, [open, overview, me]);

  const toggleBlock = (id: string) => {
    setAllExpanded(false);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id: string) => allExpanded || expanded.has(id);
  const hasFilters = filter.state !== "all" || !!filter.step || filter.flagsOnly || !!filter.query.trim();
  const selectedStep = filter.step ? overview.steps.find((step) => step.id === filter.step) : null;
  const selectedStepLabel = selectedStep ? `${selectedStep.milestoneTitle} · ${selectedStep.name}` : labels.allSteps;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        {...daScope}
        portalContainer={portalContainer ?? undefined}
        data-quality={quality}
        overlayClassName="da-modal-scrim"
        className={cn(
          // DA Gouache Wakfu : matière `.da-modal` (planche, filet 1,5 px, rayon 12 px).
          // Mobile-first : feuille plein écran, puis modale centrée. `flex` remplace le
          // `grid` de base : la liste scrolle À L'INTÉRIEUR (`min-h-0` + `flex-1`).
          "da-modal da-portal flex flex-col overflow-hidden p-0",
          "h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-none",
          "sm:h-[min(88svh,calc(100dvh-2rem))] sm:max-h-[min(88svh,calc(100dvh-2rem))]",
          "sm:w-[min(860px,calc(100vw-2rem))]",
          variant === "overlay" && "sm:w-[min(520px,calc(100vw-2rem))]"
        )}
      >
        <DialogHeader className="da-modal-head shrink-0 pr-12">
          <DialogTitle className="da-modal-title flex flex-wrap items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/dofus-ui/pictos/donjon.png"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 object-contain"
            />
            {labels.title}
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
              {overview.counts.exigencesDone} / {overview.counts.exigences}
            </span>
          </DialogTitle>
          {/* Progression en tête : la donnée qui donne envie de finir, pas une
              troisième ligne de chiffres à décrypter (retour user 25/11/2026). */}
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-elevated"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={Math.max(overview.counts.exigences, 1)}
              aria-valuenow={overview.counts.exigencesDone}
              aria-label={labels.title}
            >
              <div
                className="h-full bg-success transition-all"
                style={{
                  width: `${
                    overview.counts.exigences > 0
                      ? Math.round((overview.counts.exigencesDone / overview.counts.exigences) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {overview.counts.exigences > 0
                ? Math.round((overview.counts.exigencesDone / overview.counts.exigences) * 100)
                : 0}
              %
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {overview.counts.dungeons} donjons · {overview.counts.occurrences} passages dans les
            quêtes · {overview.counts.exigences} exigences
            {routeLabel ? ` · ${routeLabel}` : ""}
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "todo", "done"] as const).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setFilter((current) => ({ ...current, state }))}
                  aria-pressed={filter.state === state}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-medium transition-colors sm:min-h-0",
                    filter.state === state
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {labels[state]}
                  <span className="text-[10px] font-semibold tabular-nums opacity-70">
                    {state === "all"
                      ? overview.counts.dungeons
                      : state === "done"
                        ? stateCounts.done
                        : stateCounts.todo}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilter((current) => ({ ...current, flagsOnly: !current.flagsOnly }))}
                aria-pressed={filter.flagsOnly}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-medium transition-colors sm:min-h-0",
                  filter.flagsOnly
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Flag className="h-3 w-3" aria-hidden="true" />
                {labels.flags} ({overview.flaggedSteps.length})
              </button>
              <button
                type="button"
                onClick={() => setAllExpanded((value) => !value)}
                className="min-h-11 rounded-[4px] border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
              >
                {allExpanded ? labels.collapse : labels.expand}
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {/* Sélecteur d'étape DA : jamais un `<select>` natif (règle UI). */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStepOpen((open) => !open)}
                  aria-expanded={stepOpen}
                  aria-haspopup="listbox"
                  className="inline-flex min-h-11 max-w-[260px] items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-foreground/20 sm:min-h-0"
                >
                  <span className="truncate">{selectedStepLabel}</span>
                  <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
                {stepOpen ? (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setStepOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="listbox"
                      aria-label={labels.allSteps}
                      className="absolute left-0 top-full z-50 mt-1 max-h-64 w-[min(340px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[6px] border border-border bg-elevated py-1"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={!filter.step}
                        onClick={() => {
                          setFilter((current) => ({ ...current, step: null }));
                          setStepOpen(false);
                        }}
                        className="flex min-h-11 w-full items-center px-3 text-left text-xs text-foreground transition-colors hover:bg-surface"
                      >
                        {labels.allSteps}
                      </button>
                      {overview.steps.map((step) => (
                        <button
                          key={step.id}
                          type="button"
                          role="option"
                          aria-selected={filter.step === step.id}
                          onClick={() => {
                            setFilter((current) => ({ ...current, step: step.id }));
                            setStepOpen(false);
                          }}
                          className="flex min-h-11 w-full items-center px-3 text-left text-xs text-foreground transition-colors hover:bg-surface"
                        >
                          <span className="truncate">
                            {step.milestoneTitle} · {step.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={filter.query}
                  onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
                  placeholder={labels.search}
                  aria-label={labels.search}
                  className="min-h-11 w-full rounded-[4px] border border-border bg-surface py-1 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground sm:min-h-0"
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {overview.counts.dungeons === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">{labels.noDungeons}</p>
            ) : groups.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-[11px] text-muted-foreground">{labels.empty}</p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => setFilter(EMPTY_OVERVIEW_FILTER)}
                    className="mt-2 rounded-[4px] border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-elevated"
                  >
                    {labels.reset}
                  </button>
                ) : null}
              </div>
            ) : (
              groups.map(({ block, rows: blockRows }) => (
                <section key={block.id}>
                  <button
                    type="button"
                    onClick={() => toggleBlock(block.id)}
                    aria-expanded={isExpanded(block.id)}
                    className="flex w-full items-center gap-1.5 border-b border-border bg-elevated/40 px-3 py-1.5 text-left transition-colors hover:bg-elevated"
                  >
                    {isExpanded(block.id) ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="truncate text-[11px] font-semibold text-foreground">{block.title}</span>
                    {block.exigences > 0 && block.exigencesDone >= block.exigences ? (
                      <Check className="h-3 w-3 shrink-0 text-success" aria-label="Bloc terminé" />
                    ) : null}
                    <span
                      className="da-plank ml-auto shrink-0"
                      data-size="mini"
                      role="img"
                      aria-label={`${block.exigencesDone} exigences faites sur ${block.exigences}`}
                    >
                      <i />
                      <b />
                      <span>
                        {block.exigencesDone}/{block.exigences}
                      </span>
                    </span>
                  </button>
                  {block.exigences > 0 ? (
                    <div className="h-0.5 bg-elevated" aria-hidden="true">
                      <div
                        className="h-full bg-success transition-all"
                        style={{
                          width: `${Math.round((block.exigencesDone / block.exigences) * 100)}%`,
                        }}
                      />
                    </div>
                  ) : null}
                  {isExpanded(block.id) ? (
                    <ul>
                      {blockRows.map((row) => (
                        <DungeonRow
                          key={row.key}
                          row={row}
                          mode={mode}
                          labels={labels}
                          membersByKey={membersByKey}
                          onGoToStep={onGoToStep}
                          onOpenAchievements={onOpenAchievements}
                          onOpenPost={onOpenPost}
                        />
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))
            )}
          </div>

          {mode === "guest" || mode === "visitor" ? (
            <p className="shrink-0 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              {mode === "guest" ? labels.guest : null}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}


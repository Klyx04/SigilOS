/**
 * **Vue « Progression Donjons » du guide Rush** — règles pures, aucune I/O.
 *
 * Trois invariants mesurés le 19/11/2026 (guide en base) :
 *  · **l'unité est l'occurrence** (`sequenceId::dungeonKey`) : 100 donjons distincts
 *    pour **202 occurrences** (donjon × étape) et **175 exigences** (un groupe
 *    « au choix » = 1) ; **59 donjons** sont demandés plusieurs fois (Ougah ×8,
 *    Merkator ×7, Korriandre ×6). Un donjon n'a donc **jamais** un « fait » global ;
 *  · **un groupe « au choix »** est satisfait dès qu'une alternative est cochée ; les
 *    autres alternatives sont « couvertes par le groupe », pas « à faire » ;
 *  · **le filtre de route est déjà appliqué** en amont : ce module ne voit que les
 *    séquences de la route, il n'invente ni n'écarte aucun donjon.
 *
 * Le module ne connaît ni Prisma ni les actions : les états arrivent du parent
 * (membre, visiteur consenti, invité en lecture seule).
 */

import { getDungeons } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import {
  dungeonKeyOf,
  dungeonOccurrenceKey,
  resolveSequenceDungeons,
  sequenceDungeonProgress,
} from "@/lib/rush-dungeons";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/** Un membre affichable : nom de personnage, jamais un compte. */
export type RushOverviewMember = {
  /** Clé opaque (profil + emplacement) — sert de clé React, jamais affichée. */
  key: string;
  name: string;
  avatar?: string | null;
  slot: string;
  isMain: boolean;
  /** Occurrences cochées « fait » (`sequenceId::dungeonKey`). */
  doneKeys: readonly string[];
  /** Étapes où le membre a posé son repère (ids de séquence). */
  flags: readonly string[];
};

/** Les états du lecteur (membre, visiteur, ou vue perso invitée). */
export type RushOverviewMe = {
  doneKeys: readonly string[];
  flags: readonly string[];
};

export type RushOverviewSequenceLike = RushSequence & {
  dungeons?: Array<{
    id?: string | null;
    slug?: string | null;
    name?: string | null;
    bossName?: string | null;
    imageUrl?: string | null;
    level?: number | null;
    isOcreQuest?: boolean;
    isOcre?: boolean;
    isOptional?: boolean;
    choiceGroup?: string | null;
    choiceLabel?: string | null;
  }>;
};

/** Une occurrence : un donjon exigé par une étape précise. */
export type RushOverviewOccurrence = {
  sequenceId: string;
  sequenceName: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
  chapter: number;
  dungeonKey: string;
  occurrenceKey: string;
  isOptional: boolean;
  isDone: boolean;
  choiceGroup: string | null;
  choiceLabel: string | null;
  /** Groupe « au choix » satisfait par **une autre** alternative. */
  groupSatisfied: boolean;
  flaggedBy: string[];
  doneBy: string[];
};

/** Un donjon du guide, avec **toutes** ses occurrences. */
export type RushOverviewDungeon = {
  key: string;
  name: string;
  bossName: string | null;
  imageUrl: string | null;
  level: number | null;
  isOcre: boolean;
  /** `Dungeon.id` quand le donjon est résolu (le `+` des succès en a besoin). */
  dungeonId: string | null;
  slug: string | null;
  occurrences: RushOverviewOccurrence[];
  doneOccurrences: number;
  totalOccurrences: number;
  doneByMe: boolean;
  pendingByMe: boolean;
  membersDone: number;
  membersTotal: number;
  blockId: string;
  blockTitle: string;
};

export type RushOverviewBlock = {
  id: string;
  title: string;
  order: number;
  exigences: number;
  exigencesDone: number;
};

export type RushOverviewStep = {
  id: string;
  name: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
  chapter: number;
};

export type RushOverviewCounts = {
  dungeons: number;
  occurrences: number;
  exigences: number;
  exigencesDone: number;
};

export type RushOverview = {
  rows: RushOverviewDungeon[];
  blocks: RushOverviewBlock[];
  steps: RushOverviewStep[];
  counts: RushOverviewCounts;
  /** Étapes où au moins un membre (ou le lecteur) a posé son repère. */
  flaggedSteps: string[];
};

export type RushOverviewFilter = {
  state: "all" | "todo" | "done";
  /** Id de séquence, ou `null` = toutes les étapes. */
  step: string | null;
  flagsOnly: boolean;
  query: string;
};

export const EMPTY_OVERVIEW_FILTER: RushOverviewFilter = {
  state: "all",
  step: null,
  flagsOnly: false,
  query: "",
};

/** Clé normalisée pour la recherche (accents et casse ignorés). */
function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Clés de donjon cochées « fait » pour une séquence (les clés sont par occurrence). */

/**
 * Construit la vue complète. Les `milestones` portent déjà les `dungeons` résolus
 * par la surface (même payload que la pastille de quête et le verrou).
 */
export function buildRushDungeonsOverview(input: {
  milestones: readonly RushMilestone[];
  me: RushOverviewMe;
  members?: readonly RushOverviewMember[] | null;
}): RushOverview {
  const members = input.members ?? [];
  const myDone = new Set(input.me.doneKeys);
  const rows = new Map<string, RushOverviewDungeon>();
  const blocks = new Map<string, RushOverviewBlock>();
  const steps = new Map<string, RushOverviewStep>();
  const flaggedSteps = new Set<string>(input.me.flags);
  for (const member of members) {
    for (const flag of member.flags) flaggedSteps.add(flag);
  }

  let exigences = 0;
  let exigencesDone = 0;
  let occurrences = 0;

  for (const milestone of input.milestones) {
    for (const rawSequence of milestone.sequences ?? []) {
      const sequence = rawSequence as RushOverviewSequenceLike;
      const dungeons = getDungeons(sequence as unknown as RushSequence);
      if (!dungeons.length) continue;

      const requirements = resolveSequenceDungeons(sequence as unknown as RushSequence, null).requirements;
      if (!requirements.length) continue;

      const myKeys = doneKeysForSequence(myDone, sequence.id);
      const progress = sequenceDungeonProgress(sequence as unknown as RushSequence, myKeys);
      const requiredBlocks = progress.requiredBlocks;
      const missingBlocks = progress.missingBlocks;
      exigences += requiredBlocks;
      exigencesDone += Math.max(0, requiredBlocks - missingBlocks);
      occurrences += requirements.filter((req) => !req.isOptional).length;

      const block = blocks.get(milestone.id) ?? {
        id: milestone.id,
        title: milestone.title,
        order: milestone.order,
        exigences: 0,
        exigencesDone: 0,
      };
      block.exigences += requiredBlocks;
      block.exigencesDone += Math.max(0, requiredBlocks - missingBlocks);
      blocks.set(milestone.id, block);

      steps.set(sequence.id, {
        id: sequence.id,
        name: sequence.subGuideName ?? sequence.subGuideRef ?? "Étape",
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        milestoneOrder: milestone.order,
        chapter: milestone.chapter,
      });

      const doneSet = new Set(myKeys);
      const groupSatisfied = new Map(
        progress.choiceGroups.map((group) => [group.key, group.satisfied] as const)
      );

      for (const requirement of requirements) {
        const occurrenceKey = dungeonOccurrenceKey(sequence.id, requirement.key);
        const doneBy = members
          .filter((member) => member.doneKeys.includes(occurrenceKey))
          .map((member) => member.key);
        const flaggedBy = members
          .filter((member) => member.flags.includes(sequence.id))
          .map((member) => member.key);
        const dungeon = dungeons.find((entry) => dungeonKeyOf(entry) === requirement.key);

        const occurrence: RushOverviewOccurrence = {
          sequenceId: sequence.id,
          sequenceName: sequence.subGuideName ?? sequence.subGuideRef ?? "Étape",
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          milestoneOrder: milestone.order,
          chapter: milestone.chapter,
          dungeonKey: requirement.key,
          occurrenceKey,
          isOptional: requirement.isOptional,
          isDone: doneSet.has(requirement.key),
          choiceGroup: requirement.choiceGroup,
          choiceLabel: requirement.choiceLabel,
          groupSatisfied: requirement.choiceGroup
            ? groupSatisfied.get(requirement.choiceGroup) === true
            : false,
          flaggedBy,
          doneBy,
        };

        const existing = rows.get(requirement.key);
        const row: RushOverviewDungeon = existing ?? {
          key: requirement.key,
          name: dungeon?.name ?? requirement.name,
          bossName: dungeon?.bossName ?? null,
          imageUrl: dungeon?.imageUrl ?? null,
          level: (dungeon as { level?: number | null } | undefined)?.level ?? null,
          isOcre: requirement.isOcre,
          dungeonId: dungeon?.id ?? null,
          slug: dungeon?.slug ?? null,
          occurrences: [],
          doneOccurrences: 0,
          totalOccurrences: 0,
          doneByMe: false,
          pendingByMe: false,
          membersDone: 0,
          membersTotal: members.length,
          blockId: milestone.id,
          blockTitle: milestone.title,
        };
        row.occurrences.push(occurrence);
        rows.set(requirement.key, row);
      }
    }
  }

  for (const row of rows.values()) {
    row.totalOccurrences = row.occurrences.filter((occurrence) => !occurrence.isOptional).length;
    row.doneOccurrences = row.occurrences.filter(
      (occurrence) => !occurrence.isOptional && occurrence.isDone
    ).length;
    row.doneByMe = row.doneOccurrences > 0;
    row.pendingByMe = row.occurrences.some(
      (occurrence) => !occurrence.isOptional && !occurrence.isDone && !occurrence.groupSatisfied
    );
    const doneMembers = new Set<string>();
    for (const occurrence of row.occurrences) {
      for (const key of occurrence.doneBy) doneMembers.add(key);
    }
    row.membersDone = doneMembers.size;
  }

  const orderedRows = [...rows.values()].sort((a, b) => {
    const blockA = blocks.get(a.blockId)?.order ?? 0;
    const blockB = blocks.get(b.blockId)?.order ?? 0;
    if (blockA !== blockB) return blockA - blockB;
    return a.name.localeCompare(b.name, "fr");
  });

  return {
    rows: orderedRows,
    blocks: [...blocks.values()].sort((a, b) => a.order - b.order),
    steps: [...steps.values()].sort(
      (a, b) => a.milestoneOrder - b.milestoneOrder || a.name.localeCompare(b.name, "fr")
    ),
    counts: { dungeons: rows.size, occurrences, exigences, exigencesDone },
    flaggedSteps: [...flaggedSteps],
  };
}

function doneKeysForSequence(doneKeys: ReadonlySet<string>, sequenceId: string): string[] {
  const prefix = `${sequenceId}::`;
  const out: string[] = [];
  for (const key of doneKeys) {
    if (key.startsWith(prefix)) out.push(key.slice(prefix.length));
  }
  return out;
}

/**
 * Applique les filtres. Les **occurrences** sont filtrées ; une ligne reste visible
 * dès qu'une occurrence passe, avec ses rollups **d'origine** (un donjon `4/6` reste
 * `4/6`, même si le filtre « à faire » n'affiche que les 2 restantes).
 */
export function filterRushDungeonsOverview(
  overview: RushOverview,
  filter: RushOverviewFilter
): RushOverviewDungeon[] {
  const query = normalize(filter.query);
  const out: RushOverviewDungeon[] = [];

  for (const row of overview.rows) {
    if (query && !normalize(row.name).includes(query) && !normalize(row.bossName).includes(query)) {
      continue;
    }
    const occurrences = row.occurrences.filter((occurrence) => {
      if (filter.step && occurrence.sequenceId !== filter.step) return false;
      if (filter.flagsOnly && occurrence.flaggedBy.length === 0) return false;
      // « À faire » = ce qui bloque encore : une alternative couverte par son groupe
      // n'est pas une tâche, un optionnel non plus (même doctrine que le verrou).
      if (filter.state === "todo" && (occurrence.isDone || occurrence.groupSatisfied || occurrence.isOptional)) {
        return false;
      }
      if (filter.state === "done" && !occurrence.isDone) return false;
      return true;
    });
    if (occurrences.length === 0) continue;
    out.push({ ...row, occurrences });
  }
  return out;
}

/** Regroupe des lignes par bloc (l'ordre vient de `overview.blocks`). */
export function groupRushDungeonsByBlock(
  overview: RushOverview,
  rows: readonly RushOverviewDungeon[]
): Array<{ block: RushOverviewBlock; rows: RushOverviewDungeon[] }> {
  const byBlock = new Map<string, RushOverviewDungeon[]>();
  for (const row of rows) {
    const list = byBlock.get(row.blockId) ?? [];
    list.push(row);
    byBlock.set(row.blockId, list);
  }
  const out: Array<{ block: RushOverviewBlock; rows: RushOverviewDungeon[] }> = [];
  for (const block of overview.blocks) {
    const list = byBlock.get(block.id);
    if (list?.length) out.push({ block, rows: list });
  }
  return out;
}

/**
 * Bloc ouvert par défaut (option A validée) : celui du **repère** du lecteur ;
 * sinon le premier bloc qui a encore quelque chose à faire ; sinon le premier.
 */
export function defaultOpenBlockId(overview: RushOverview, me: RushOverviewMe): string | null {
  const flagged = new Set(me.flags);
  const flaggedRow = overview.rows.find((row) =>
    row.occurrences.some((occurrence) => flagged.has(occurrence.sequenceId))
  );
  if (flaggedRow) return flaggedRow.blockId;
  const pendingRow = overview.rows.find((row) => row.pendingByMe);
  return pendingRow?.blockId ?? overview.blocks[0]?.id ?? null;
}

/** Compteur de la tuile : exigences satisfaites / exigences (occurrences, groupes = 1). */
export function rushDungeonsCounter(overview: RushOverview): { done: number; total: number } {
  return { done: overview.counts.exigencesDone, total: overview.counts.exigences };
}


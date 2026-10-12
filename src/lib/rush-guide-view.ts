/**
 * Vue partagée du guide Rush Sylvestre — UN seul modèle pour les deux surfaces.
 *
 * Pourquoi ce module existe : le guide est poussé depuis le GOD sous forme de
 * BLOCS (`RushMilestone`, 10 types) contenant des SÉQUENCES (`RushSequence`),
 * avec des DÉPENDANCES (`prereq_text`) et une nature (`activityTags`). Les deux
 * surfaces — publique (visiteur NON connecté) et guilde (membre) — doivent
 * afficher EXACTEMENT la même chose, à la présence communautaire près.
 *
 * Règle : on ne réinvente AUCUNE logique ici. On compose les helpers purs qui
 * font déjà foi dans le module et on expose une vue prête à rendre :
 *   · findNextActionableSequence / isSequenceBlockedByPrereqs / getPrereqRefs
 *   · isInfoSequence / getSequenceCoord / getGuideMetiersRequires
 *   · classifyTags / aggregateRushResources / getDungeons
 *
 * Pur : aucun state, aucun accès réseau, aucune notion de guilde. Les compteurs
 * viennent de la progression passée en entrée (localStorage côté public, base
 * côté guilde) — le modèle ne sait pas d'où elle vient, et c'est voulu.
 */

import type { RushActivityTag, RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { ALIGNMENTS, type AlignmentId } from "@/lib/dofus-assets";
import { getAlignmentSet } from "@/lib/rush-helpers";
import {
  findNextActionableSequence,
  formatProgressLabel,
  getGuideMetiersRequires,
  getPrereqRefs,
  getSequenceCoord,
  isInfoSequence,
  isSequenceBlockedByPrereqs,
  type RushPrereqRef,
} from "@/lib/rush-guide-utils";
import {
  aggregateRushResources,
  classifyTags,
  getDungeons,
  type DungeonInfo,
  type RushResourceAgg,
} from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";

/** Coordonnée telle que la résout le module (`pos_tags` > titre > tips > note). */
export type RushCoord = NonNullable<ReturnType<typeof getSequenceCoord>>;

/** Un bloc du GOD ne compte dans la progression que s'il est fait de vraies étapes. */
export function isCountableBlock(ms: { type?: string | null }): boolean {
  return ms.type !== "SEPARATEUR" && ms.type !== "INFO";
}

export type RushStepState = "done" | "current" | "todo" | "locked";

/** Une étape (séquence) prête à rendre : nature, coordonnée, dépendances. */
export type RushStepView = {
  id: string;
  blockId: string;
  blockTitle: string;
  chapter: number;
  chapterLabel: string;
  title: string;
  subtitle: string | null;
  isOptional: boolean;
  coord: RushCoord | null;
  travelCommand: string | null;
  /** Tags de nature (donjon, combat, songes…) — tags cachés exclus. */
  nature: RushActivityTag[];
  /** Conditions réelles (horaire, métier, sort, alignement, prérequis). */
  conditions: RushActivityTag[];
  dungeons: DungeonInfo[];
  /** Dépendances déclarées au GOD (`prereq_text`), terminées ou non. */
  prereqs: RushPrereqRef[];
  /** Celles qui ne sont PAS encore satisfaites : c'est ce qui verrouille. */
  blockedBy: RushPrereqRef[];
  tips: string | null;
};

/** Un bloc du journal : une ligne, un état, une dépendance éventuelle. */
export type RushBlockView = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  chapter: number;
  chapterLabel: string;
  isOptional: boolean;
  steps: number;
  done: number;
  state: RushStepState;
  coord: RushCoord | null;
  blockedBy: RushPrereqRef[];
};

export type RushChapterView = {
  chapter: number;
  label: string;
  blocks: number;
  done: number;
  total: number;
};

/** Un repère : la coordonnée d'une étape, copiable en commande de jeu. */
export type RushLandmarkView = {
  seqId: string;
  label: string;
  blockTitle: string;
  chapter: number;
  coord: RushCoord;
  travelCommand: string;
  isDone: boolean;
};

export type RushGuideView = {
  counters: {
    totalSteps: number;
    doneSteps: number;
    remainingSteps: number;
    percent: number;
    totalBlocks: number;
    doneBlocks: number;
    /** Libellé standardisé du module (jamais fabriqué à la main ailleurs). */
    label: string;
  };
  /** L'étape à faire MAINTENANT : la seule action de l'écran. */
  active: RushStepView | null;
  journal: RushBlockView[];
  chapters: RushChapterView[];
  landmarks: RushLandmarkView[];
  resources: {
    total: RushResourceAgg[];
    remaining: RushResourceAgg[];
  };
  metiers: { id: string; name: string; level: number }[];
  /** Alignement acquis à cet instant (dernière quête d'alignement validée). */
  alignment: RushAlignmentView | null;
};

export type RushGuideViewInput = {
  milestones: RushMilestone[];
  /** Progression locale (public) ou serveur (guilde). */
  completedSeqIds?: Iterable<string> | null;
  /** Repère posé par le joueur : prioritaire s'il est encore actionnable. */
  bookmarkedSeqId?: string | null;
};


const toIdSet = (ids?: Iterable<string> | null): Set<string> =>
  ids instanceof Set ? ids : new Set(ids || []);

const blockType = (ms: RushMilestone): string => String(ms.type || "");

/**
 * L'alignement que le guide a RÉELLEMENT donné au joueur : le dernier tag
 * `alignment_set` validé, dans l'ordre du guide. C'est le modèle chaîné 1 → 100
 * déjà appliqué par le module (dashboard/overlay) : la quête la plus avancée fait
 * foi, en décocher une ramène à la précédente — ici on ne fait que le LIRE.
 */
export type RushAlignmentView = {
  camp: string;
  label: string;
  level: number;
  crestSrc: string;
  /** L'étape qui l'a donné : le joueur peut y retourner pour vérifier. */
  seqId: string;
  stepTitle: string;
  chapter: number;
  chapterLabel: string;
};

/** Les données poussent le camp en clair (« bontarien ») ou par le blason. */
const ALIGNMENT_ALIASES: Record<string, AlignmentId> = {
  bonta: "bontarien",
  brakmar: "brakmarien",
  bontarien: "bontarien",
  brakmarien: "brakmarien",
  neutre: "neutre",
};

const alignmentDef = (camp?: string | null) =>
  ALIGNMENTS.find((a) => a.id === ALIGNMENT_ALIASES[(camp || "").toLowerCase()]) ?? null;

/** Blason d'ordre — le blason « neutre » est le repli, jamais un carton vide. */
export function alignmentCrest(camp?: string | null): string {
  return alignmentDef(camp)?.icon ?? "/ordres/neutre.png";
}

/** Nom lisible du camp ; retombe sur la valeur brute quand elle est inconnue. */
export function alignmentLabel(camp?: string | null): string {
  return alignmentDef(camp)?.name ?? (camp || "Neutre");
}

/**
 * Calcule l'alignement acquis à partir des SEULES étapes validées.
 * Pur : aucun stockage, aucun réseau — la vue se recalcule à chaque coche.
 */
export function computeRushAlignment(
  milestones: RushMilestone[],
  completedSeqIds?: Iterable<string> | null
): RushAlignmentView | null {
  const completed = toIdSet(completedSeqIds);
  let found: RushAlignmentView | null = null;

  for (const ms of milestones.filter(isCountableBlock)) {
    for (const seq of ms.sequences) {
      if (!completed.has(seq.id)) continue;
      const set = getAlignmentSet(seq);
      if (!set) continue;
      found = {
        camp: set.camp,
        label: alignmentLabel(set.camp),
        level: set.level,
        crestSrc: alignmentCrest(set.camp),
        seqId: seq.id,
        stepTitle: seq.subGuideName || seq.subGuideRef || ms.title,
        chapter: ms.chapter,
        chapterLabel: ms.chapterLabel,
      };
    }
  }

  return found;
}

/** Construit la vue d'une étape (séquence) : aucun calcul métier inventé. */
function buildStepView(
  ms: RushMilestone,
  seq: RushSequence,
  completed: Set<string>,
  allMilestones: RushMilestone[]
): RushStepView {
  const coord = getSequenceCoord(seq);
  const tags = classifyTags(seq.activityTags);
  const prereqs = getPrereqRefs(seq, allMilestones);

  return {
    id: seq.id,
    blockId: ms.id,
    blockTitle: ms.title,
    chapter: ms.chapter,
    chapterLabel: ms.chapterLabel,
    title: seq.subGuideName || seq.subGuideRef || ms.title,
    subtitle: seq.note ?? ms.subtitle ?? null,
    isOptional: !!seq.isOptional,
    coord,
    travelCommand: coord?.travelCommand ?? null,
    nature: tags.nature,
    conditions: tags.condition,
    dungeons: getDungeons(seq),
    prereqs,
    blockedBy: prereqs.filter((p) => !completed.has(p.seqId)),
    tips: seq.tips ?? ms.tips ?? null,
  };
}

/**
 * Construit la vue du guide à partir des blocs poussés par le GOD.
 *
 * Ordre de lecture imposé (identique sur les deux surfaces) :
 *   1. l'étape à faire maintenant ; 2. le journal ; 3. la préparation ; 4. les repères.
 */
export function buildRushGuideView(input: RushGuideViewInput): RushGuideView {
  const milestones = input.milestones || [];
  const completed = toIdSet(input.completedSeqIds);

  const countableBlocks = milestones.filter(isCountableBlock);

  let totalSteps = 0;
  let doneSteps = 0;
  for (const ms of countableBlocks) {
    for (const seq of ms.sequences) {
      if (isInfoSequence(seq)) continue;
      totalSteps += 1;
      if (completed.has(seq.id)) doneSteps += 1;
    }
  }
  const remainingSteps = Math.max(0, totalSteps - doneSteps);
  const percent = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  // L'étape active : le module décide (repère du joueur d'abord, puis première
  // étape non terminée, non informative et non bloquée par un prérequis).
  const found = findNextActionableSequence(milestones, completed, input.bookmarkedSeqId ?? null);
  const active = found
    ? buildStepView(found.milestone, found.sequence, completed, milestones)
    : null;

  const journal: RushBlockView[] = countableBlocks.map((ms) => {
    const steps = ms.sequences.filter((s) => !isInfoSequence(s));
    const done = steps.filter((s) => completed.has(s.id)).length;
    const isDone = steps.length > 0 && done === steps.length;

    // La dépendance affichée est celle de la PREMIÈRE étape encore à faire :
    // c'est elle qui explique pourquoi le bloc est verrouillé.
    const nextStep = steps.find((s) => !completed.has(s.id));
    const blockedBy = nextStep
      ? getPrereqRefs(nextStep, milestones).filter((p) => !completed.has(p.seqId))
      : [];
    const blocked = !!nextStep && isSequenceBlockedByPrereqs(nextStep, completed, milestones);

    const state: RushStepState = isDone
      ? "done"
      : active && active.blockId === ms.id
        ? "current"
        : blocked
          ? "locked"
          : "todo";

    const coordSeq = steps.find((s) => getSequenceCoord(s));

    return {
      id: ms.id,
      type: blockType(ms),
      title: ms.title,
      subtitle: ms.subtitle ?? null,
      chapter: ms.chapter,
      chapterLabel: ms.chapterLabel,
      isOptional: !!ms.isOptional,
      steps: steps.length,
      done,
      state,
      coord: coordSeq ? getSequenceCoord(coordSeq) : null,
      blockedBy,
    };
  });

  const chapterMap = new Map<number, RushChapterView>();
  for (const b of journal) {
    const cur = chapterMap.get(b.chapter);
    if (cur) {
      cur.blocks += 1;
      cur.total += b.steps;
      cur.done += b.done;
    } else {
      chapterMap.set(b.chapter, {
        chapter: b.chapter,
        label: b.chapterLabel,
        blocks: 1,
        done: b.done,
        total: b.steps,
      });
    }
  }
  const chapters = [...chapterMap.values()].sort((a, b) => a.chapter - b.chapter);

  const landmarks: RushLandmarkView[] = [];
  for (const ms of countableBlocks) {
    for (const seq of ms.sequences) {
      if (isInfoSequence(seq)) continue;
      const coord = getSequenceCoord(seq);
      if (!coord) continue;
      landmarks.push({
        seqId: seq.id,
        label: seq.subGuideName || seq.subGuideRef || ms.title,
        blockTitle: ms.title,
        chapter: ms.chapter,
        coord,
        travelCommand: coord.travelCommand,
        isDone: completed.has(seq.id),
      });
    }
  }

  return {
    counters: {
      totalSteps,
      doneSteps,
      remainingSteps,
      percent,
      totalBlocks: countableBlocks.length,
      doneBlocks: journal.filter((b) => b.state === "done").length,
      label: formatProgressLabel(doneSteps, totalSteps, "étapes"),
    },
    active,
    journal,
    chapters,
    landmarks,
    resources: {
      // On agrège sur TOUS les blocs, exactement comme l'overlay et le client
      // public le font aujourd'hui : filtrer les blocs INFO ici changerait
      // silencieusement la liste de préparation au moment de la bascule.
      total: aggregateRushResources(milestones),
      remaining: aggregateRushResources(milestones, completed),
    },
    metiers: getGuideMetiersRequires(milestones),
    // L'alignement « en temps réel » : recalculé à chaque coche, jamais stocké.
    alignment: computeRushAlignment(milestones, completed),
  };
}

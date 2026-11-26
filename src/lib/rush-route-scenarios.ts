/**
 * **Scénarios de route du Rush Sylvestre** — règle pure (17/11/2026).
 *
 * Le moteur `resolveRushRoute` filtre une route **quand le joueur a déjà choisi**
 * (cité, Ordre, classe). Il laisse volontairement visibles les branches non choisies
 * (`camp = null` ⇒ toutes les cités) pour ne jamais perdre de contenu. Ce module
 * ajoute l'**état** qui manquait, mesuré sur Tougli le 17/11/2026 :
 *
 * | Situation | Tougli (mesuré) | SigilOS (ce module) |
 * |---|---|---|
 * | aucune classe | une branche `Classe=` par classe (19), résolue par le personnage | 19 quêtes masquées + `needsClassChoice` |
 * | aucun alignement | branche `Ali=Neutre` = **1 quête** (1316 « La rivalité »), cités et Ordres masqués | idem, `kind = "no-alignment"` |
 * | alignement au départ | une seule cité (Bonta 100 / Brâkmar 102), Ordres masqués tant qu'aucun Ordre | idem |
 * | changement de cité | la branche de l'ancienne cité disparaît, la nouvelle repart de sa 1ʳᵉ quête | idem + plan de reset (ids à décocher) |
 * | changement d'Ordre | 5 quêtes de l'ancien Ordre disparaissent, les 5 du nouveau apparaissent | idem + plan de reset |
 *
 * ⚠️ Ce module ne remplace pas `resolveRushRoute` : il **prépare** la route (retire les
 * branches qui n'ont pas encore de choix), puis lui délègue le filtrage final. Une seule
 * règle de visibilité reste donc dans `rush-route.ts`.
 */

import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { resolveDofusClassId } from "@/lib/dofus-assets";
import { alignmentCountForCamp, alignmentResetSeeds } from "@/lib/rush-guide-utils";
import { normalizeOrderCode, orderCamp } from "@/lib/rush-order-codes";
import {
  isNeutralAlignment,
  normalizeAlignmentCamp,
  resolveRushRoute,
  type RushAlignmentCamp,
} from "@/lib/rush-route";

/** Paliers réels des quêtes d'Ordre (20 → 100 quêtes de cité validées). */
export const RUSH_ORDER_LEVELS = [20, 40, 60, 80, 100] as const;

export type RushScenarioKind =
  | "no-alignment"
  | "neutral"
  | "aligned"
  | "camp-switch"
  | "order-switch";

export type RushScenarioInput = {
  milestones: RushMilestone[];
  /** Classe déclarée (`cra`, `Crâ`, …). */
  playerClass?: string | null;
  /** Cité déclarée (`bontarien`, `brakmarien`, `neutre`, `null`). */
  camp?: string | null;
  /** Ordre déclaré (code canonique, id court ou libellé). */
  order?: string | null;
  /** Cité **précédente** — sert à détecter un changement en cours de route. */
  previousCamp?: string | null;
  /** Ordre **précédent** — sert à détecter un changement d'Ordre seul. */
  previousOrder?: string | null;
  /** Quêtes déjà validées (ids de séquence). */
  completedSeqIds?: Iterable<string>;
};

export type RushScenarioCounts = {
  total: number;
  visible: number;
  hiddenByClass: number;
  hiddenByCamp: number;
  hiddenByOrder: number;
  classQuests: number;
  campQuests: number;
  orderQuests: number;
  neutralQuests: number;
};

export type RushScenarioSwitchPlan = {
  kind: "camp" | "order";
  fromCamp: RushAlignmentCamp | null;
  toCamp: RushAlignmentCamp | null;
  fromOrder: string | null;
  toOrder: string | null;
  /** Portée du reset (toutes les quêtes de l'ancienne branche). */
  resetSeqIds: string[];
  /** Celles qui étaient réellement cochées (ce que le joueur verra se décocher). */
  resetCompletedSeqIds: string[];
  /** Progression conservée (hors branche quittée). */
  keptCompletedSeqIds: string[];
};

export type RushScenarioResult = {
  kind: RushScenarioKind;
  camp: RushAlignmentCamp | null;
  neutral: boolean;
  playerClass: string | null;
  order: string | null;
  route: RushMilestone[];
  counts: RushScenarioCounts;
  needsClassChoice: boolean;
  needsCampChoice: boolean;
  needsOrderChoice: boolean;
  canChooseCamp: boolean;
  canChooseOrder: boolean;
  cityCompleted: number;
  /** Prochain palier d'Ordre (20/40/60/80/100), `null` si tout est atteint. */
  nextOrderThreshold: number | null;
  switchPlan: RushScenarioSwitchPlan | null;
  warnings: string[];
};

type SequenceReason = "class" | "camp" | "order" | null;

/** Valeur brute → cité connue, ou `null` (une valeur inconnue n'ouvre rien). */
function readCamp(value: string | null | undefined): {
  raw: string;
  camp: RushAlignmentCamp | null;
  neutral: boolean;
  unknown: boolean;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { raw, camp: null, neutral: false, unknown: false };
  if (isNeutralAlignment(raw)) return { raw, camp: null, neutral: true, unknown: false };
  const camp = normalizeAlignmentCamp(raw);
  return { raw, camp, neutral: false, unknown: !camp };
}

/** Classe déclarée → id stable, ou `null` (fail-closed). */
function readClass(value: string | null | undefined): { raw: string; id: string | null } {
  const raw = (value ?? "").trim();
  if (!raw) return { raw, id: null };
  return { raw, id: resolveDofusClassId(raw) };
}

/**
 * Raison **unique** pour laquelle une séquence sort de la route.
 *
 * L'ordre des étages est celui du moteur : classe → cité → Ordre. Une séquence qui
 * cumule deux raisons est comptée une seule fois (la première), sinon les compteurs
 * de diagnostic mentiraient.
 */
function sequenceReason(
  seq: RushSequence,
  state: {
    playerClass: string | null;
    camp: RushAlignmentCamp | null;
    neutral: boolean;
    order: string | null;
  }
): SequenceReason {
  const rawClass = (seq.classReq ?? "").trim();
  if (rawClass) {
    const required = resolveDofusClassId(rawClass) ?? rawClass.toLowerCase();
    if (!state.playerClass || required !== state.playerClass) return "class";
  }

  const rawCamp = (seq.alignReq ?? "").trim();
  if (rawCamp) {
    const isNeutral = isNeutralAlignment(rawCamp);
    const camp = normalizeAlignmentCamp(rawCamp);
    if (isNeutral) {
      // « La rivalité » n'est visible que tant qu'aucune cité n'est choisie.
      if (state.camp !== null) return "camp";
    } else if (!camp) {
      return "camp"; // fail-closed : une cité inconnue ne débloque rien
    } else if (state.camp === null) {
      // Aucune cité choisie (ou neutre) : les deux branches de cité sont encore fermées.
      return "camp";
    } else if (camp !== state.camp) {
      return "camp";
    }
  }

  const rawOrder = (seq.alignOrderCode ?? "").trim();
  if (rawOrder) {
    const required = normalizeOrderCode(rawOrder) ?? rawOrder.toLowerCase();
    if (!state.order || required !== state.order) return "order";
  }

  return null;
}

/** Retire les branches qui n'ont pas encore de choix (cité absente ou neutre). */
function stripUnchosenBranches(milestones: RushMilestone[]): RushMilestone[] {
  return milestones.map((milestone) => ({
    ...milestone,
    sequences: (milestone.sequences ?? []).filter((seq) => {
      const rawCamp = (seq.alignReq ?? "").trim();
      const rawOrder = (seq.alignOrderCode ?? "").trim();
      // Une quête d'Ordre n'a de sens qu'avec une cité.
      if (rawOrder) return false;
      if (!rawCamp) return true;
      // Seule la quête neutre survit : les deux cités sont des choix qui n'existent pas
      // encore. Une valeur inconnue est écartée (fail-closed).
      return isNeutralAlignment(rawCamp);
    }),
  }));
}

/** Retire les Ordres tant qu'aucun Ordre n'est choisi (Tougli les masque aussi). */
function stripOrders(milestones: RushMilestone[]): RushMilestone[] {
  return milestones.map((milestone) => ({
    ...milestone,
    sequences: (milestone.sequences ?? []).filter((seq) => !(seq.alignOrderCode ?? "").trim()),
  }));
}

/**
 * Retire **les 19 branches de classe** quand aucune classe n'est déclarée.
 *
 * Sans ce filtre, `resolveRushRoute` laisse volontairement toutes les branches
 * visibles (`playerClass = null`) : le joueur voit 19 quêtes là où Tougli n'en montre
 * qu'une. Le prompt `needsClassChoice` remplace ces quêtes.
 */
function stripUnchosenClasses(milestones: RushMilestone[]): RushMilestone[] {
  return milestones.map((milestone) => ({
    ...milestone,
    sequences: (milestone.sequences ?? []).filter((seq) => !(seq.classReq ?? "").trim()),
  }));
}

function countSequences(milestones: RushMilestone[]) {
  let total = 0;
  let classQuests = 0;
  let campQuests = 0;
  let orderQuests = 0;
  let neutralQuests = 0;
  for (const milestone of milestones) {
    for (const seq of milestone.sequences ?? []) {
      total += 1;
      if ((seq.classReq ?? "").trim()) classQuests += 1;
      if ((seq.alignReq ?? "").trim()) {
        campQuests += 1;
        if (isNeutralAlignment(seq.alignReq)) neutralQuests += 1;
      }
      if ((seq.alignOrderCode ?? "").trim()) orderQuests += 1;
    }
  }
  return { total, classQuests, campQuests, orderQuests, neutralQuests };
}

/** Prochain palier d'Ordre strictement supérieur au compteur de cité. */
export function nextOrderThreshold(cityCompleted: number): number | null {
  return RUSH_ORDER_LEVELS.find((level) => cityCompleted < level) ?? null;
}

/**
 * Résout l'état de route d'un joueur : route visible, prompts et plan de reset.
 *
 * **Aucune écriture**, aucune mutation des jalons. Le calcul se fait sur des copies.
 */
export function resolveRushScenario(input: RushScenarioInput): RushScenarioResult {
  const milestones = input.milestones ?? [];
  const completed = new Set(input.completedSeqIds ?? []);
  const warnings: string[] = [];

  const player = readClass(input.playerClass);
  if (player.raw && !player.id) {
    warnings.push(
      `Classe « ${player.raw} » inconnue : les quêtes de classe restent masquées (fail-closed).`
    );
  }

  const campState = readCamp(input.camp);
  if (campState.unknown) {
    warnings.push(
      `Cité « ${campState.raw} » inconnue : la route reste sans alignement (fail-closed).`
    );
  }

  const normalizedOrder = normalizeOrderCode(input.order);
  let order = normalizedOrder;
  if ((input.order ?? "").trim() && !normalizedOrder) {
    warnings.push(
      `Ordre « ${(input.order ?? "").trim()} » inconnu : les quêtes d'Ordre restent masquées.`
    );
  } else if (normalizedOrder && campState.camp) {
    const campOfOrder = orderCamp(normalizedOrder);
    if (campOfOrder && campOfOrder !== campState.camp) {
      warnings.push(
        `L'Ordre « ${(input.order ?? "").trim()} » n'appartient pas à la cité choisie : il est ignoré.`
      );
      order = null;
    }
  } else if (normalizedOrder && !campState.camp) {
    // Un Ordre sans cité n'a aucun sens dans le jeu : on ne l'affiche pas.
    if (!campState.neutral && (input.order ?? "").trim()) {
      warnings.push("Un Ordre est déclaré sans cité : il est ignoré jusqu'au choix de la cité.");
    }
    order = null;
  }

  const baseCounts = countSequences(milestones);
  const state = {
    playerClass: player.id,
    camp: campState.camp,
    neutral: campState.neutral,
    order,
  };

  // Pourquoi chaque séquence sort (une seule raison par séquence).
  let hiddenByClass = 0;
  let hiddenByCamp = 0;
  let hiddenByOrder = 0;
  for (const milestone of milestones) {
    for (const seq of milestone.sequences ?? []) {
      const reason = sequenceReason(seq, state);
      if (reason === "class") hiddenByClass += 1;
      else if (reason === "camp") hiddenByCamp += 1;
      else if (reason === "order") hiddenByOrder += 1;
    }
  }

  const hasCampBranches = baseCounts.campQuests > 0 || baseCounts.orderQuests > 0;
  const needsClassChoice = baseCounts.classQuests > 0 && player.id === null;
  const needsCampChoice = hasCampBranches && campState.camp === null && !campState.neutral;
  const cityCompleted = campState.camp
    ? alignmentCountForCamp(milestones, completed, campState.camp)
    : 0;
  const canChooseOrder =
    baseCounts.orderQuests > 0 && campState.camp !== null && (order !== null || cityCompleted >= 20);
  const needsOrderChoice =
    baseCounts.orderQuests > 0 && campState.camp !== null && order === null && canChooseOrder;

  if (needsClassChoice) {
    warnings.push("Aucune classe déclarée : les quêtes de classe sont masquées jusqu'au choix.");
  }
  if (needsCampChoice) {
    warnings.push(
      "Aucune cité déclarée : seules les quêtes communes et « La rivalité » sont visibles."
    );
  }
  if (campState.neutral) {
    warnings.push(
      "Alignement neutre : « La rivalité » est visible, les séries de cité et d'Ordre sont masquées."
    );
  }

  // ── Changement de cité / d'Ordre (plan de reset, jamais appliqué ici) ───────
  const previousCamp = normalizeAlignmentCamp(input.previousCamp);
  const previousOrder = normalizeOrderCode(input.previousOrder);
  let switchPlan: RushScenarioSwitchPlan | null = null;

  const campChanged =
    previousCamp !== null && previousCamp !== campState.camp; // neutre → cité n'est PAS un reset
  const orderChanged =
    !campChanged &&
    previousCamp !== null &&
    previousCamp === campState.camp &&
    previousOrder !== null &&
    previousOrder !== order;

  if (campChanged && previousCamp) {
    const resetSeqIds = alignmentResetSeeds(milestones, previousCamp);
    const resetCompletedSeqIds = resetSeqIds.filter((id) => completed.has(id));
    const keptCompletedSeqIds = [...completed].filter((id) => !resetCompletedSeqIds.includes(id));
    switchPlan = {
      kind: "camp",
      fromCamp: previousCamp,
      toCamp: campState.camp,
      fromOrder: previousOrder,
      toOrder: order,
      resetSeqIds,
      resetCompletedSeqIds,
      keptCompletedSeqIds,
    };
    warnings.push(
      `Changement de cité : ${resetCompletedSeqIds.length} quête(s) de l'ancienne cité seront décochées (le reste de la progression est conservé).`
    );
  } else if (orderChanged && previousOrder) {
    const resetSeqIds = milestones
      .flatMap((milestone) => milestone.sequences ?? [])
      .filter((seq) => normalizeOrderCode(seq.alignOrderCode) === previousOrder)
      .map((seq) => seq.id);
    const resetCompletedSeqIds = resetSeqIds.filter((id) => completed.has(id));
    const keptCompletedSeqIds = [...completed].filter((id) => !resetCompletedSeqIds.includes(id));
    switchPlan = {
      kind: "order",
      fromCamp: previousCamp,
      toCamp: campState.camp,
      fromOrder: previousOrder,
      toOrder: order,
      resetSeqIds,
      resetCompletedSeqIds,
      keptCompletedSeqIds,
    };
    warnings.push(
      `Changement d'Ordre : ${resetCompletedSeqIds.length} quête(s) de l'ancien Ordre seront décochées.`
    );
  }

  // ── Route visible : on retire d'abord ce qui n'a pas encore de choix, puis on
  //    laisse `resolveRushRoute` appliquer la règle unique de visibilité. ───────
  let base = milestones;
  if (player.id === null) base = stripUnchosenClasses(base);
  if (campState.camp === null) base = stripUnchosenBranches(base);
  else if (order === null) base = stripOrders(base);

  const route = resolveRushRoute(base, {
    camp: campState.camp,
    order,
    playerClass: player.id,
  });

  const visible = route.reduce((n, milestone) => n + (milestone.sequences?.length ?? 0), 0);

  const kind: RushScenarioKind = campChanged
    ? "camp-switch"
    : orderChanged
      ? "order-switch"
      : campState.neutral
        ? "neutral"
        : needsCampChoice
          ? "no-alignment"
          : "aligned";

  return {
    kind,
    camp: campState.camp,
    neutral: campState.neutral,
    playerClass: player.id,
    order,
    route,
    counts: {
      total: baseCounts.total,
      visible,
      hiddenByClass,
      hiddenByCamp,
      hiddenByOrder,
      classQuests: baseCounts.classQuests,
      campQuests: baseCounts.campQuests,
      orderQuests: baseCounts.orderQuests,
      neutralQuests: baseCounts.neutralQuests,
    },
    needsClassChoice,
    needsCampChoice,
    needsOrderChoice,
    canChooseCamp: needsCampChoice || campState.neutral,
    canChooseOrder,
    cityCompleted,
    nextOrderThreshold: nextOrderThreshold(cityCompleted),
    switchPlan,
    warnings,
  };
}

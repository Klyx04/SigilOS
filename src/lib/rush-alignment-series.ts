/**
 * Rush Sylvestre — **séries d'alignement numérotées** (règle pure).
 *
 * Demande du 18/11/2026 : les quêtes de cité s'affichent « Ali 1 → Ali 100 » côté
 * Bontarien et « Ali 1 → Ali 102 » côté Brâkmarien, les deux séries **séparées** ;
 * les quêtes d'Ordre sont numérotées par **rang** (1 → 5) et regroupées par Ordre.
 *
 * ⚠️ Le rang n'est **jamais écrit dans `subGuideName`** : les prérequis sont résolus
 * **par nom** (`resolvePrereqTag`) — préfixer le nom casserait silencieusement tous
 * les verrous `prereq_text`. C'est donc une valeur **dérivée**, recalculée à
 * l'affichage, et jamais persistée.
 *
 * La série elle-même n'est pas recalculée ici : `buildRushBranches` fait autorité
 * (ordre du guide = bloc puis ordre interne, Ordres exclus de la série de cité).
 */

import { buildRushBranches, RUSH_ORDER_LEVELS, type RushBranchSequence } from "@/lib/rush-branches";
import { normalizeAlignmentCamp, type RushAlignmentCamp } from "@/lib/rush-route";
import type { RushMilestone } from "@/types/rush-guide-types";

export const RUSH_ALIGNMENT_CAMP_LABELS: Record<RushAlignmentCamp, string> = {
  bontarien: "Bontarien",
  brakmarien: "Brâkmarien",
};

export type RushAlignmentSeries = {
  kind: "cite" | "ordre";
  camp: RushAlignmentCamp;
  /** Rang 1..100/102 pour une cité, 1..5 pour un Ordre. */
  rank: number;
  /** Libellé court, prêt à afficher : « Ali 12 » ou « Rang 2 ». */
  label: string;
  /** Nom de l'Ordre (`Cœur Vaillant`…), `null` pour une quête de cité. */
  orderName?: string | null;
};

export type RushAlignmentSeriesMap = Map<string, RushAlignmentSeries>;

/**
 * Nom d'Ordre **court** pour l'en-tête : le catalogue porte « Ordre du Cœur
 * Vaillant », on n'en garde que « Cœur Vaillant » (l'en-tête dit déjà la cité).
 * La clé de groupe, elle, garde le nom complet — c'est la valeur du catalogue.
 */
function shortOrderName(name: string): string {
  const short = name
    .replace(/^Ordre\s+(?:du\s+|de\s+la\s+|des\s+|de\s+|d['’])?/i, "")
    .trim();
  return short || name;
}

/**
 * Construit la table `seqId → série` de **tout** le guide.
 *
 * Le calcul se fait sur la liste complète (avant filtrage de route) : un rang est
 * une propriété du guide, pas du choix du joueur — filtrer une cité ne doit pas
 * renuméroter l'autre.
 */
export function buildAlignmentSeries(
  milestones: readonly RushMilestone[]
): RushAlignmentSeriesMap {
  const flat: RushBranchSequence[] = [];
  for (const milestone of milestones) {
    for (const seq of milestone.sequences ?? []) {
      flat.push({
        id: seq.id,
        order: seq.order,
        blockOrder: milestone.order,
        subGuideName: seq.subGuideName ?? "",
        alignReq: seq.alignReq ?? null,
        alignOrderCode: seq.alignOrderCode ?? null,
        alignLevelReq: seq.alignLevelReq ?? null,
        classReq: seq.classReq ?? null,
      });
    }
  }

  const view = buildRushBranches(flat);
  const series: RushAlignmentSeriesMap = new Map();

  // Étage 1 — cités : le rang EST la position dans la série appariée.
  for (const pair of view.pairs) {
    if (pair.bontarien) {
      series.set(pair.bontarien.id, {
        kind: "cite",
        camp: "bontarien",
        rank: pair.position,
        label: `Ali ${pair.position}`,
        orderName: null,
      });
    }
    if (pair.brakmarien) {
      series.set(pair.brakmarien.id, {
        kind: "cite",
        camp: "brakmarien",
        rank: pair.position,
        label: `Ali ${pair.position}`,
        orderName: null,
      });
    }
  }

  // Étage 2 — Ordres : rang = palier (20 → 1 … 100 → 5), jamais la position.
  for (const camp of view.camps) {
    for (const order of camp.orders) {
      for (const slot of order.slots) {
        const rank = (RUSH_ORDER_LEVELS as readonly number[]).indexOf(slot.level) + 1;
        if (rank <= 0) continue;
        for (const seq of slot.sequences) {
          series.set(seq.id, {
            kind: "ordre",
            camp: camp.camp,
            rank,
            label: `Rang ${rank}`,
            orderName: order.name,
          });
        }
      }
    }
  }

  return series;
}

function sectionOf(entry: RushAlignmentSeries | undefined): {
  key: string;
  camp: RushAlignmentCamp | null;
  label: string | null;
} {
  if (!entry) return { key: "commun", camp: null, label: null };
  if (entry.kind === "cite") {
    return {
      key: `cite:${entry.camp}`,
      camp: entry.camp,
      label: RUSH_ALIGNMENT_CAMP_LABELS[entry.camp],
    };
  }
  return {
    key: `ordre:${entry.camp}:${entry.orderName ?? entry.rank}`,
    camp: entry.camp,
    label: entry.orderName
      ? `${RUSH_ALIGNMENT_CAMP_LABELS[entry.camp]} · ${shortOrderName(entry.orderName)}`
      : RUSH_ALIGNMENT_CAMP_LABELS[entry.camp],
  };
}

/**
 * Section d'un **groupe de séquences** (par exemple un bloc de quête du guide
 * public, qui peut mêler un encart info et une étape) : celle de la première
 * séquence reconnue. Aucune reconnue ⇒ tronc commun.
 */
export function alignmentSectionFor<T extends { id: string }>(
  sequences: readonly T[],
  series: RushAlignmentSeriesMap
): { key: string; camp: RushAlignmentCamp | null; label: string | null } {
  for (const seq of sequences) {
    const entry = series.get(seq.id);
    if (entry) return sectionOf(entry);
  }
  return sectionOf(undefined);
}

export type RushAlignmentGroup<T> = {
  /** Clé stable du groupe (`commun`, `cite:bontarien`, `ordre:brakmarien:Cœur Vaillant`). */
  key: string;
  camp: RushAlignmentCamp | null;
  /** En-tête à afficher ; `null` pour le tronc commun (aucun en-tête). */
  label: string | null;
  sequences: T[];
};

/**
 * Regroupe les séquences d'un bloc en **sections contiguës** : tronc commun,
 * puis une section par cité, puis une section par Ordre (cité + Ordre).
 *
 * L'ordre interne de chaque section est conservé ; l'ordre des sections suit la
 * première apparition dans le bloc. Un bloc qui ne mélange rien rend **un** groupe
 * (`groups.length === 1`) : l'appelant n'affiche alors aucun en-tête.
 */
export function groupByAlignmentSeries<T extends { id: string }>(
  sequences: readonly T[],
  series: RushAlignmentSeriesMap
): RushAlignmentGroup<T>[] {
  const groups = new Map<string, RushAlignmentGroup<T>>();

  for (const seq of sequences) {
    const section = sectionOf(series.get(seq.id));
    const group =
      groups.get(section.key) ?? { ...section, sequences: [] as T[] };
    group.sequences.push(seq);
    groups.set(section.key, group);
  }

  return [...groups.values()];
}

/** Camp normalisé d'une séquence, sans passer par la table (utile aux tests). */
export function alignmentCampOfSequence(seq: {
  alignReq?: string | null;
}): RushAlignmentCamp | null {
  return normalizeAlignmentCamp(seq.alignReq);
}

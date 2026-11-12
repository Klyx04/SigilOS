/**
 * Route d'alignement du Rush Sylvestre — **règle pure** (V-F / lot 5).
 *
 * Un seul guide, deux camps : chaque séquence peut déclarer `alignReq`
 * (`bontarien` | `brakmarien`). La route **filtre AVANT tout calcul** (vue, prérequis,
 * agrégation des ressources) : un prérequis masqué ne doit jamais bloquer une quête
 * visible — invariant n°1 du module.
 *
 * ⚠️ Le seuil legacy `alignOrderReq` (comparé à `alignmentLevel`) a été **retiré** le
 * 27/10/2026 (S5-1) : il valait `1` sur les 66 séquences qui le portaient, donc il ne
 * verrouillait rien. Le palier réel est `alignLevelReq` + `alignmentCountForCamp`.
 */

import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { normalizeOrderCode } from "@/lib/rush-order-codes";
import { z } from "zod";

export type RushAlignmentCamp = "bontarien" | "brakmarien";

export type RushRouteChoice = {
  /** Cité choisie par le joueur (profil, choix local, ou `null` s'il n'a rien choisi). */
  camp?: string | null;
  /** Code d'Ordre (6 valeurs). Ne filtre QUE les quêtes qui en portent un. */
  order?: string | null;
  /** Classe du personnage. Ne filtre QUE les quêtes de classe. */
  playerClass?: string | null;
  /** Palier d'alignement (calculé) — n'entre pas dans le filtre, il verrouille. */
  level?: number | null;
};

/** Référence d'un rang de la chaîne d'Ordre (même forme que `RushPrereqRef`). */
export type RushOrderRankRef = { seqId: string; milestoneId: string; name: string };

/** Normalise une valeur de camp (« bontarien », « Brâkmar », « BONTA »…). */
export function normalizeAlignmentCamp(value?: string | null): RushAlignmentCamp | null {
  const v = (value ?? "")
    .trim()
    .toLowerCase()
    // « Brâkmar » porte un accent : sans repli des diacritiques, il ne serait pas reconnu.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v.startsWith("bont")) return "bontarien";
  if (v.startsWith("brak")) return "brakmarien";
  return null;
}

/**
 * Cette séquence appartient-elle à la route choisie ?
 *
 * | Cas | Résultat |
 * |---|---|
 * | aucune `alignReq` | **visible** (quête commune) |
 * | `alignReq` inconnu (valeur non reconnue) | **masquée** — fail-closed |
 * | aucun choix du joueur | **visible** (on ne vide pas le guide par défaut) |
 * | camp identique au choix | **visible** |
 * | camp opposé | **masquée** |
 */
export function isSequenceOnRoute(
  seq: Pick<RushSequence, "alignReq" | "alignOrderCode" | "classReq">,
  choice?: RushRouteChoice | string | null
): boolean {
  const route: RushRouteChoice = typeof choice === "string" ? { camp: choice } : (choice ?? {});

  // Étage 1 — cité.
  const rawCamp = (seq.alignReq ?? "").trim();
  if (rawCamp) {
    const required = normalizeAlignmentCamp(rawCamp);
    if (!required) return false; // fail-closed : cité inconnue
    const chosen = normalizeAlignmentCamp(route.camp);
    if (chosen && required !== chosen) return false;
  }

  // Étage 2 — Ordre : ne concerne que les quêtes qui en portent un.
  const rawOrder = (seq.alignOrderCode ?? "").trim().toLowerCase();
  if (rawOrder) {
    const chosenOrder = (route.order ?? "").trim().toLowerCase();
    if (chosenOrder) {
      // Deux vocabulaires ont cohabité dans `alignOrderCode` : le code canonique
      // (`coeur_vaillant`) et l'id court du référentiel de guilde (`vaillant`). On
      // compare les codes **ramenés au canonique** ; une valeur inconnue garde la
      // comparaison brute (fail-closed, on ne rend rien visible par consolation).
      const required = normalizeOrderCode(rawOrder) ?? rawOrder;
      const chosen = normalizeOrderCode(chosenOrder) ?? chosenOrder;
      if (required !== chosen) return false;
    }
  }

  // Classe : idem, uniquement les quêtes de classe.
  const rawClass = (seq.classReq ?? "").trim().toLowerCase();
  if (rawClass) {
    const chosenClass = (route.playerClass ?? "").trim().toLowerCase();
    if (chosenClass && rawClass !== chosenClass) return false;
  }

  return true;
}

/**
 * Le tag `alignment_set` d'une quête (ce que la **coche du membre** écrit) peut-il
 * contredire la cité de sa **route** (ce qui la rend visible) ?
 *
 * Mesure du 12/11/2026 : le studio laissait poser `alignReq = bontarien` **et**
 * `alignment_set.camp = brakmarien` sur la même quête — un Bontarien qui la cochait
 * basculait côté Brâkmar, sans aucun signal. Les deux champs sont indépendants :
 * la route **filtre l'affichage**, le tag **écrit l'alignement** du membre.
 *
 * Fonction PURE. `false` dès que l'une des deux valeurs est absente ou inconnue :
 * on ne signale qu'une contradiction **certaine** (fail-open sur l'avertissement).
 */
export function alignmentSetContradictsCamp(
  routeCamp: string | null | undefined,
  alignmentCamp: string | null | undefined
): boolean {
  const route = normalizeAlignmentCamp(routeCamp);
  const written = normalizeAlignmentCamp(alignmentCamp);
  if (!route || !written) return false;
  return route !== written;
}

/**
 * **Chaîne des rangs d'un Ordre** (L2) — le rang N exige le rang N−1.
 *
 * Mesure du 02/11/2026 : les **30** quêtes d'Ordre (2 cités × 3 Ordres × 5) ne portent
 * **aucun** `prereq_text`. Sans cette règle, le rang 5 (« Héros Légendaire », palier 100)
 * se cochait sans avoir fait les rangs 1 → 4.
 *
 * Le lien est **calculé**, pas saisi : une quête d'Ordre est le rang immédiatement
 * inférieur de la **même cité** et du **même Ordre** (paliers 20/40/60/80/100). Écrire
 * 24 tags en base aurait dupliqué une règle de jeu dans une donnée non versionnée
 * (bêta et prod divergent déjà sur d'autres points).
 *
 * Fonction PURE : aucun accès base, aucune mutation.
 *
 * @returns le rang N−1, ou `null` pour le rang 1 (palier 20) / une valeur inconnue.
 */
export function previousOrderRank(
  seq: Pick<RushSequence, "id" | "alignReq" | "alignOrderCode" | "alignLevelReq" | "subGuideName">,
  allMilestones: RushMilestone[]
): RushOrderRankRef | null {
  const level = seq.alignLevelReq ?? 0;
  const wantedOrder = normalizeOrderCode(seq.alignOrderCode);
  if (!wantedOrder || level <= 0) return null;

  const wantedCamp = normalizeAlignmentCamp(seq.alignReq);
  let best: { level: number; ref: RushOrderRankRef } | null = null;

  for (const ms of allMilestones) {
    for (const other of ms.sequences || []) {
      if (other.id === seq.id) continue;
      const otherLevel = other.alignLevelReq ?? 0;
      if (otherLevel <= 0 || otherLevel >= level) continue;
      if (normalizeOrderCode(other.alignOrderCode) !== wantedOrder) continue;
      // Un Ordre n'appartient qu'à une cité : si le candidat déclare une cité, elle
      // doit être la même. Une quête sans cité n'est pas écartée (donnée incomplète).
      const otherCamp = normalizeAlignmentCamp(other.alignReq);
      if (wantedCamp && otherCamp && otherCamp !== wantedCamp) continue;
      if (!best || otherLevel > best.level) {
        best = {
          level: otherLevel,
          ref: { seqId: other.id, milestoneId: ms.id, name: other.subGuideName },
        };
      }
    }
  }

  return best?.ref ?? null;
}

// ─── Variantes de texte par camp (lot 4, 12/11/2026) ────────────────────────

const BoundedVariantText = z.string().max(4000);

/**
 * Forme **bornée** des variantes : deux camps, deux champs. Toute autre clé est ignorée
 * et toute valeur non textuelle est refusée (fail-closed : on garde le texte de base).
 */
export const rushRouteVariantsSchema = z.object({
  bontarien: z
    .object({ name: BoundedVariantText.max(200).optional(), tips: BoundedVariantText.optional() })
    .optional(),
  brakmarien: z
    .object({ name: BoundedVariantText.max(200).optional(), tips: BoundedVariantText.optional() })
    .optional(),
});

export type RushRouteVariants = z.infer<typeof rushRouteVariantsSchema>;

export function parseRouteVariants(raw: unknown): RushRouteVariants | null {
  const parsed = rushRouteVariantsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Variante du **camp du joueur** — `null` si elle manque ou si le camp est inconnu.
 * Un champ vide n'écrase jamais le texte de base.
 */
export function pickRouteVariant(
  raw: unknown,
  camp: string | null | undefined
): { name?: string; tips?: string } | null {
  const variants = parseRouteVariants(raw);
  const wanted = normalizeAlignmentCamp(camp);
  if (!variants || !wanted) return null;
  const variant = variants[wanted];
  if (!variant) return null;
  const name = (variant.name ?? "").trim();
  const tips = (variant.tips ?? "").trim();
  if (!name && !tips) return null;
  return { ...(name ? { name } : {}), ...(tips ? { tips } : {}) };
}

/**
 * Applique la variante du camp au texte de la séquence. **Point unique** : les trois
 * surfaces (guide membre, guide public, overlay) passent par `resolveRushRoute`, donc
 * elles affichent toutes le bon texte sans code dédié.
 */
export function applyRouteVariant(seq: RushSequence, camp: string | null | undefined): RushSequence {
  const variant = pickRouteVariant(seq.routeVariants, camp);
  if (!variant) return seq;
  return {
    ...seq,
    ...(variant.name ? { subGuideName: variant.name } : {}),
    ...(variant.tips ? { tips: variant.tips } : {}),
  };
}

/**
 * Applique la route : filtre les séquences, puis retire les blocs devenus vides.
 * Les bandeaux (`SEPARATEUR` / `INFO`) sont conservés : ce sont des repères de lecture.
 */
export function resolveRushRoute(
  milestones: RushMilestone[],
  choice?: RushRouteChoice | null
): RushMilestone[] {
  return milestones
    .map((ms) => ({
      ...ms,
      sequences: ms.sequences
        .filter((seq) => isSequenceOnRoute(seq, choice))
        // Le texte suit le camp du joueur (lot 4) : une seule quête, deux textes.
        .map((seq) => applyRouteVariant(seq, choice?.camp)),
    }))
    .filter(
      (ms) =>
        ms.type === "SEPARATEUR" ||
        ms.type === "INFO" ||
        ms.sequences.length > 0
    );
}

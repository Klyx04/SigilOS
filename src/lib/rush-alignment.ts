import type { RushMilestone } from "@/types/rush-guide-types";
import { getPrereqRefs } from "@/lib/rush-guide-utils";

/**
 * **Cascade de réinitialisation** d'un changement de cité.
 *
 * En jeu, refaire son alignement invalide aussi toutes les quêtes qui **dépendent**
 * d'une quête d'alignement (prérequis), puis celles qui dépendent de celles-ci, etc.
 * On calcule donc la **fermeture transitive** du graphe de prérequis à partir des
 * quêtes d'alignement.
 *
 * Fonction PURE (testée) : aucun accès base, aucune mutation.
 *
 * @param milestones le guide complet (les bandeaux sont ignorés par `getPrereqRefs`)
 * @param seedIds les quêtes d'alignement (`alignment_set`)
 * @returns l'ensemble des séquences à décocher (graines incluses)
 */
export function cascadeResetIds(
  milestones: RushMilestone[],
  seedIds: Iterable<string>
): Set<string> {
  const toReset = new Set(seedIds);
  if (toReset.size === 0) return toReset;

  // Fermeture transitive : tant qu'une séquence voit un prérequis réinitialisé,
  // elle est réinitialisée à son tour. Borné par le nombre de séquences (les cycles
  // sont absorbés par le `toReset.has`).
  let grew = true;
  while (grew) {
    grew = false;
    for (const ms of milestones) {
      for (const seq of ms.sequences || []) {
        if (toReset.has(seq.id)) continue;
        const refs = getPrereqRefs(seq, milestones);
        if (refs.some((ref) => toReset.has(ref.seqId))) {
          toReset.add(seq.id);
          grew = true;
        }
      }
    }
  }
  return toReset;
}

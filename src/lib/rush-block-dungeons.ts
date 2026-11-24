/**
 * **Plan de coche des donjons d'un bloc** — règle pure.
 *
 * Décision du 23/11/2026 : valider un bloc est un geste de confort ; il coche donc
 * les donjons **requis** de ses quêtes pour le personnage. On ne coche jamais :
 *  · un donjon **optionnel** (il ne bloque pas, il reste informatif) ;
 *  · **toutes** les alternatives d'un groupe « au choix » : une seule suffit
 *    (`resolveSequenceDungeons` porte déjà la règle), on préfère celle déjà cochée.
 *
 * Pur : aucun accès base. Le serveur écrit les lignes `PlayerGuideDungeonState`.
 */

import { resolveSequenceDungeons } from "./rush-dungeons";
import type { RushSequence } from "@/types/rush-guide-types";

/** Une séquence du bloc, avec sa forme « verrou » (`dungeons` + `activityTags`). */
export type RushBlockDungeonSequence = {
  id: string;
  sequence: RushSequence;
};

export type RushDungeonCheck = {
  sequenceId: string;
  dungeonKey: string;
};

export function planRequiredDungeonChecks(
  sequences: readonly RushBlockDungeonSequence[],
  doneKeys?: Iterable<string> | null
): RushDungeonCheck[] {
  const out: RushDungeonCheck[] = [];
  const seen = new Set<string>();

  for (const { id, sequence } of sequences) {
    const { requirements } = resolveSequenceDungeons(sequence, doneKeys);
    const choiceGroups = new Map<string, typeof requirements>();

    for (const requirement of requirements) {
      if (requirement.isOptional) continue;
      if (requirement.choiceGroup) {
        const list = choiceGroups.get(requirement.choiceGroup) ?? [];
        list.push(requirement);
        choiceGroups.set(requirement.choiceGroup, list);
        continue;
      }
      push({ sequenceId: id, dungeonKey: requirement.key });
    }

    for (const list of choiceGroups.values()) {
      // Une alternative déjà cochée reste la référence ; sinon la première du groupe.
      const pick = list.find((requirement) => requirement.isDone) ?? list[0];
      if (pick) push({ sequenceId: id, dungeonKey: pick.key });
    }
  }

  return out;

  function push(check: RushDungeonCheck) {
    const key = `${check.sequenceId}::${check.dungeonKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(check);
  }
}

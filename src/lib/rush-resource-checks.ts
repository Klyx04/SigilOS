/**
 * Coches de ressources du Rush — **règle pure** partagée par les trois surfaces
 * (overlay, guide interne, guide public).
 *
 * Une coche veut dire « j'ai déjà préparé cet objet ». La clé est celle de
 * `rushResourceKey` (`id:|nom normalisé`) — la même que l'agrégation
 * (`aggregateRushResources`) et la base (`PlayerGuideResourceCheck`).
 *
 * Règles :
 *  · valider une quête **coche** toutes ses ressources ;
 *  · invalider une quête **décoche** toutes ses ressources ;
 *  · on ne touche jamais aux clés des autres quêtes.
 */

import { rushResourceKey } from "@/lib/rush-guide-utils";

export type RushResourceTag = {
  type?: string | null;
  name?: string | null;
  id?: string | null;
  kind?: string | null;
};

/** Clés des ressources `item` d'une liste de tags — mêmes exclusions que l'agrégation. */
export function resourceKeysForTags(
  tags: ReadonlyArray<RushResourceTag> | null | undefined
): string[] {
  const keys = new Set<string>();
  for (const tag of tags ?? []) {
    if (tag?.type !== "item" || !tag.name) continue;
    // Phrase d'action, pas une ressource.
    if (tag.kind === "instruction") continue;
    // « … avec altération Idole de X » = donjon, pas un objet.
    if (tag.kind === "unresolved" && /avec altération/i.test(tag.name)) continue;
    keys.add(rushResourceKey(tag));
  }
  return [...keys];
}

/**
 * Applique la validation (`checked = true`) ou la dévalidation (`false`) d'une quête
 * à l'ensemble des coches. Ne mute jamais l'entrée.
 */
export function applyQuestResourceChecks(
  current: ReadonlySet<string>,
  tags: ReadonlyArray<RushResourceTag> | null | undefined,
  checked: boolean
): Set<string> {
  const next = new Set(current);
  for (const key of resourceKeysForTags(tags)) {
    if (checked) next.add(key);
    else next.delete(key);
  }
  return next;
}

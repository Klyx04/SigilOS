/**
 * Données **par quête** du split Rush (serveur uniquement).
 *
 * Le dataset enrichi (`src/data/rush-sylvestre-guide.enriched.json`) porte les noms, tags
 * d'activité, donjons et liens par `questDbId`. Il est **importé statiquement** pour être
 * présent dans le build standalone (le seed le lit via `fs`, ce qui ne survit pas au
 * conteneur). La table `RUSH_CLASS_QUESTS` fournit la classe des 19 quêtes de classe.
 */
import enriched from "@/data/rush-sylvestre-guide.enriched.json";
import { RUSH_CLASS_QUESTS } from "@/lib/rush-class-quests";
import type { RushSplitMeta } from "@/lib/rush-split";

type EnrichedQuest = {
    name?: string;
    questDbIds?: number[];
    activityTags?: unknown[];
    dungeonIds?: string[];
    mapPositions?: unknown[];
    dofusdbUrl?: string;
    dofuspourlesnoobsUrl?: string;
};

const ENRICHED_BY_QID = new Map<number, EnrichedQuest>();

for (const quest of ((enriched as { quests?: EnrichedQuest[] }).quests ?? [])) {
    for (const id of quest.questDbIds ?? []) {
        if (Number.isInteger(id) && id > 0 && !ENRICHED_BY_QID.has(id)) {
            ENRICHED_BY_QID.set(id, quest);
        }
    }
}

/**
 * Métadonnées d'une quête pour le split. `gameName` (catalogue `GameQuest`) prime sur le
 * nom du dataset ; la classe vient **toujours** de la table des 19, jamais du bloc.
 */
export function rushSplitMetaOf(questDbId: number, gameName?: string | null): RushSplitMeta {
    const quest = ENRICHED_BY_QID.get(questDbId);
    return {
        name: gameName ?? quest?.name ?? null,
        classReq: RUSH_CLASS_QUESTS[questDbId] ?? null,
        activityTags: Array.isArray(quest?.activityTags) ? quest.activityTags : [],
        dungeonIds: Array.isArray(quest?.dungeonIds) ? quest.dungeonIds : [],
        mapPositions: Array.isArray(quest?.mapPositions) ? quest.mapPositions : [],
        dofusdbUrl: quest?.dofusdbUrl ?? null,
        dofuspourlesnoobsUrl: quest?.dofuspourlesnoobsUrl ?? null,
    };
}

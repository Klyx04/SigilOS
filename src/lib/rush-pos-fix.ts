/**
 * Réparation des `pos_tags` Rush — **règle pure**.
 *
 * Mesure du 22/11/2026 (Blessures de Guerre, monde 24) : la quête « Le jour le
 * plus long » pointe sur `[0,0]` avec `worldId: 1`, alors que sa carte réelle
 * (`GameQuest.imageUrl` = `201588736`) est dans le monde 24. L'audit le voit ;
 * cette règle calcule la correction **sans écrire**.
 *
 * Deux niveaux :
 *  - la carte est dans `worldmap.json` et son monde est déclaré → on corrige
 *    `worldId` **et** `mapId` ;
 *  - la carte n'est pas dans `worldmap.json` (donjon, Mappemondes…) mais son
 *    image HD existe → on pose seulement `mapId` (la route `map-at` la sert en
 *    carte imposée), sans inventer de monde.
 */
import { questMapIdFromImageUrl } from "@/lib/quest-minimap";

export type RushPosTag = {
  type?: string;
  name?: string;
  worldId?: number;
  mapId?: number;
  allowZaap?: boolean;
  zaapX?: number;
  zaapY?: number;
  [key: string]: unknown;
};

export type RushPosFixPlan =
  | {
      status: "fix";
      worldId: number;
      mapId: number;
      questId: number;
      mapWorld: number;
      reason: string;
    }
  | {
      status: "fix-map";
      mapId: number;
      questId: number;
      mapWorld: null;
      reason: string;
    }
  | {
      status: "already";
      worldId: number;
      mapId: number;
      questId: number;
      mapWorld: number;
      reason: string;
    }
  | { status: "already-map"; mapId: number; questId: number; reason: string }
  | { status: "none"; reason: string }
  | { status: "ambiguous"; reason: string };

export function planRushPosFix({
  tag,
  questIds,
  imagesByQuest,
  mapById,
  worldIds,
  hdMapIds,
  trustHd = false,
}: {
  tag: RushPosTag;
  questIds: readonly number[];
  imagesByQuest: ReadonlyMap<number, string | null | undefined>;
  mapById: ReadonlyMap<number, { id: number; worldMap: number }>;
  worldIds: ReadonlySet<number>;
  hdMapIds: ReadonlySet<number>;
  /**
   * Le conteneur d'ops ne monte pas toujours `public/game-data/hd_maps`
   * (`.dockerignore`) alors que l'app sert ces cartes depuis le volume hôte.
   * `trustHd` accepte la carte de `GameQuest.imageUrl` sans vérifier le fichier.
   */
  trustHd?: boolean;
}): RushPosFixPlan {
  const candidates = new Map<
    number,
    { questId: number; mapId: number; mapWorld: number | null }
  >();

  for (const questId of questIds) {
    const mapId = questMapIdFromImageUrl(imagesByQuest.get(Number(questId)));
    if (!mapId) continue;
    const map = mapById.get(mapId);
    // Une carte absente de worldmap.json n'est corrigeable que si son HD existe
    // (carte imposée) : on ne devine jamais le monde. En ops, `trustHd` remplace
    // le test de fichier par la confiance dans le volume game-data de l'hôte.
    if (!map && !trustHd && !hdMapIds.has(mapId)) continue;
    const mapWorld =
      map &&
      Number.isSafeInteger(Number(map.worldMap)) &&
      Number(map.worldMap) > 0 &&
      worldIds.has(Number(map.worldMap))
        ? Number(map.worldMap)
        : null;
    candidates.set(mapId, { questId: Number(questId), mapId, mapWorld });
  }

  if (candidates.size === 0) {
    return { status: "none", reason: "aucune carte de quête résolue" };
  }
  if (candidates.size > 1) {
    return { status: "ambiguous", reason: "plusieurs cartes de quête différentes" };
  }

  const candidate = [...candidates.values()][0];
  const tagWorld = Number(tag.worldId);
  const tagMap =
    tag.mapId === undefined || tag.mapId === null ? null : Number(tag.mapId);

  if (candidate.mapWorld !== null) {
    const worldId = candidate.mapWorld;
    if (tagWorld === worldId && tagMap === candidate.mapId) {
      return {
        status: "already",
        worldId,
        mapId: candidate.mapId,
        questId: candidate.questId,
        mapWorld: worldId,
        reason: "déjà aligné",
      };
    }
    return {
      status: "fix",
      worldId,
      mapId: candidate.mapId,
      questId: candidate.questId,
      mapWorld: worldId,
      reason:
        `monde ${tag.worldId ?? "?"} → ${worldId}, ` +
        `carte ${tag.mapId ?? "absente"} → ${candidate.mapId}`,
    };
  }

  if (tagMap === candidate.mapId) {
    return {
      status: "already-map",
      mapId: candidate.mapId,
      questId: candidate.questId,
      reason: "carte déjà posée",
    };
  }
  return {
    status: "fix-map",
    mapId: candidate.mapId,
    questId: candidate.questId,
    mapWorld: null,
    reason: `carte ${tag.mapId ?? "absente"} → ${candidate.mapId} (monde inconnu, carte imposée)`,
  };
}

/**
 * Intégration **ciblée** d'un monde / sous-monde DofusDB dans la worldmap.
 *
 * Pourquoi une règle pure : le sync complet (`sync-worldmap*.ts`) réécrit tout le
 * fichier et **ressuscite** les mondes exclus 19 (« Mappemondes ») et 29
 * (« Ecaflip City »). Ici, on **ajoute** un monde, ses cartes et ses sous-zones,
 * sans jamais retirer ni écraser l'existant.
 *
 * Cas mesuré (22/11/2026) : DofusDB a créé le **monde 41 « Temple Céleste »** le
 * 23/06/2026 (3 cartes : 241443329, 241444353, 241445377). Notre `worldmap.json`
 * datait du 16/04/2026 : le sous-monde n'y était pas, et la première quête du Rush
 * (`[1,1]`, `worldId: 1`) pointait vers le mauvais monde.
 */

/** Mondes retirés définitivement : une intégration ne doit jamais les ramener. */
export const EXCLUDED_WORLD_IDS = [19, 29] as const;

export type WorldRecord = {
  id: number;
  name?: { fr?: string } & Record<string, unknown>;
  [key: string]: unknown;
};

export type WorldmapMap = {
  id: number;
  x: number;
  y: number;
  subAreaId?: number | null;
  worldMap: number;
  outdoor?: boolean;
};

export type WorldmapSubarea = {
  id: number;
  name: string;
  areaId?: number | null;
  level?: number | null;
  shape?: unknown;
};

export type WorldmapFile = {
  subareas: WorldmapSubarea[];
  maps: WorldmapMap[];
  [key: string]: unknown;
};

/** Forme brute de `GET /map-positions?worldMap=<id>`. */
export type DofusDbMapPosition = {
  id: number;
  posX: number;
  posY: number;
  subAreaId?: number | null;
  worldMap: number;
  outdoor?: boolean;
};

/** Forme brute de `GET /subareas/<id>`. */
export type DofusDbSubarea = {
  id: number;
  name?: { fr?: string };
  areaId?: number | null;
  level?: number | null;
  shape?: unknown;
};

export type SubworldMergeReport = {
  worldId: number;
  worldName: string;
  worldAdded: boolean;
  mapsAdded: number;
  mapsAlreadyPresent: number;
  subareasAdded: number;
  /** Cartes déjà présentes avec un autre monde/sous-zone : jamais écrasées. */
  conflicts: string[];
};

/** Monde interdit (19/29) : le script s'arrête avant toute écriture. */
export class ExcludedWorldError extends Error {
  constructor(public readonly worldId: number) {
    super(`Monde ${worldId} exclu (19/29) : ne jamais le réintégrer.`);
    this.name = "ExcludedWorldError";
  }
}

/**
 * Ajoute un monde + ses cartes + ses sous-zones **manquantes**.
 *
 * Garanties :
 *  - un monde déjà déclaré n'est **jamais** réécrit (le `worlds.json` porte des
 *    ajustements manuels, ex. la hauteur du monde 1) ;
 *  - une carte déjà présente n'est jamais écrasée : si son `worldMap`/`subAreaId`
 *    diffère, elle part en **conflit** et reste intacte ;
 *  - une sous-zone déjà présente n'est jamais réécrite (nom/shape manuels) ;
 *  - rien n'est supprimé : le résultat est un sur-ensemble de l'entrée.
 */
export function mergeSubworldData({
  worlds,
  worldmap,
  world,
  maps,
  subareas,
}: {
  worlds: WorldRecord[];
  worldmap: WorldmapFile;
  world: WorldRecord;
  maps: DofusDbMapPosition[];
  subareas: DofusDbSubarea[];
}): {
  worlds: WorldRecord[];
  worldmap: WorldmapFile;
  report: SubworldMergeReport;
} {
  const worldId = Number(world?.id);
  if (!Number.isSafeInteger(worldId) || worldId <= 0) {
    throw new Error("Monde invalide : id entier positif attendu.");
  }
  if ((EXCLUDED_WORLD_IDS as readonly number[]).includes(worldId)) {
    throw new ExcludedWorldError(worldId);
  }
  if (!Array.isArray(worlds) || !Array.isArray(worldmap?.maps) || !Array.isArray(worldmap?.subareas)) {
    throw new Error("worlds.json / worldmap.json : forme inattendue.");
  }

  const worldName = world.name?.fr?.trim() || `Monde ${worldId}`;
  const worldAdded = !worlds.some((candidate) => Number(candidate.id) === worldId);
  // Un monde existant garde son objet (dimensions/noms ajustés à la main).
  const nextWorlds = worldAdded
    ? [...worlds, world].sort((a, b) => Number(a.id) - Number(b.id))
    : worlds;

  const mapsById = new Map(worldmap.maps.map((map) => [Number(map.id), map]));
  const nextMaps = [...worldmap.maps];
  const conflicts: string[] = [];
  let mapsAdded = 0;
  let mapsAlreadyPresent = 0;

  for (const position of maps) {
    const mapId = Number(position?.id);
    if (!Number.isSafeInteger(mapId) || mapId <= 0) {
      conflicts.push(`carte invalide : ${String(position?.id)}`);
      continue;
    }
    if (Number(position.worldMap) !== worldId) {
      conflicts.push(
        `carte ${mapId} : worldMap ${String(position.worldMap)} ≠ monde demandé ${worldId}`
      );
      continue;
    }

    const existing = mapsById.get(mapId);
    if (existing) {
      const sameWorld = Number(existing.worldMap) === worldId;
      const sameSubarea = Number(existing.subAreaId ?? 0) === Number(position.subAreaId ?? 0);
      if (sameWorld && sameSubarea) {
        mapsAlreadyPresent++;
      } else {
        conflicts.push(
          `carte ${mapId} : déjà ${String(existing.worldMap)}/${String(existing.subAreaId ?? "?")}, ` +
            `DofusDB ${worldId}/${String(position.subAreaId ?? "?")} — conservée telle quelle`
        );
      }
      continue;
    }

    const x = Number(position.posX);
    const y = Number(position.posY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      conflicts.push(
        `carte ${mapId} : coordonnées invalides (${String(position.posX)}, ${String(position.posY)})`
      );
      continue;
    }

    const map: WorldmapMap = {
      id: mapId,
      x,
      y,
      subAreaId: position.subAreaId ?? null,
      worldMap: worldId,
      outdoor: Boolean(position.outdoor),
    };
    nextMaps.push(map);
    mapsById.set(mapId, map);
    mapsAdded++;
  }

  const subareaIds = new Set(worldmap.subareas.map((subarea) => Number(subarea.id)));
  const nextSubareas = [...worldmap.subareas];
  let subareasAdded = 0;
  for (const subarea of subareas) {
    const subareaId = Number(subarea?.id);
    if (!Number.isSafeInteger(subareaId) || subareaId <= 0 || subareaIds.has(subareaId)) continue;
    nextSubareas.push({
      id: subareaId,
      name: subarea.name?.fr?.trim() || `Zone ${subareaId}`,
      areaId: subarea.areaId ?? null,
      level: subarea.level ?? null,
      ...(subarea.shape !== undefined ? { shape: subarea.shape } : {}),
    });
    subareaIds.add(subareaId);
    subareasAdded++;
  }

  return {
    worlds: nextWorlds,
    worldmap: { ...worldmap, subareas: nextSubareas, maps: nextMaps },
    report: {
      worldId,
      worldName,
      worldAdded,
      mapsAdded,
      mapsAlreadyPresent,
      subareasAdded,
      conflicts,
    },
  };
}

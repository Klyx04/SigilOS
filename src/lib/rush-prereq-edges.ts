/**
 * Arêtes de prérequis **mesquées le 23/11/2026** pour le guide Rush Sylvestre.
 *
 * Source unique du script `scripts/fix-rush-prerequisites.ts` et du test de
 * garde : 9 arêtes lues dans le client (`quest-prerequisites.json`) + 28 lues
 * via l'API DofusDB sur les quêtes hors catalogue client. Toutes les cibles
 * sont dans le guide.
 *
 * `626 Le pic qui glace` est la seule quête **absente** du guide encore requise
 * par deux quêtes présentes (2014, 1910).
 */

export type RushPrereqEdgeSource = "client" | "dofusdb";

export type RushPrereqEdge = {
  /** `dofusDbId` de la quête dépendante (celle qui porte le tag). */
  questId: number;
  /** `dofusDbId` du prérequis (cible du tag). */
  prereqId: number;
  source: RushPrereqEdgeSource;
};

export const RUSH_PREREQ_EDGES: readonly RushPrereqEdge[] = [
  { questId: 1527, prereqId: 1523, source: "client" },
  { questId: 2442, prereqId: 439, source: "client" },
  { questId: 1665, prereqId: 1656, source: "client" },
  { questId: 2481, prereqId: 2477, source: "client" },
  { questId: 582, prereqId: 581, source: "client" },
  { questId: 2488, prereqId: 2487, source: "client" },
  { questId: 2488, prereqId: 2423, source: "client" },
  { questId: 2489, prereqId: 2488, source: "client" },
  { questId: 2420, prereqId: 2422, source: "client" },
  { questId: 1524, prereqId: 1523, source: "dofusdb" },
  { questId: 1525, prereqId: 1523, source: "dofusdb" },
  { questId: 1526, prereqId: 1523, source: "dofusdb" },
  { questId: 1610, prereqId: 1609, source: "dofusdb" },
  { questId: 1611, prereqId: 1609, source: "dofusdb" },
  { questId: 1612, prereqId: 1609, source: "dofusdb" },
  { questId: 1660, prereqId: 1657, source: "dofusdb" },
  { questId: 1661, prereqId: 1658, source: "dofusdb" },
  { questId: 1662, prereqId: 1659, source: "dofusdb" },
  { questId: 1911, prereqId: 1909, source: "dofusdb" },
  { questId: 1912, prereqId: 1909, source: "dofusdb" },
  { questId: 1913, prereqId: 1909, source: "dofusdb" },
  { questId: 1914, prereqId: 1909, source: "dofusdb" },
  { questId: 2012, prereqId: 2011, source: "dofusdb" },
  { questId: 2013, prereqId: 2011, source: "dofusdb" },
  { questId: 2019, prereqId: 2011, source: "dofusdb" },
  { questId: 2111, prereqId: 2122, source: "dofusdb" },
  { questId: 2112, prereqId: 2122, source: "dofusdb" },
  { questId: 2117, prereqId: 2122, source: "dofusdb" },
  { questId: 2130, prereqId: 2122, source: "dofusdb" },
  { questId: 2136, prereqId: 2138, source: "dofusdb" },
  { questId: 2137, prereqId: 2138, source: "dofusdb" },
  { questId: 2160, prereqId: 2406, source: "dofusdb" },
  { questId: 2198, prereqId: 2180, source: "dofusdb" },
  { questId: 2201, prereqId: 2200, source: "dofusdb" },
  { questId: 2407, prereqId: 2406, source: "dofusdb" },
  { questId: 2408, prereqId: 2406, source: "dofusdb" },
  { questId: 2425, prereqId: 2423, source: "dofusdb" },
];

export const RUSH_MISSING_QUEST_626 = {
  id: 626,
  name: "Le pic qui glace",
  anchorId: 2014,
  dependents: [2014, 1910] as const,
  dofusdbUrl: "https://dofusdb.fr/fr/database/quest/626",
} as const;

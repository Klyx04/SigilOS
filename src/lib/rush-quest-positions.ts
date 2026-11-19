/**
 * Position de lancement d'une quête du guide Rush — **fait de jeu**, jamais un
 * texte de guide : `{ x, y, zone }`. La carte est produite par
 * `scripts/siphon-rush-quest-positions.ts` (DPLN, lecture seule) et consommée par
 * le seed pour poser un tag `pos_tags` lu par `getSequenceCoord`.
 */
export type RushQuestPosition = {
    x: number;
    y: number;
    /** Zone DPLN (« Les Champs de Cania »), informative. */
    zone?: string;
    /** URL source, pour re-vérifier une mesure. */
    url?: string;
    /** Ligne « Position de lancement » du haut (`top`), premier chip du corps (`body`) ou fiche Dofus (`guide`). */
    source?: "top" | "body" | "guide";
    /** Détour zaap proposé ; le zaap le plus proche est résolu par l'interface. */
    allowZaap?: boolean;
    /** Monde Dofus (1 = monde classique). */
    worldId?: number;
    /** Zaap manuel saisi en God, prioritaire sur l'auto le plus proche. */
    zaapX?: number;
    zaapY?: number;
};

export type RushQuestPositionMap = Readonly<Record<string, RushQuestPosition>>;

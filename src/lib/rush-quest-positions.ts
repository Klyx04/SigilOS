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
};

export type RushQuestPositionMap = Readonly<Record<string, RushQuestPosition>>;

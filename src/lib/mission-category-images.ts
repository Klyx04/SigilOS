/**
 * Missions — **référentiel d'images par catégorie** (source unique, pure).
 *
 * Pourquoi ce fichier existe (mesure du 15/10/2026) : le même tableau existait **deux fois**
 * dans les composants (`calendar/mission-picker.tsx:16` et `calendar/event-detail-modal.tsx:120`),
 * chacun avec son propre `fallbackImage` par catégorie. Un troisième exemplaire allait naître
 * avec l'icône des notifications — on l'extrait ici, et les deux écrans le consomment désormais.
 *
 * Les chemins sont des **assets locaux du jeu** (aucune URL distante, aucune image inventée) :
 * ils passent tels quels le garde `sanitizeNotificationImageUrl` quand ils partent dans une
 * notification.
 *
 * Importable côté client **comme** côté serveur : `import type` seul, aucun accès base.
 */

import type { MissionCategory } from "@prisma/client";

/** Image d'une catégorie de mission (le picto « repli » quand aucun visuel précis n'existe). */
export const MISSION_CATEGORY_IMAGES: Record<MissionCategory, string> = {
    DONJON: "/banners/donjon.png",
    REGULATION: "/banners/regulation.png",
    ANOMALIE: "/assets/missions/ano1.png",
    SONGES: "/assets/missions/songes.png",
    EXPEDITION: "/banners/expedition.png",
    EVENT: "/assets/missions/event.png",
};

/**
 * Image d'une catégorie, robuste à une valeur inconnue : `null` plutôt qu'un chemin inventé
 * (fail-closed — une catégorie ajoutée demain ne doit pas produire une image cassée).
 */
export function missionCategoryImage(category: unknown): string | null {
    if (typeof category !== "string") return null;
    return MISSION_CATEGORY_IMAGES[category as MissionCategory] ?? null;
}

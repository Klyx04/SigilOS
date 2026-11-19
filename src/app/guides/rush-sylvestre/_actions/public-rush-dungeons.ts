"use server";

/**
 * Guide public du Rush — **couture serveur** du Bloc J (« Progression Donjons »).
 *
 * Même raison que `public-dungeon-achievements.ts` : le composant client du guide
 * public n'importe **aucun** code `@/server/` (verrou `rush-public-parity`). Ce
 * fichier ne fait que réexporter l'action d'agrégat, qui garde la session, le
 * consentement (`showRushProgress`) et le serveur du lecteur.
 */

import { getPublicRushDungeonsCommunity } from "@/server/actions/rush-dungeons-overview-actions";

/** Agrégat des visiteurs consentants du serveur du lecteur (lecture seule). */
export async function getMyRushDungeonsCommunity(characterSlot?: string) {
    return getPublicRushDungeonsCommunity(characterSlot);
}

"use server";

/**
 * Guide public du Rush — **Progression Communautaire** (V2a-2), action colocalisée.
 *
 * Même raison d'être que `rush-progress.ts` : le composant client du guide public n'importe
 * aucun code `@/server/` (verrou `tests/unit/rush-public-parity.test.ts`). L'implémentation —
 * garde `getPublicAccount()`, serveur imposé, consentement `showRushProgress` — vit dans
 * `src/server/rush-community.ts` ; ce fichier n'est que la couture.
 */

import { loadPublicCommunity, type CommunityResult } from "@/server/rush-community";

export async function loadCommunityProgress(): Promise<CommunityResult> {
    return loadPublicCommunity();
}
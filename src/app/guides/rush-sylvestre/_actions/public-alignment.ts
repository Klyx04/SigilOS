"use server";

/**
 * Guide public du Rush — **alignement du visiteur** (V2a-4), colocalisé avec la route.
 *
 * Même raison d'être que `rush-progress.ts` : le client du guide public **n'importe aucun
 * code `@/server/`** (verrou `tests/unit/rush-public-parity.test.ts`). L'implémentation
 * — garde `getPublicAccount()`, Zod borné, rate limit Redis, contrôle d'appartenance de
 * l'Ordre — reste dans `src/server/actions/public-profile-actions.ts` ; ce fichier n'est
 * que la couture qui permet au client de l'appeler.
 */

import { updatePublicAlignment } from "@/server/actions/public-profile-actions";

/** Cité + Ordre de l'utilisateur **connecté** (jamais un autre profil : pas d'id en entrée). */
export async function updateMyAlignment(
    raw: unknown
): Promise<{ success: true } | { success: false; error: string }> {
    return updatePublicAlignment(raw);
}
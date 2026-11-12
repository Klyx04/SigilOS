"use server";

/**
 * Guide public du Rush — **consentement de présence** (V2c), colocalisé avec la route.
 *
 * Même couture que `rush-progress.ts` : le composant client du guide public n'importe
 * **aucun** code `@/server/` (verrou `rush-public-parity`). L'implémentation, la garde, le
 * Zod et le rate limit restent dans `src/server/actions/public-profile-actions.ts`.
 */

import { updatePublicPresence } from "@/server/actions/public-profile-actions";

/** Active / coupe « être vu en ligne » — le consentement ne touche à rien d'autre. */
export async function setMyPresence(
    enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
    return updatePublicPresence({ enabled });
}

/**
 * Verrou plateforme des modules (`PlatformConfig.disabledModules` /
 * `moduleNotices`) — **core serveur**, PAS une server action.
 *
 * Aucun `"use server"` ici, délibérément : ce core ne décide de rien et ne
 * s'expose pas au client. Chaque appelant garde ses droits (`isSuperAdmin()` à
 * l'écriture d'un verrou plateforme, `getUserContext`/`internalCheckPermission`
 * à la lecture côté guilde et côté bot).
 *
 * **Lecture tolérante** : les colonnes `disabledModules` / `moduleNotices`
 * arrivent avec la migration additive du lot 2. Un `select` sur un champ encore
 * inexistant ferait échouer la requête ⇒ on lit la ligne et on accède aux champs
 * par cast (`undefined` ⇒ état vide ⇒ **aucun verrou**).
 *
 * Cache mémoire 30 s, aligné sur `moduleCache` : une écriture God invalide
 * explicitement (`invalidatePlatformModuleStateCache`) ; en cas d'échec de
 * lecture on ne met **pas** l'échec en cache (la prochaine lecture retente) et on
 * conserve la dernière valeur connue plutôt que de tout couper.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizePlatformLocks, normalizePlatformNotices } from "@/lib/module-lock";
import type { ModuleKey } from "@/lib/module-types";

export interface PlatformModuleState {
    /** Modules coupés par le God pour TOUTES les guildes. */
    locks: ModuleKey[];
    /** Message de maintenance libre par module (verrou plateforme uniquement). */
    notices: Partial<Record<ModuleKey, string>>;
}

const PLATFORM_MODULE_CACHE_TTL = 30_000;
const EMPTY: PlatformModuleState = { locks: [], notices: {} };

let cached: { data: PlatformModuleState; expiresAt: number } | null = null;

/** À appeler après toute écriture God des colonnes `PlatformConfig` concernées. */
export function invalidatePlatformModuleStateCache(): void {
    cached = null;
}

/** Verrou plateforme courant (jamais bloquant : toute erreur ⇒ état vide). */
export async function getPlatformModuleState(): Promise<PlatformModuleState> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.data;

    try {
        const row = await db.platformConfig.findUnique({ where: { id: "singleton" } }) as unknown as {
            disabledModules?: unknown;
            moduleNotices?: unknown;
        } | null;

        const data: PlatformModuleState = {
            locks: normalizePlatformLocks(row?.disabledModules),
            notices: normalizePlatformNotices(row?.moduleNotices),
        };
        cached = { data, expiresAt: now + PLATFORM_MODULE_CACHE_TTL };
        return data;
    } catch (error) {
        logger.warn("[platform-module-state] lecture impossible — dernier état connu conservé", error);
        return cached?.data ?? EMPTY;
    }
}

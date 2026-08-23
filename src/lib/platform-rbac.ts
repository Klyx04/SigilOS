/**
 * Kill-switch plateforme : permissions RBAC individuelles (« Membres Spécifiques »).
 *
 * Chantier #72 — toggle God (PlatformConfig.rbacUsersMappingEnabled).
 * Fail-closed :
 *  - OFF → `getUserContext` ignore totalement `usersMapping` (aucune permission
 *    individuelle ne s'applique) et `updateRBACMapping` rejette toute écriture.
 *  - Si la lecture de la config échoue → retourne `false` (fonctionnalité désactivée),
 *    jamais `true` : une panne ne peut PAS réactiver une permission individuelle.
 *
 * Cache mémoire court (30s) pour éviter une requête DB à chaque `getUserContext`.
 */
import { db } from "@/lib/prisma";

const TTL_MS = 30_000;

let cached: { enabled: boolean; expiresAt: number } | null = null;

export async function getRbacUsersMappingEnabled(): Promise<boolean> {
    if (cached && cached.expiresAt > Date.now()) return cached.enabled;
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { rbacUsersMappingEnabled: true },
        });
        const enabled = config?.rbacUsersMappingEnabled ?? true;
        cached = { enabled, expiresAt: Date.now() + TTL_MS };
        return enabled;
    } catch (e) {
        // Fail-closed : on ne peut pas vérifier l'état → on désactive la fonctionnalité.
        cached = { enabled: false, expiresAt: Date.now() + TTL_MS };
        return false;
    }
}

/** Invalide le cache (appelé après un toggle God, et dans les tests). */
export function invalidateRbacUsersMappingCache(): void {
    cached = null;
}

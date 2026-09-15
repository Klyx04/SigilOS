"use server";

/**
 * Actions God « boss d'anomalie » — DÉCLENCHEMENT du siphon hors cron.
 *
 * Règle de la maison : le contenu n'est jamais saisi à la main ; le siphon est idempotent
 * et borné (concurrence 4, user-agent SigilOS). La passe nocturne (`sync-monster-stats`)
 * fait déjà le travail : ce bouton sert au contenu neuf (ex. un gardien ajouté par Ankama).
 */
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";
import { syncAnomalyBosses, type AnomalyBossSyncResult } from "@/lib/anomaly-boss-siphon";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/** 🛡️ Fail-closed : super-admin OU sous-god porteur de la brique « game-data ». */
async function requireGod(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    if (await isSuperAdmin()) return session.user.id;
    const ok = await canAccessBrick("game-data");
    return ok ? session.user.id : null;
}

/** Trace une écriture God pour un sous-god uniquement (pas de bruit pour le super-admin). */
async function logAnomalyWrite(op: string, metadata?: Record<string, unknown>) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;
        if (await isSuperAdmin()) return;
        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            targetId: "anomaly-bosses",
            metadata: { op, ...metadata },
        });
    } catch {
        // Non bloquant
    }
}

/**
 * Siphonne immédiatement tous les gardiens d'anomalie (liste DofusDB race 191 + cartes/familles
 * Dofensive + sorts + icônes) et persiste `Dungeon` / `MonsterStat` / `DofensiveMap`.
 */
export async function siphonAnomalyBossesNow(): Promise<ActionResponse<AnomalyBossSyncResult>> {
    const userId = await requireGod();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const result = await syncAnomalyBosses();
        await logAnomalyWrite("siphon-anomaly-bosses", {
            guardians: result.guardians.length,
            synced: result.synced,
            errors: result.errors.length,
        });
        revalidatePath("/god?tab=game-data");
        revalidatePath("/boss");
        revalidatePath("/dashboard/[guildId]/succes");
        return { success: true, data: result };
    } catch (error) {
        logger.error("[siphonAnomalyBossesNow] Error:", error);
        return { success: false, error: "Erreur lors du siphon des boss d'anomalie" };
    }
}

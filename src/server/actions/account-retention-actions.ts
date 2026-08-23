"use server";

import { logger } from "@/lib/logger";
import { isSuperAdmin } from "./super-admin-actions";
import { purgeOrphanAccountsCore } from "../account-retention-core";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * ♻️ #168 — Purge / rétention des comptes orphelins (RGPD).
 *
 * 🔒 SÉCURITÉ : cette server action exige TOUJOURS `isSuperAdmin()` — aucun paramètre
 * ne permet de contourner (le flag `allowCron` a été supprimé : il était contrôlable
 * par le client = bypass d'autorisation pour un utilisateur connecté non-God).
 * Le chemin CRON passe par `purgeOrphanAccountsCore` (module interne non exposé),
 * appelé directement par la route `/api/cron/account-retention` après `verifyCronSecret`.
 */
export async function purgeOrphanAccounts(opts?: {
    retentionDays?: number;
    max?: number;
}): Promise<ActionResponse<{ deleted: number; scanned: number; skipped: number }>> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const result = await purgeOrphanAccountsCore({ ...opts, source: "GOD" });
        return { success: true, data: result };
    } catch (error: any) {
        logger.error("[AccountRetention] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la purge des comptes orphelins" };
    }
}


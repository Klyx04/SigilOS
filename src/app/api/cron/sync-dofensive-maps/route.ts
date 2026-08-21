import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createSystemAuditLog, syncDofensiveMaps } from "@/lib/dofensive-sync";

/**
 * 🗺️ CRON quotidien : synchronisation locale des maps et donjons Dofensive.
 * Siphonne et met à jour les données dans PostgreSQL pour permettre un fonctionnement
 * local-first sans requêter Dofensive en direct.
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (x-cron-secret / Authorization Bearer).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await syncDofensiveMaps();
        logger.info("[Cron:SyncDofensiveMaps] Synchronisation terminée:", result);

        // Visibilité dans le Dashboard GOD (Audit Logs) — sans session utilisateur.
        await createSystemAuditLog({
            cron: "sync-dofensive-maps",
            targetId: "sync-dofensive-maps",
            synced: result.synced,
            unchanged: result.unchanged,
            skippedFresh: result.skippedFresh,
            errorsCount: result.errors.length,
            errors: result.errors.slice(0, 5),
        });

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        logger.error("[Cron:SyncDofensiveMaps] Erreur:", { error: String(error) });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

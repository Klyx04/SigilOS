import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 🔒 CRON : rôles automatiques par ancienneté (chantier Y, lot Y-2).
 *
 * Déclenché **une fois par jour** par le crontab du VPS (`30 4 * * *`). Le travail réel vit
 * dans `src/server/seniority-roles-core.ts` — ce n'est pas un détail : une passe est une
 * **réconciliation d'état** (les rôles réellement portés sont comparés à ceux que les
 * paliers imposent), donc elle est **idempotente** et **rattrapable** — une passe manquée
 * n'est jamais perdue, la suivante applique le même diff. Les échecs Discord, eux, ne sont
 * jamais rattrapés par un envoi d'embed : on retente au passage suivant, en silence.
 *
 * Protection : `verifyCronSecret(req)` (fail-closed, en-tête `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const { syncSeniorityRolesCore } = await import("@/server/seniority-roles-core");
        const result = await syncSeniorityRolesCore();
        const durationMs = Date.now() - startedAt;

        const summary =
            `${result.guildsProcessed} guilde(s) traitée(s) · ${result.rolesAdded} rôle(s) posé(s) · ` +
            `${result.rolesRemoved} retiré(s) · ${result.announcementsSent} annonce(s) · ` +
            `${result.retroactiveTiersMuted} palier(s) de rattrapage passé(s) sous silence`;

        if (result.errors.length === 0) {
            logger.info("[CRON SeniorityRoles] Passe terminée", { durationMs, ...result });
        } else {
            logger.warn("[CRON SeniorityRoles] Passe terminée avec erreurs", { durationMs, ...result });
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("seniority_roles", {
            success: result.errors.length === 0,
            durationMs,
            summary,
            details: result.details,
        });

        return NextResponse.json({ success: true, durationMs, ...result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur interne";
        logger.error("[CRON SeniorityRoles] Exception:", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("seniority_roles", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur : ${message}`,
        });

        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function HEAD(req: NextRequest) {
    return GET(req);
}
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { purgeDueGuilds } from "@/server/guild-purge-core";
import { recordCronExecution } from "@/lib/cron-telemetry";

/**
 * 🗑️ CRON quotidien : **purge réelle** des guildes arrivées à échéance.
 *
 * Jusqu'au 01/11/2026, `GuildConfig.scheduledDeletion` était écrit mais **lu par personne** : on
 * promettait une suppression définitive qui n'arrivait jamais. Cette passe la tient — et **seulement**
 * pour les guildes désactivées dont l'échéance est atteinte (`deletedAt` non nul + date passée) :
 * jamais une guilde active, jamais une échéance future.
 *
 * Bornée (20 par passe, du plus ancien au plus récent) : un arriéré se résorbe sur plusieurs jours
 * plutôt que de tenir la requête ouverte.
 *
 * 🔒 Sécurité : `verifyCronSecret` (x-cron-secret / Bearer), fail-closed.
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const result = await purgeDueGuilds({ limit: 20 });
        const durationMs = Date.now() - startedAt;

        await recordCronExecution("guild_purge", {
            success: true,
            durationMs,
            summary: `${result.purged.length} guilde(s) purgée(s) sur ${result.scanned} échue(s)`,
            details: {
                purgedGuildIds: result.purged.map((guild) => guild.guildId),
                skipped: result.skipped,
            },
        });

        logger.info("[Cron:GuildPurge] passe terminée", {
            purged: result.purged.length,
            skipped: result.skipped,
            scanned: result.scanned,
        });

        return NextResponse.json({ success: true, durationMs, ...result });
    } catch (error) {
        logger.error("[Cron:GuildPurge] échec de la passe", error);
        await recordCronExecution("guild_purge", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: "Échec de la purge des guildes",
            details: { error: String(error) },
        });
        return NextResponse.json({ error: "Échec de la purge" }, { status: 500 });
    }
}

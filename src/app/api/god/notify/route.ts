import { NextResponse } from "next/server";
import { notifyGod } from "@/server/actions/god-notif-actions";
import { safeEqualStrings } from "@/lib/god-route";
import { logger } from "@/lib/logger";
import { z } from "zod";

/**
 * API: External God Notification Receiver
 * Used by VPS maintenance scripts, backups, and other external jobs.
 * 
 * Usage from Curl:
 * curl -X POST https://sigilos.fr/api/god/notify \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "title": "[VPS] Maintenance Terminée",
 *     "message": "Le script maintenance.sh a fini de purger Docker et les logs.",
 *     "type": "VPS_MAINTENANCE",
 *     "success": true,
 *     "metadata": { "docker_pruned": "3.5GB", "logs_cleared": "120MB" }
 *   }'
 */

// #47 — validation Zod bornée (fail-closed) : taille max, longueurs bornées,
// metadata = objet plat (<= 20 clés, valeurs scalaire string/number/bool).
const notifySchema = z.object({
    title: z.string().min(1, "title requis").max(200, "title trop long"),
    message: z.string().min(1, "message requis").max(4000, "message trop long"),
    type: z.enum([
        "VPS_MAINTENANCE",
        "BACKUP",
        "WORKER_SYNC",
        "TICKET",
        "GEOGUESSER_REPORT",
        "SECURITY_ALERT",
        "SYSTEM",
    ]),
    success: z.boolean().optional(),
    metadata: z
        .record(z.unknown())
        .refine(obj => Object.keys(obj).length <= 20, "metadata : trop de clés")
        .refine(
            obj => Object.values(obj).every(v => ["string", "number", "boolean"].includes(typeof v) && v !== null),
            "metadata : valeurs scalaires uniquement (string | number | boolean)"
        )
        .optional(),
}).strict();

export async function POST(req: Request) {
    logger.info("[API_GOD_NOTIFY] Réception d'une notification externe");
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // Fail-closed : secret manquant OU header invalide → 401.
        // Comparaison en temps constant (anti timing-side-channel).
        if (!cronSecret || !authHeader) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const expected = `Bearer ${cronSecret}`;
        if (!safeEqualStrings(authHeader, expected)) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const raw = await req.json();
        const parsed = notifySchema.safeParse(raw);
        if (!parsed.success) {
            logger.warn("[API_GOD_NOTIFY] Payload invalide rejeté", {
                errors: parsed.error.issues.map(i => i.message).slice(0, 5),
            });
            return new NextResponse(`Payload invalide: ${parsed.error.issues[0]?.message}`, { status: 400 });
        }

        const { title, message, type, success, metadata } = parsed.data;

        // Enregistrement de la télémétrie CRON pour le panel GOD
        if (type === "VPS_MAINTENANCE") {
            const { recordCronExecution } = await import("@/lib/cron-telemetry");
            await recordCronExecution("maintenance", {
                success: success ?? true,
                summary: message,
                details: metadata
            });
            await recordCronExecution("janitor", {
                success: success ?? true,
                summary: "Nettoyage BDD terminé",
                details: metadata
            });
        } else if (type === "BACKUP") {
            const { recordCronExecution } = await import("@/lib/cron-telemetry");
            await recordCronExecution("backup_db", {
                success: success ?? true,
                summary: message,
                details: metadata
            });
        }

        const result = await notifyGod({
            title,
            message,
            type,
            success: success ?? true,
            metadata,
            ping: success === false // Ping on Discord only if it failed
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        // F-15: never leak internal error details to the client — log them server-side only.
        logger.error("[API_GOD_NOTIFY] Error:", { error: (error as Error).message });
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

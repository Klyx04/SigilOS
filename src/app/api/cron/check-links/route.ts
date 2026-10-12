import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { checkExternalLinks, createSystemAuditLog } from "@/lib/dofensive-sync";
import { recordCronExecution } from "@/lib/cron-telemetry";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";

/**
 * 🔗 CRON — Vérificateur de liens multi-sources (HEAD).
 * Vérifie périodiquement que les liens DofusDB / Dofensive / DPLN générés pour les
 * donjons ne renvoient pas de 404 (HEAD léger, 10 s max par URL, concurrence 6).
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (fail-closed).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const dungeonsRes = await getDungeonsWithAchievements();
        if (!dungeonsRes.success || !Array.isArray(dungeonsRes.data)) {
            return NextResponse.json({ error: "Impossible de récupérer les donjons" }, { status: 500 });
        }

        const urls: string[] = [];
        for (const d of dungeonsRes.data) {
            if (!d) continue;
            const asHttp = (u: unknown): string | null =>
                typeof u === "string" && /^https?:\/\//.test(u) ? u : null;
            if (asHttp(d.dofensiveUrl)) urls.push(d.dofensiveUrl);
            else if (typeof d.dofensiveUrl === "string" && d.dofensiveUrl.startsWith("/"))
                urls.push(`https://dofensive.com${d.dofensiveUrl}`);
            if (asHttp(d.dpnlUrl)) urls.push(d.dpnlUrl);
            if (asHttp(d.dofuspourlesnoobsUrl)) urls.push(d.dofuspourlesnoobsUrl);
            if (Number.isInteger(d.dofusdbId) && d.dofusdbId > 0)
                urls.push(`https://dofusdb.fr/fr/database/monster/${d.dofusdbId}`);
        }

        const results = await checkExternalLinks(urls);
        const broken = results.filter((r) => !r.ok);
        const brokenByDomain = broken.reduce<Record<string, number>>((acc, r) => {
            try {
                const host = new URL(r.url).hostname;
                acc[host] = (acc[host] ?? 0) + 1;
            } catch {
                // URL invalide déjà comptée comme broken
            }
            return acc;
        }, {});

        logger.info(`[Cron:CheckLinks] ${results.length} liens vérifiés, ${broken.length} cassés`);

        await createSystemAuditLog({
            cron: "check-links",
            targetId: "check-links",
            total: results.length,
            broken: broken.length,
            brokenByDomain,
        });

        await recordCronExecution("check_links", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: `${results.length} liens vérifiés, ${broken.length} cassés`,
            details: { total: results.length, broken: broken.length, brokenByDomain },
        });

        return NextResponse.json({ success: true, total: results.length, broken, brokenByDomain });
    } catch (error: any) {
        logger.error("[Cron:CheckLinks] Erreur:", { error: String(error) });
        await recordCronExecution("check_links", {
            success: false,
            summary: "Échec de la vérification des liens",
            details: { error: String(error) },
        });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

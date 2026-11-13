import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 📋 Siphon des **conditions d'équipement** (DofusDude → `GameItem.conditions`).
 *
 * Pourquoi une route et pas seulement un script : l'image de production est un build standalone et
 * `node scripts/siphon-item-conditions.mjs` y échoue (mesuré le 26/10/2026 :
 * `ERR_MODULE_NOT_FOUND: @prisma/driver-adapter-utils`, dépendance transitive de l'adaptateur
 * absente du traçage de Next). Cette route exécute le **même cœur** (`siphonItemConditionsCore`)
 * avec le bon client Prisma — aucun SSH, aucune installation.
 *
 *   curl -sS -H "x-cron-secret: $CRON_SECRET" \
 *     "https://beta.sigilos.fr/api/cron/siphon-item-conditions?apply=1"
 *
 * · `apply` = **0 par défaut** ⇒ dry-run (mesure seule, aucune écriture) ;
 * · à lancer **après** la veille des objets (une fiche absente est comptée `missing`, jamais créée).
 *
 * 🔒 Protégé par `verifyCronSecret` (`x-cron-secret`), comme les autres routes cron.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = new URL(req.url).searchParams;
    const applyParam = params.get("apply");
    const apply = applyParam === "1" || applyParam === "true";

    try {
        const { siphonItemConditionsCore } = await import("@/lib/item-conditions-siphon");
        const report = await siphonItemConditionsCore({ apply });
        logger.info("[cron:siphon-item-conditions] passe", {
            apply,
            fetched: report.fetched,
            withConditions: report.withConditions,
            written: report.written,
            unchanged: report.unchanged,
            missing: report.missing,
            skipped: report.skipped.length,
        });
        return NextResponse.json({ success: true, apply, ...report });
    } catch (error) {
        logger.error("[cron:siphon-item-conditions] échec", { error });
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Siphon impossible" },
            { status: 500 },
        );
    }
}

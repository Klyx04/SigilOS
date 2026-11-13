import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 🧩 Siphon du **référentiel des panoplies** (`GameItemSet`) — déclenchable à distance.
 *
 * Pourquoi une route et pas seulement `scripts/siphon-item-sets.ts` : l'image de production ne
 * porte **ni `tsx` ni les alias `@/`** (build standalone), donc le script TypeScript ne peut pas
 * tourner **dans** le conteneur. Cette route exécute le **même cœur** (`siphonItemSetsCore`, une
 * seule source) avec le bon `DATABASE_URL` — aucun SSH, aucun outil à installer.
 *
 *   curl -sS -H "x-cron-secret: $CRON_SECRET" \
 *     "https://beta.sigilos.fr/api/cron/siphon-item-sets?apply=1&pages=5"
 *
 * · `apply` = **0 par défaut** ⇒ dry-run (mesure seule, aucune écriture) ;
 * · `pages` borne la passe (19 pages au total) pour rester sous les timeouts de proxy ;
 * · `startSkip` reprend où l'appel précédent s'est arrêté (`nextSkip` du rapport).
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

    const rawPages = Number(params.get("pages"));
    const maxPages = Number.isFinite(rawPages) && rawPages > 0 ? Math.min(19, Math.floor(rawPages)) : undefined;

    const rawSkip = Number(params.get("startSkip"));
    const startSkip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0;

    try {
        const { siphonItemSetsCore } = await import("@/lib/item-sets-siphon");
        const report = await siphonItemSetsCore({ apply, maxPages, startSkip });
        logger.info("[cron:siphon-item-sets] passe", {
            apply,
            maxPages: maxPages ?? "all",
            startSkip,
            fetched: report.fetched,
            written: report.written,
            unchanged: report.unchanged,
            skipped: report.skipped.length,
            nextSkip: report.nextSkip,
        });
        return NextResponse.json({ success: true, apply, maxPages: maxPages ?? null, startSkip, ...report });
    } catch (error) {
        logger.error("[cron:siphon-item-sets] échec", { error });
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Siphon impossible" },
            { status: 500 },
        );
    }
}

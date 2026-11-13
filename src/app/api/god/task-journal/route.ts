import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import {
    CRON_HISTORY_LIMIT,
    CRON_HISTORY_TTL_DAYS,
    getAllCronHistories,
} from "@/lib/cron-telemetry";
import {
    buildCronJournal,
    cronJournalFacets,
    filterCronJournal,
} from "@/lib/cron-journal";

/**
 * GET /api/god/task-journal — **journal des exécutions CRON** (lot C2).
 *
 * Source unique : Redis `cron:telemetry:history:<cronId>` (**10 dernières exécutions par
 * tâche**, TTL 7 jours), écrit par `recordCronExecution` — le même point de passage que
 * les 25 routes `/api/cron/*`. Aucune table, aucune double écriture.
 *
 * Sécurité : session + `isSuperAdmin()` (fail-closed), comme `/api/god/cron-status`.
 * Entrées bornées par Zod (tâche, statut, période, recherche) ; le filtrage vit dans
 * `src/lib/cron-journal.ts` (règle pure, testée) — pas de règle dupliquée ici.
 */

const querySchema = z.object({
    task: z.string().max(64).optional(),
    status: z.enum(["all", "success", "error"]).optional(),
    period: z.enum(["24h", "7d", "all"]).optional(),
    q: z.string().max(120).optional(),
});

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isSuperAdmin())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
        task: url.searchParams.get("task") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        period: url.searchParams.get("period") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
    });

    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Requête invalide";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const { ok, sources } = await getAllCronHistories();
    const all = buildCronJournal(sources);
    const entries = filterCronJournal(all, {
        taskId: parsed.data.task ?? "all",
        status: parsed.data.status ?? "all",
        period: parsed.data.period ?? "7d",
        search: parsed.data.q ?? "",
    });

    return NextResponse.json({
        entries,
        facets: cronJournalFacets(all),
        redisOk: ok,
        window: { perTask: CRON_HISTORY_LIMIT, ttlDays: CRON_HISTORY_TTL_DAYS },
        generatedAt: new Date().toISOString(),
    });
}

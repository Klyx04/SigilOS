import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { getMonsterSpellLevels } from "@/server/actions/monster-spell-actions";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **pré-chauffe des sorts de raid** (lot 6 « sorts étrangers »).
 *
 * Pour chaque monstre de raid suivi (Gigalodon : 4 boss + 6 monstres + Murare),
 * résout l'id DofusDB par nom exact puis appelle `getMonsterSpellLevels` :
 * le cache mémoire de l'action est rempli AVANT les premières fiches du jour
 * (niveaux de sorts, conditions, passif, drops, aggro). Idempotent, borné
 * (11 noms), fail-soft : un monstre non résolu est compté en `skipped`.
 *
 * ⏱️ Fréquence conseillée : quotidienne 04h10 UTC (après `sync_monster_stats`).
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 */
const RAID_MONSTER_NAMES = [
    "Mureine",
    "Exécrabe",
    "Willorque",
    "Gigalodon",
    "Madrépire",
    "Kokayou",
    "Léviatank",
    "Calarmure",
    "Écaillon",
    "Krak'Haine",
    "Murare",
];

async function resolveMonsterId(name: string): Promise<number | null> {
    try {
        const res = await dofusDbFetch(
            `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(name)}&lang=fr&$limit=5`,
            { cache: "no-store", signal: AbortSignal.timeout(8_000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const exact = (data?.data ?? []).find(
            (m: any) => String(m?.name?.fr ?? "").toLowerCase() === name.toLowerCase()
        );
        const id = Math.floor(Number(exact?.id ?? data?.data?.[0]?.id));
        return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("sync_raid_spells").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    let warmed = 0;
    let failed = 0;
    const skipped: string[] = [];

    try {
        for (const name of RAID_MONSTER_NAMES) {
            const id = await resolveMonsterId(name);
            if (!id) {
                skipped.push(name);
                continue;
            }
            const res = await getMonsterSpellLevels(id);
            if (res.success) warmed++;
            else failed++;
        }
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_raid_spells", {
            success: failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Sorts raid : ${warmed} monstre(s) pré-chargé(s), ${failed} échec(s)` +
                (skipped.length > 0 ? `, ignorés : ${skipped.join(", ")}` : ""),
        });
        return NextResponse.json({ success: failed === 0, warmed, failed, skipped });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[SyncRaidSpellsCron] Global Error", { error: message });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("sync_raid_spells", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

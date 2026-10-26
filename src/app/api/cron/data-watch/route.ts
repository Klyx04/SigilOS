import { NextResponse } from 'next/server';
import { verifyCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { boundCronList } from "@/lib/cron-metrics";

export const dynamic = 'force-dynamic';

const DOFUSDB_API = "https://api.dofusdb.fr";

async function remoteTotal(endpoint: string): Promise<number | null> {
    try {
        const res = await fetch(`${DOFUSDB_API}/${endpoint}?$limit=1`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)" },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return typeof json?.total === "number" ? json.total : null;
    } catch {
        return null;
    }
}

/**
 * 🔭 CRON hebdo (dimanches) : guette les NOUVEAUTÉS DofusDB **et entretient les référentiels**.
 *
 * Deux rôles, volontairement séparés :
 *  ① **Détection** (lecture seule sur les données métier) : compare les totaux distants (items,
 *    donjons) et le diff quêtes au stock local, recompte les conditions non évaluables.
 *    ⇒ **alerte God uniquement en cas de nouveauté** (pas de bruit hebdomadaire).
 *  ② **Entretien** (écritures bornées, idempotentes) : met en file la **veille ciblée** des items
 *    et rejoue une passe ciblée des **panoplies**.
 *    ⚠️ Depuis le 26/10/2026, l'entretien n'est **plus conditionné** à une nouveauté : un
 *    rééquilibrage de statistiques (refonte des trophées en 3.7, par exemple) **ne change aucun
 *    compteur** ⇒ l'ancienne garde `if (hasNews)` laissait les fiches et les paliers se périmer
 *    en silence.
 *
 * La machine n'applique **jamais** de suppression : un retrait reste une décision humaine.
 *
 * 🔒 Protégé par verifyCronSecret (x-cron-secret).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const [remoteItems, remoteQuests, remoteDungeons] = await Promise.all([
            remoteTotal("items"),
            remoteTotal("quests"),
            remoteTotal("dungeons"),
        ]);

        const [localItems, localDungeons] = await Promise.all([
            (db as any).gameItem.count({ where: { isDeprecated: false } }).catch(() => null),
            (db as any).dungeon.count().catch(() => null),
        ]);

        // Diff quêtes détaillé (NEW/MODIFIED) via le comparateur existant (lecture seule).
        let questNew = 0;
        let questModified = 0;
        try {
            // Cœur `src/lib` (23/09/2026) : même logique, exécutable hors session Next.
            const { computeQuestDeltasCore } = await import("@/lib/quest-siphon");
            const { deltas } = await computeQuestDeltasCore();
            questNew = deltas.filter((d) => d.type === "NEW").length;
            questModified = deltas.filter((d) => d.type === "MODIFIED").length;
        } catch (e) {
            logger.warn("[Cron:DataWatch] Diff quêtes impossible:", { error: String(e) });
        }

        /**
         * 🧩 Veille des **conditions d'équipement** (26/10/2026) : recompte ce que l'évaluateur ne
         * sait pas traiter (éléments / opérateurs inconnus) et les types d'objet hors
         * `VARIANT_SLOTS`. C'est ce qui doit alerter **avant** que les variantes se mettent à
         * refuser en masse. Fail-open : une erreur ici ne casse pas la veille DofusDB.
         */
        let conditionsWatch: Awaited<ReturnType<typeof import("@/server/item-conditions-watch").refreshItemConditionsWatch>> = null;
        try {
            const { refreshItemConditionsWatch } = await import("@/server/item-conditions-watch");
            conditionsWatch = await refreshItemConditionsWatch();
        } catch (e) {
            logger.warn("[Cron:DataWatch] Veille conditions impossible:", { error: String(e) });
        }

        const parts: string[] = [];
        if (remoteItems !== null && localItems !== null && remoteItems !== localItems) {
            parts.push(`${Math.abs(remoteItems - localItems)} items (distant ${remoteItems} vs local ${localItems})`);
        }
        if (questNew > 0) parts.push(`${questNew} nouvelle(s) quête(s)`);
        if (questModified > 0) parts.push(`${questModified} quête(s) modifiée(s)`);
        if (remoteDungeons !== null && localDungeons !== null && remoteDungeons !== localDungeons) {
            parts.push(`${Math.abs(remoteDungeons - localDungeons)} donjons (distant ${remoteDungeons} vs local ${localDungeons})`);
        }
        // Seule une **nouveauté** d'inconnue alerte (l'état « il reste N inconnues » est stable
        // par nature : l'inclure ferait sonner le cron toutes les semaines).
        if (conditionsWatch && conditionsWatch.newUnknown.length > 0) {
            parts.push(
                `${conditionsWatch.newUnknown.length} condition(s) d'équipement non évaluable(s) jamais vue(s) `
                + `(${boundCronList(conditionsWatch.newUnknown.map((b) => `${b.element} ${b.operator}`)).text})`,
            );
        }
        if (conditionsWatch && conditionsWatch.newTypes.length > 0) {
            parts.push(
                `${conditionsWatch.newTypes.length} type(s) d'objet hors slots de variante jamais vu(s) `
                + `(${boundCronList(conditionsWatch.newTypes).text})`,
            );
        }

        const hasNews = parts.length > 0;
        const summary = hasNews
            ? `Nouveautés détectées : ${parts.join(" · ")}`
            : "Rien à signaler (stocks alignés)";

        // 🔭 Auto-synchronisation CIBLÉE (23/09/2026, **inconditionnelle depuis le 26/10/2026**) :
        // pour les datasets **éligibles** (registre `GAME_DATA_AUTO_SYNC_DATASETS` : cœur `lib`
        // capable de filtrer par date + passe strictement additive), on met en file une passe
        // ciblée `updatedAt[$gt]=filigrane` — mesuré : 46 items au lieu de 21 776.
        // ⚠️ Plus de `if (hasNews)` : une fiche dont **seules** les stats/effets changent ne bouge
        // aucun total, donc aucune alerte ne la signalerait — et le payload resterait périmé.
        // La passe est additive (jamais de suppression) et n'écrit que ce qui a changé (`dataHash`).
        const autoQueued: string[] = [];
        const autoUnavailable: string[] = [];
        const autoRunning: string[] = [];
        const { GAME_DATA_AUTO_SYNC_DATASETS, isBackgroundDataset } = await import("@/lib/game-data-sync-state");
        const { enqueueGameDataSync } = await import("@/lib/queue/game-data-queue");
        for (const dataset of GAME_DATA_AUTO_SYNC_DATASETS) {
            if (!isBackgroundDataset(dataset)) continue;
            const { jobId, outcome } = await enqueueGameDataSync(dataset, { incremental: true });
            if (outcome === "queued" && jobId) autoQueued.push(dataset);
            else if (outcome === "already-running") autoRunning.push(dataset);
            else autoUnavailable.push(dataset);
        }

        /**
         * 🔁 **Référentiel des panoplies** (26/10/2026) : les paliers de bonus changent sans que le
         * nombre de panoplies bouge ⇒ aucun écart de compteur ne les verrait jamais. Passe
         * **ciblée** (filigrane `updatedAt[$gt]`, Redis), bornée, idempotente. Fail-open : une
         * erreur ici ne casse pas la veille DofusDB.
         */
        let itemSets: Awaited<ReturnType<typeof import("@/server/item-sets-refresh").refreshItemSetsCore>> | null = null;
        try {
            const { refreshItemSetsCore } = await import("@/server/item-sets-refresh");
            itemSets = await refreshItemSetsCore();
        } catch (e) {
            logger.warn("[Cron:DataWatch] Rafraîchissement des panoplies impossible:", { error: String(e) });
        }

        if (hasNews) {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            const auto = autoQueued.length
                ? ` Veille ciblée mise en file : ${autoQueued.join(", ")} (seuls les changements sont relus).`
                : autoRunning.length
                ? ` Veille déjà en cours : ${autoRunning.join(", ")}.`
                : autoUnavailable.length
                ? ` File indisponible : lancer ${autoUnavailable.join(", ")} depuis le Tableau god.`
                : "";
            // Les panoplies se rafraîchissent **même sans nouveauté** ; quand il y en a, la notif
            // le dit (un palier de bonus faux fausse tous les totaux d'un build).
            const setsNote = itemSets && itemSets.written > 0
                ? ` Panoplies rafraîchies : ${itemSets.written} palier(s) mis à jour sur ${itemSets.fetched} relue(s).`
                : "";
            await notifyGod({
                title: "🆕 Nouveautés DofusDB détectées",
                message: `${summary}.${auto}${setsNote} Aucune suppression n'est automatique : voir le Tableau (god → données de jeu).`,
                type: "SYSTEM",
                success: true,
                // C4 — les 9 métriques deviennent des **champs français** : l'embed ne
                // dépend plus du repli `metadata` (clés techniques) du lot C1.
                fields: [
                    { name: "Objets (DofusDB)", value: `${remoteItems} distants · ${localItems} locaux`, inline: true },
                    { name: "Quêtes", value: `${questNew} nouvelle(s) · ${questModified} modifiée(s)`, inline: true },
                    { name: "Donjons", value: `${remoteDungeons} distants · ${localDungeons} locaux`, inline: true },
                    ...(conditionsWatch
                        ? [{
                            name: "Conditions d'équipement",
                            value: `${conditionsWatch.summary.items} objets conditionnés · ${conditionsWatch.summary.unknownAtoms} atome(s) non évaluable(s)`,
                            inline: true,
                        }]
                        : []),
                    ...(conditionsWatch && conditionsWatch.summary.unknownTypes.length > 0
                        ? [{
                            // La veille **signale** les types hors slots, elle ne les ajoute pas d'office.
                            name: "Types d'objet hors variantes",
                            value: `${conditionsWatch.summary.unknownTypes.length} au total`
                                + (conditionsWatch.newTypes.length > 0
                                    ? ` · nouveaux : ${boundCronList(conditionsWatch.newTypes).text}`
                                    : " · aucun nouveau"),
                            inline: false,
                        }]
                        : []),
                    ...(autoQueued.length > 0
                        ? [{ name: "Veille ciblée mise en file", value: boundCronList(autoQueued).text, inline: false }]
                        : []),
                    ...(autoRunning.length > 0
                        ? [{ name: "Veille déjà en cours", value: boundCronList(autoRunning).text, inline: false }]
                        : []),
                    ...(autoUnavailable.length > 0
                        ? [{ name: "⚠️ File indisponible", value: `${boundCronList(autoUnavailable).text} — à lancer depuis le Tableau god`, inline: false }]
                        : []),
                    ...(itemSets && itemSets.written > 0
                        ? [{
                            name: "Panoplies rafraîchies",
                            value: `${itemSets.written} palier(s) mis à jour sur ${itemSets.fetched} relue(s)`,
                            inline: true,
                        }]
                        : []),
                ],
                metadata: { remoteItems, localItems, questNew, questModified, remoteDungeons, localDungeons, autoQueued, autoRunning, autoUnavailable, conditions: conditionsWatch?.summary ?? null, itemSets },
            });
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        const summaryParts = [
            autoQueued.length ? `${summary} · veille ciblée: ${autoQueued.join(", ")}` : summary,
            itemSets && itemSets.written > 0 ? `panoplies: ${itemSets.written} écrite(s)` : "",
            itemSets?.state === "uninitialized" ? "panoplies: référentiel vide" : "",
        ].filter(Boolean);
        await recordCronExecution("data_watch", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: summaryParts.join(" · "),
            details: { remoteItems, localItems, questNew, questModified, remoteDungeons, localDungeons, autoQueued, autoRunning, autoUnavailable, conditions: conditionsWatch?.summary ?? null, itemSets },
        });

        return NextResponse.json({ success: true, hasNews, summary, autoQueued, autoRunning, autoUnavailable, conditions: conditionsWatch, itemSets });
    } catch (e: any) {
        logger.error("[Cron:DataWatch] Erreur:", e);
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("data_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${e.message}`,
        });
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}

import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import {
    GAME_DATA_QUEUE_NAME,
    gameDataQueueOptions,
} from "../lib/queue/game-data-queue";
import {
    isBackgroundDataset,
    type GameDataBackgroundDataset,
} from "../lib/game-data-sync-state";
import {
    beginGameDataRun,
    finishGameDataRun,
    getGameDataWatchState,
    reportGameDataProgress,
    setGameDataWatchState,
} from "../server/game-data-sync-state-store";
import { logger } from "../lib/logger";

/**
 * Worker game-data — les siphons LOURDS tournent ici, côté serveur.
 *
 * 🎯 Audit 22/09/2026 : les siphons étaient pilotés par le NAVIGATEUR (boucles
 * d'appels dans le panneau) ⇒ fermer l'onglet perdait tout, aucun état, 429 en
 * boucle. Ici le travail vit dans la file : il **survit à la fermeture de l'onglet**,
 * BullMQ rejoue en exponentiell (attempts/backoff) et l'état est persisté dans Redis
 * (`beginGameDataRun` / `finishGameDataRun`) pour que le dashboard God affiche une
 * progression **vraie**.
 *
 * ⚠️ Seuls les datasets dont le cœur vit dans `src/lib` sont éligibles (pas de
 * session Next ici). **Huit le sont** (23/09/2026) : CATALOGUE
 * (`siphonDungeonMonstersDataset`), ANOMALY_BOSSES (`syncAnomalyBosses`),
 * ZONES (`syncZonesFromDofusDbCore`), FAMILIES (`syncMonsterFamiliesCore`),
 * ITEMS (`siphonAllGameItemsCore` / `siphonGameItemsIncrementalCore`),
 * REFERENTIALS (`syncMarketReferentialsCore`), QUESTS (`syncQuestDeltasCore`) et
 * BOUNTIES (`syncBounties`). Les autres gardent leurs boutons directs tant que
 * leur cœur n'a pas été descendu.
 */
async function runBackgroundDataset(
    dataset: GameDataBackgroundDataset,
    opts: { incremental?: boolean } = {},
) {
    if (dataset === "CATALOGUE") {
        const { siphonDungeonMonstersDataset } = await import("../lib/dungeon-monsters-siphon");
        await beginGameDataRun("CATALOGUE", { message: "Catalogue local (donjons & monstres)" });
        const result = (await siphonDungeonMonstersDataset()) as {
            totalDungeons?: number;
            totalMonsters?: number;
            success?: boolean;
        };
        await finishGameDataRun("CATALOGUE", {
            ok: result?.success !== false,
            message: result?.totalDungeons
                ? `${result.totalDungeons} donjons · ${result.totalMonsters ?? 0} monstres`
                : "Catalogue régénéré",
        });
        return result;
    }

    // ANOMALY_BOSSES : le cœur vit DÉJÀ dans `src/lib` (`syncAnomalyBosses`) — même
    // passe que le cron `sync-monster-stats`, déclenchable ici sans session Next.
    if (dataset === "ANOMALY_BOSSES") {
        const { syncAnomalyBosses } = await import("../lib/anomaly-boss-siphon");
        await beginGameDataRun("ANOMALY_BOSSES", {
            message: "Gardiens d'anomalie (DofusDB race 191 + Dofensive)",
        });
        const result = (await syncAnomalyBosses()) as {
            synced?: number;
            errors?: string[];
            guardians?: unknown[];
        };
        await finishGameDataRun("ANOMALY_BOSSES", {
            ok: (result?.errors?.length ?? 0) === 0,
            message: result?.guardians?.length
                ? `${result.guardians.length} gardiens (${result.synced ?? 0} écrits)`
                : "Gardiens d'anomalie synchronisés",
            error: result?.errors?.length ? result.errors.slice(0, 3).join(" · ") : undefined,
        });
        return result;
    }

    // ZONES / FAMILIES : cœurs descendus dans `src/lib` le 22/09/2026 — la boucle
    // était dans le navigateur (fermer l'onglet perdait la passe), elle est ici.
    if (dataset === "ZONES") {
        const { syncZonesFromDofusDbCore } = await import("../lib/zones-siphon");
        await beginGameDataRun("ZONES", { message: "Zones & sous-zones (DofusDB)" });
        const result = await syncZonesFromDofusDbCore(async ({ done, total }) => {
            await reportGameDataProgress("ZONES", { done, total, message: `${done} zone(s) / ${total}` });
        });
        await finishGameDataRun("ZONES", { ok: true, message: `${result.synced} zone(s) synchronisée(s)` });
        return result;
    }

    if (dataset === "FAMILIES") {
        const { syncMonsterFamiliesCore } = await import("../lib/monster-families-siphon");
        await beginGameDataRun("FAMILIES", { message: "Familles de monstres (DofusDB)" });
        const result = await syncMonsterFamiliesCore(async ({ done, total }) => {
            await reportGameDataProgress("FAMILIES", { done, total, message: `${done} / ${total}` });
        });
        await finishGameDataRun("FAMILIES", {
            ok: true,
            message: `${result.synced} famille(s) · ${result.monstersSynced} monstre(s)`,
        });
        return result;
    }

    // QUESTS : cœur descendu dans `src/lib` le 23/09/2026 (`quest-siphon`) — le cron
    // `data-watch` l'appelait déjà sans session : il suffisait de le remonter d'un étage.
    if (dataset === "QUESTS") {
        const { computeQuestDeltasCore, syncQuestDeltasCore } = await import("../lib/quest-siphon");
        await beginGameDataRun("QUESTS", { message: "Quêtes (écarts DofusDB)" });
        const { deltas, totalLocal, totalRemote } = await computeQuestDeltasCore();
        if (deltas.length === 0) {
            await finishGameDataRun("QUESTS", {
                ok: true,
                message: `Aucune modification (${totalLocal}/${totalRemote} à jour)`,
            });
            return { totalLocal, totalRemote, synced: 0 };
        }
        await reportGameDataProgress("QUESTS", {
            done: 0,
            total: deltas.length,
            message: `${deltas.length} quête(s) à synchroniser`,
        });
        const synced = await syncQuestDeltasCore(deltas.map((d) => d.dofusDbId));
        await finishGameDataRun("QUESTS", {
            ok: true,
            message: `${synced} quête(s) synchronisée(s) sur ${deltas.length} détectée(s)`,
        });
        return { totalLocal, totalRemote, synced };
    }

    // REFERENTIALS : cœur descendu dans `src/lib` le 23/09/2026 (il ne dépendait
    // que de DofusDB + Prisma : aucune session Next n'était nécessaire).
    if (dataset === "REFERENTIALS") {
        const { syncMarketReferentialsCore } = await import("../lib/market/referential-siphon");
        await beginGameDataRun("REFERENTIALS", { message: "Référentiels (effets & caractéristiques)" });
        const result = await syncMarketReferentialsCore();
        await finishGameDataRun("REFERENTIALS", {
            ok: !result.truncated,
            message: `${result.effects} effet(s) · ${result.characteristics} caractéristique(s) lus`,
            error: result.truncated ? "Référentiel incomplet (page DofusDB en échec)" : undefined,
        });
        return result;
    }

    // ITEMS : cœur descendu dans `src/lib` le 23/09/2026 (21 776 items ≈ 218 lots) — la
    // boucle vivait dans le NAVIGATEUR (un aller-retour d'action par lot, 429 en boucle,
    // fermer l'onglet perdait la passe). Ici elle vit dans la file, avec la progression
    // RÉELLE remontée depuis le `total` exposé par DofusDB.
    //
    // 🔭 23/09/2026 — **veille ciblée** : quand le job le demande (`incremental: true`) ET
    // qu'un filigrane existe, on ne demande à DofusDB que `updatedAt[$gt]=<filigrane>`
    // (mesuré : 46 items sur 30 jours au lieu de 21 776). Le filigrane est amorcé par la
    // première passe complète et n'avance **que** sur une passe non tronquée.
    if (dataset === "ITEMS") {
        const { siphonAllGameItemsCore, siphonGameItemsIncrementalCore } = await import("../lib/game-items-siphon");
        const watch = await getGameDataWatchState("ITEMS");

        if (opts.incremental && watch?.since) {
            await beginGameDataRun("ITEMS", { message: `Veille ciblée depuis ${watch.since}` });
            const result = await siphonGameItemsIncrementalCore(watch.skip, watch.since, async ({ done, total }) => {
                await reportGameDataProgress("ITEMS", {
                    done,
                    total,
                    message: `${done} / ${total ?? "?"} item(s) modifié(s)`,
                });
            });
            // Passe complète ⇒ filigrane = le plus récent vu ; passe tronquée ⇒ on garde le
            // filigrane et on mémorise le lot de reprise (aucun item sauté, aucune boucle).
            await setGameDataWatchState("ITEMS", {
                since: result.truncated ? watch.since : result.nextWatermark ?? watch.since,
                skip: result.truncated ? result.nextSkip : 0,
            });
            const unchanged = Math.max(0, result.processed - result.inserted - result.updated);
            await finishGameDataRun("ITEMS", {
                ok: true,
                message:
                    `Veille ciblée depuis ${watch.since} : ${result.inserted} créé(s) · ${result.updated} modifié(s) · ${unchanged} inchangé(s)` +
                    (result.truncated ? " · plafond atteint, reprise au prochain passage" : ""),
                counts: { inserted: result.inserted, updated: result.updated, unchanged },
            });
            return result;
        }

        const startedAt = new Date().toISOString();
        await beginGameDataRun("ITEMS", { message: "Items & ressources (DofusDB)" });
        const result = await siphonAllGameItemsCore(async ({ done, total }) => {
            await reportGameDataProgress("ITEMS", {
                done,
                total,
                message: `${done} / ${total ?? "?"} item(s)`,
            });
        });
        // Passe complète : tout le catalogue a été vu ⇒ filigrane = le **début** de la passe
        // (conservateur : ce qui a bougé pendant la passe sera revu au tour suivant).
        await setGameDataWatchState("ITEMS", { since: startedAt, skip: 0 });
        const unchanged = Math.max(0, result.processed - result.inserted - result.updated);
        await finishGameDataRun("ITEMS", {
            ok: true,
            message: `${result.processed} analysé(s) · ${result.inserted} créé(s) · ${result.updated} mis à jour`,
            counts: { inserted: result.inserted, updated: result.updated, unchanged },
        });
        return result;
    }

    const { syncBounties } = await import("../lib/bounty-siphon");
    await beginGameDataRun("BOUNTIES", { total: 5, message: "Avis de recherche (5 races)" });
    const result = (await syncBounties()) as {
        total?: number;
        synced?: number;
        errors?: string[];
    };
    await finishGameDataRun("BOUNTIES", {
        ok: (result?.errors?.length ?? 0) === 0,
        message: result?.total ? `${result.total} avis (${result.synced ?? 0} écrits)` : "Avis synchronisés",
        error: result?.errors?.length ? result.errors.slice(0, 3).join(" · ") : undefined,
    });
    return result;
}

export const gameDataWorker = new Worker(
    GAME_DATA_QUEUE_NAME,
    async (job) => {
        const dataset = job.data?.dataset as GameDataBackgroundDataset;
        if (!dataset || !isBackgroundDataset(dataset)) {
            // Dataset inconnu : aucune tentative supplémentaire n'a de sens.
            throw new UnrecoverableError(`Dataset game-data inconnu: ${String(job.data?.dataset)}`);
        }
        logger.info(`[GameData] Siphon en arrière-plan démarré: ${dataset}`);
        try {
            const result = await runBackgroundDataset(dataset, {
                // 🔭 `incremental: true` = pose par le cron de veille (passe ciblée additive).
                incremental: job.data?.incremental === true,
            });
            logger.info(`[GameData] Siphon en arrière-plan terminé: ${dataset}`);
            return result;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await finishGameDataRun(dataset, { ok: false, error: message });
            logger.error(`[GameData] Siphon en arrière-plan échoué (${dataset}): ${message}`);
            throw e; // BullMQ rejoue (attempts/backoff) puis alerte en échec définitif
        }
    },
    {
        ...gameDataQueueOptions,
        concurrency: 1,
    },
);

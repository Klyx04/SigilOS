/**
 * Lanceurs **« dans l'onglet »** des siphons game-data — **une seule implémentation**.
 *
 * 🎯 Audit 23/09/2026 (demande user : « je comprends rien », « on garde les boutons dans
 * les pages ?? ») : les mêmes boucles vivaient **éparpillées** dans 3 panneaux
 * (`GameDataSiphonPanel` : catalogue/avis/grimoires, `GameItemSiphonPanel` : items/
 * référentiels, `QuestSyncPanel` : quêtes) et se relançaient depuis 3 endroits, avec
 * 3 libellés différents. Elles sont ici, et c'est **le Tableau** (`GameDataSyncStatePanel`)
 * qui les déclenche — même suivi d'état que les siphons d'arrière-plan
 * (`beginGameDataSync` / `reportGameDataSync` / `finishGameDataSync`) ⇒ la colonne
 * « Progression » du tableau est vraie, quelle que soit la façon dont on lance.
 * 2ᵉ porte d'entrée (27/09/2026) : le bouton « Sync & remplir tous les avis » de
 * `/god/game-data/bounties` appelle `runInlineGameDataDataset("BOUNTIES")` — **le même run**,
 * jamais une copie de la boucle (il en existait une, hors rail, qui ne faisait rien : sonde
 * `monsters?typeId=23` → `total: 0`, mesuré).
 *
 * Deux usages :
 *   · **repli** d'un dataset d'arrière-plan quand aucun worker n'écoute la file
 *     (dev local, VPS redémarré) — `INLINE_RUNNABLE_DATASETS` ;
 *   · **mode normal** des datasets sans cœur `src/lib` : `GAME_DATA_INLINE_DATASETS`.
 *
 * ⚠️ Un run « ici » vit dans le **navigateur** : fermer l'onglet l'interrompt. C'est
 * pourquoi « En arrière-plan » reste proposé en premier quand le worker tourne.
 * ⚠️ Les cadences (lot de 100 items + 2 100 ms, lots de 5 images, une classe à la fois)
 * sont celles **mesurées** : elles viennent du limiteur partagé (`dofusDbFetch`,
 * 30 req/min/hôte) et des incidents 429 passés — ne pas les « optimiser » à l'aveugle.
 */
"use client";

import {
    getSiphonInventory,
    triggerBatchAssetSiphonAction,
    warmClassSpellbook,
} from "@/server/actions/asset-siphon-actions";
import {
    siphonBountiesRaceAction,
    siphonDungeonMonstersDatasetAction,
} from "@/server/actions/game-data-admin-actions";
import { syncMonsterFamiliesFromDofusDb, syncZonesFromDofusDb } from "@/server/actions/game-data-actions";
import { siphonGameItemsBatch, siphonMarketReferentials } from "@/server/actions/game-item-actions";
import { checkDofusDbDeltas, syncDeltas } from "@/server/actions/game-quest-sync-actions";
import {
    beginGameDataSync,
    finishGameDataSync,
    reportGameDataSync,
} from "@/server/actions/game-data-sync-actions";
import { BOUNTY_RACE_IDS, BOUNTY_RACE_NAMES } from "@/lib/bounty";
import { formatGameDataErrorLines } from "@/lib/game-data-error-causes";
import { getClassName } from "@/lib/dofusbook-utils";
import { GAME_ITEMS_BATCH_PAUSE_MS, GAME_ITEMS_BATCH_SIZE } from "@/lib/game-items-cadence";
import type { GameDataDataset } from "@/lib/game-data-sync-state";

/** Les 19 classes : un appel serveur **par classe** (un appel unique de ~10 min casse). */
export const GAME_DATA_CLASS_IDS = Array.from({ length: 19 }, (_, i) => i + 1);

/** Images par appel : 5 = valeur mesurée (concurrence 2 côté serveur, jitter poli). */
export const ASSET_SIPHON_CHUNK_SIZE = 5;

/** Plafond d'un run d'images (même plafond que l'inventaire affiché). */
export const ASSET_SIPHON_MAX_TARGETS = 100;

/** Backoff sur 429 côté client : 2 s → 4 s → 8 s, abandon au 3ᵉ échec consécutif. */
export const INLINE_MAX_RETRIES = 3;

/** Datasets qui savent tourner **dans l'onglet** (les 4 `INLINE` + le repli des autres). */
export const INLINE_RUNNABLE_DATASETS = [
    "CLASS_SPELLS",
    "ASSETS_WEBP",
    "REFERENTIALS",
    "QUESTS",
    "CATALOGUE",
    "BOUNTIES",
    "ZONES",
    "FAMILIES",
    "ITEMS",
] as const;

export type InlineRunnableDataset = (typeof INLINE_RUNNABLE_DATASETS)[number];

export function isInlineRunnable(dataset: GameDataDataset): dataset is InlineRunnableDataset {
    return (INLINE_RUNNABLE_DATASETS as readonly string[]).includes(dataset);
}

/** Cible d'un siphon d'images (sous-ensemble structurel de `SiphonInventoryItem`). */
export interface AssetSiphonTarget {
    id: number | string;
    name: string;
    resolvedMonsterName?: string | null;
    dungeonName?: string | null;
    remoteImageUrl?: string | null;
}

export interface InlineRunHooks {
    /** Journal lisible par l'appelant (le panneau l'affiche) — jamais `console.log`. */
    log?: (line: string) => void;
    /** Progression **locale** (le suivi serveur est écrit séparément, pour tous). */
    onProgress?: (done: number, total: number) => void;
}

export interface InlineRunOptions extends InlineRunHooks {
    /**
     * Cibles imposées (ex. « les manquants affichés » du panneau). Sans cibles, le run
     * prend l'inventaire des images manquantes (plafond `ASSET_SIPHON_MAX_TARGETS`).
     */
    assetTargets?: AssetSiphonTarget[];
}

export interface InlineRunResult {
    ok: boolean;
    summary: string;
    error?: string;
    /**
     * 🔢 **Lot brut** des erreurs rencontrées (jamais tronqué ici : c'est le store qui regroupe par
     * cause et qui chiffre `lastError`). Absent tant qu'aucune passe n'en produit.
     */
    errors?: string[];
}

/** Contexte de run : journal + progression (état serveur **et** barre locale). */
interface RunContext {
    dataset: GameDataDataset;
    log: (line: string) => void;
    report: (done: number, total: number | null, message: string) => Promise<void>;
}

function makeContext(dataset: GameDataDataset, hooks: InlineRunHooks): RunContext {
    return {
        dataset,
        log: hooks.log ?? (() => {}),
        report: async (done, total, message) => {
            if (total && total > 0) hooks.onProgress?.(done, total);
            await reportGameDataSync(dataset, { done, total, message });
        },
    };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Siphon d'images WebP par lots de `ASSET_SIPHON_CHUNK_SIZE`. Extrait de
 * `GameDataSiphonPanel` (23/09/2026) : le bouton contextuel « manquants affichés » **et**
 * le Tableau appellent cette seule fonction (les `details` du serveur vont au journal).
 */
async function siphonAssetTargets(
    targets: AssetSiphonTarget[],
    ctx: RunContext,
): Promise<InlineRunResult> {
    let siphoned = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < targets.length; i += ASSET_SIPHON_CHUNK_SIZE) {
        const chunk = targets.slice(i, i + ASSET_SIPHON_CHUNK_SIZE);
        const res = await triggerBatchAssetSiphonAction(
            chunk.map((t) => ({
                id: t.id,
                // Doubles boss : siphonner le vrai monstre (« Klime »), pas le libellé
                // (« Comte et Klime »).
                name: t.resolvedMonsterName || t.name,
                dungeonName: t.dungeonName ?? undefined,
                remoteUrl: t.remoteImageUrl || undefined,
            })),
        );

        if (res.success && res.data) {
            siphoned += res.data.siphoned;
            skipped += res.data.skipped ?? 0;
            errors += res.data.errors;
            for (const line of res.data.details ?? []) ctx.log(line);
        } else {
            errors += chunk.length;
            ctx.log(`❌ Lot d'images en échec : ${res.error || "inconnue"}`);
        }
        await ctx.report(Math.min(i + chunk.length, targets.length), targets.length, `${Math.min(i + chunk.length, targets.length)} / ${targets.length} image(s)`);
    }

    const summary = `Images WebP : ${siphoned} siphonnée(s), ${skipped} ignorée(s), ${errors} erreur(s).`;
    ctx.log(`🎉 ${summary}`);
    return {
        ok: errors === 0 || siphoned > 0,
        summary,
        error: siphoned === 0 && errors > 0 ? "Aucune image siphonnée" : undefined,
    };
}

/**
 * Passe complète du catalogue d'items (≈21 776 items, 218 lots de 100) : la **boucle**
 * du panneau Items, avec son backoff 429 (le cœur vit en `src/lib`, appelé par lot).
 */
async function runItemBatches(ctx: RunContext): Promise<InlineRunResult> {
    let skip = 0;
    let hasMore = true;
    let inserted = 0;
    let updated = 0;
    let processed = 0;
    let consecutiveFailures = 0;

    while (hasMore) {
        const res = await siphonGameItemsBatch(skip, GAME_ITEMS_BATCH_SIZE);

        if (!res.success || !res.data) {
            consecutiveFailures++;
            const waitMs = Math.min(2000 * Math.pow(2, consecutiveFailures - 1), 16_000);
            if (consecutiveFailures > INLINE_MAX_RETRIES) {
                const error = res.error || "inconnue";
                ctx.log(`❌ Items : abandon après ${INLINE_MAX_RETRIES} tentatives (${error}).`);
                return { ok: false, summary: `${processed} item(s) analysé(s) avant l'abandon.`, error };
            }
            ctx.log(`⏳ Lot skip=${skip} en échec — nouvel essai dans ${waitMs / 1000} s (${consecutiveFailures}/${INLINE_MAX_RETRIES})…`);
            await sleep(waitMs);
            continue;
        }

        consecutiveFailures = 0;
        inserted += res.data.inserted;
        updated += res.data.updated;
        processed += res.data.totalProcessed;
        skip = res.data.nextSkip;
        hasMore = res.data.hasMore;

        await ctx.report(
            processed,
            null,
            `${processed} item(s) analysé(s) — ${inserted} créé(s), ${updated} mis à jour`,
        );
        await sleep(GAME_ITEMS_BATCH_PAUSE_MS);
    }

    const summary = `Items : ${processed} analysé(s), ${inserted} créé(s), ${updated} mis à jour.`;
    ctx.log(`🎉 ${summary}`);
    return { ok: true, summary };
}


/** Grimoires des 19 classes : un appel **par classe** (idempotent, icônes disque). */
async function runClassSpellbooks(ctx: RunContext): Promise<InlineRunResult> {
    /** 🔎 `iconsFailed` est compté **à part** des échecs de passe (règle tranchée en A5, 28/09/2026). */
    const totals = { spells: 0, grades: 0, icons: 0, iconsFailed: 0 };
    let failedRuns = 0;

    for (let i = 0; i < GAME_DATA_CLASS_IDS.length; i++) {
        const classId = GAME_DATA_CLASS_IDS[i] as number;
        const label = getClassName(classId);
        try {
            const res = await warmClassSpellbook(classId);
            if (res.success && res.data) {
                totals.spells += res.data.spells;
                totals.grades += res.data.grades;
                totals.icons += res.data.iconsSiphoned;
                totals.iconsFailed += res.data.iconsFailed;
                ctx.log(
                    `✅ ${label} : ${res.data.spells} sort(s) (${res.data.grades} grades), ${res.data.iconsSiphoned} icône(s) OK` +
                        (res.data.iconsFailed > 0 ? `, ${res.data.iconsFailed} en échec` : ""),
                );
            } else {
                failedRuns++;
                ctx.log(`❌ ${label} : ${res.error || "échec"} — relancer pour compléter.`);
            }
        } catch (e) {
            failedRuns++;
            ctx.log(`❌ ${label} : ${e instanceof Error ? e.message : String(e)} — relancer pour compléter.`);
        }
        await ctx.report(i + 1, GAME_DATA_CLASS_IDS.length, `Classe ${i + 1}/${GAME_DATA_CLASS_IDS.length}`);
    }

    /**
     * 🔎 Règle **tranchée** (chantier A5, 28/09/2026) : une **icône** en échec n'est PAS un échec de
     * passe — le sort est siphonné, seule son image manque, et elle est re-tentée au passage suivant.
     * La passe n'est rouge que si une **classe** a échoué (`failedRuns`). L'ambiguïté de la capture
     * user (« OK » à côté de « 204 icône(s) en échec ») venait de là : les deux chiffres étaient
     * additionnés dans une seule colonne « erreur(s) » sans dire lequel bloquait.
     */
    const iconsNote = totals.iconsFailed > 0
        ? `, ${totals.iconsFailed} icône(s) en échec (non bloquant — re-tenté au prochain passage)`
        : "";
    const summary =
        `Grimoires : ${totals.spells} sort(s) (${totals.grades} grades), ${totals.icons} icône(s) OK` +
        `${iconsNote}, ${failedRuns} classe(s) en échec.`;
    ctx.log(`🎉 ${summary}`);
    return { ok: failedRuns === 0, summary, error: failedRuns > 0 ? `${failedRuns} classe(s) en échec` : undefined };
}

/** Avis de recherche : un appel **par race** (mesuré : un appel unique de 60 s+ casse). */
async function runBounties(ctx: RunContext): Promise<InlineRunResult> {
    const totals = { synced: 0, unchanged: 0, total: 0, unproven: 0, images: 0, errors: 0, grades: 0, drops: 0 };
    let failedRaces = 0;
    /**
     * 🔢 Lot **complet** des erreurs (chantier A3) : la passe en produit ~96 (mesure 28/09/2026),
     * et l'ancien résumé n'en montrait que 3 lignes brutes. Ici on les garde toutes — le store les
     * regroupe par cause (« aucun butin référencé (92×) · fiche en échec (4×) »).
     */
    const errorMessages: string[] = [];

    for (let i = 0; i < BOUNTY_RACE_IDS.length; i++) {
        const raceId = BOUNTY_RACE_IDS[i] as number;
        const raceName = BOUNTY_RACE_NAMES[raceId] ?? `Race ${raceId}`;
        try {
            const res = await siphonBountiesRaceAction(raceId);
            if (res.success && res.data) {
                const d = res.data;
                totals.synced += d.synced;
                totals.unchanged += d.unchanged;
                totals.total += d.total;
                totals.unproven += d.unproven;
                totals.images += d.images;
                totals.grades += d.gradesBackfilled;
                totals.drops += d.dropsBackfilled;
                totals.errors += d.errors.length;
                errorMessages.push(...d.errors);
                ctx.log(
                    `✅ ${raceName} : ${d.total} avis (${d.synced} écrits, ${d.unchanged} inchangés, ${d.unproven} non prouvés, ${d.images} icônes, ${d.gradesBackfilled} stats relues, ${d.dropsBackfilled} butins relus)` +
                        (d.errors.length > 0 ? ` — ${d.errors.length} erreur(s)` : ""),
                );
            } else {
                failedRaces++;
                const reason = `${raceName} : ${res.error || "échec"}`;
                errorMessages.push(reason);
                ctx.log(`❌ ${reason} — passe suivante conservée.`);
            }
        } catch (e) {
            failedRaces++;
            const reason = `${raceName} : ${e instanceof Error ? e.message : String(e)}`;
            errorMessages.push(reason);
            ctx.log(`❌ ${reason} — passe suivante conservée.`);
        }
        await ctx.report(i + 1, BOUNTY_RACE_IDS.length, `Race ${i + 1}/${BOUNTY_RACE_IDS.length}`);
    }

    // 🧭 Détail **regroupé par cause** dans le journal live : l'opérateur voit d'un coup d'œil la
    // cause dominante (et son exemple), au lieu de 96 lignes rouges identiques.
    for (const line of formatGameDataErrorLines(errorMessages)) ctx.log(line);

    /**
     * 📊 Résumé **honnête** (chantier A5, 28/09/2026) : `unchanged` et `unproven` sont comptés par le
     * lanceur mais n'étaient **pas** affichés ⇒ « 0 écrits » se lisait « rien n'a marché » alors
     * qu'une passe normale réécrit peu et laisse des dizaines d'avis inchangés (capture user :
     * « 2 race(s) en échec » sans aucun chiffre lisible).
     */
    const summary =
        `Avis de recherche : ${totals.total} avis (${totals.synced} écrits, ${totals.unchanged} inchangés, ` +
        `${totals.unproven} non prouvés, ${totals.images} icônes, ${totals.errors + failedRaces} erreur(s)).`;
    ctx.log(`🎉 ${summary}`);
    return {
        ok: failedRaces === 0,
        summary,
        error: failedRaces > 0 ? `${failedRaces} race(s) en échec` : undefined,
        errors: errorMessages,
    };
}

/** Référentiels d'effets & de caractéristiques (libellés FR, icônes, « % ») — 1 appel. */
async function runReferentials(ctx: RunContext): Promise<InlineRunResult> {
    const res = await siphonMarketReferentials();
    if (!res.success || !res.data) {
        const error = res.error || "inconnue";
        ctx.log(`❌ Référentiels : ${error}`);
        return { ok: false, summary: "", error };
    }
    const d = res.data;
    ctx.log(
        `✅ Référentiels : ${d.characteristics}/${d.characteristicsTotal} caractéristique(s) (${d.characteristicsStored} en base), ` +
            `${d.effects}/${d.effectsTotal} effet(s) (${d.effectsStored} en base).`,
    );
    /**
     * 🚦 Deux causes **opposées** derrière le même mot « incomplet » (chantier A5, 28/09/2026) :
     *   · `throttledPages` — NOTRE budget partagé (30 req/min) a refusé la page : ce n'est pas une
     *     panne, la relance suffit ⇒ la passe **n'est pas peinte en rouge** ;
     *   · `failedPages` — DofusDB n'a pas rendu la page : là, c'est un échec (couverture partielle).
     * Avant ce lot, `ok: !d.truncated` faisait passer les deux pour une erreur, et le Tableau
     * affichait « Référentiel incomplet (2 page(s) en attente sur notre limite locale) » en rouge :
     * l'opérateur cherchait une panne DofusDB qui n'existait pas.
     */
    const throttleNote = d.throttledPages.length > 0
        ? `${d.throttledPages.length} page(s) en attente sur NOTRE limite locale (30 req/min partagées) — relancer pour compléter`
        : "";
    const failedNote = d.failedPages.length > 0
        ? `${d.failedPages.length} page(s) non rendues par DofusDB — relancer`
        : "";
    if (d.truncated) {
        ctx.log(
            failedNote
                ? `❌ Référentiel INCOMPLET : ${[failedNote, throttleNote].filter(Boolean).join(" · ")}.`
                : `⚠️ Référentiel incomplet : ${throttleNote} (ce n'est PAS une panne de DofusDB).`,
        );
    }
    if (d.orphanFmIds.length > 0) {
        ctx.log(`⚠️ Mapping FM : ${d.orphanFmIds.length} id(s) absents du référentiel (${d.orphanFmIds.join(", ")}).`);
    }
    const note = [failedNote, throttleNote].filter(Boolean).join(" · ");
    const summary =
        `Référentiels : ${d.effects} effet(s) et ${d.characteristics} caractéristique(s) lus, ` +
        `${d.effectsStored + d.characteristicsStored} en base.${note ? ` ⚠️ ${note}` : ""}`;
    await ctx.report(1, 1, summary);
    ctx.log(`🎉 ${summary}`);
    return {
        // Seule une page **non rendue par DofusDB** est un échec : notre propre cadence se rattrape.
        ok: d.failedPages.length === 0,
        summary,
        error: failedNote ? `Référentiel incomplet — ${failedNote}` : undefined,
    };
}


/** Quêtes : détection différentielle puis synchronisation de **tous** les écarts. */
async function runQuestDeltas(ctx: RunContext): Promise<InlineRunResult> {
    ctx.log("🔍 Analyse des écarts DofusDB (quêtes)…");
    const check = await checkDofusDbDeltas();
    if (!check.success || !check.data) {
        const error = check.error || "inconnue";
        ctx.log(`❌ Quêtes : ${error}`);
        return { ok: false, summary: "", error };
    }
    const ids = check.data.deltas.map((d) => d.dofusDbId);
    if (ids.length === 0) {
        const summary = `Quêtes : aucune modification (${check.data.totalLocal}/${check.data.totalRemote} à jour).`;
        ctx.log(`🎉 ${summary}`);
        return { ok: true, summary };
    }

    ctx.log(`⏳ ${ids.length} quête(s) à synchroniser…`);
    const res = await syncDeltas(ids);
    if (!res.success) {
        const error = res.error || "inconnue";
        ctx.log(`❌ Quêtes : ${error}`);
        return { ok: false, summary: "", error };
    }
    const summary = `Quêtes : ${res.count} synchronisée(s) sur ${ids.length} détectée(s).`;
    await ctx.report(ids.length, ids.length, summary);
    ctx.log(`🎉 ${summary}`);
    return { ok: true, summary };
}

/** Catalogue local (JSON donjons & monstres) — repli direct de CATALOGUE. */
async function runCatalogue(ctx: RunContext): Promise<InlineRunResult> {
    const res = await siphonDungeonMonstersDatasetAction();
    if (!res.success || !res.data) {
        const error = res.error || "inconnue";
        ctx.log(`❌ Catalogue : ${error}`);
        return { ok: false, summary: "", error };
    }
    const d = res.data;
    const summary = `Catalogue : ${d.totalDungeons} donjon(s), ${d.totalMonsters} monstre(s), ${d.totalBossFamilies} famille(s).`;
    ctx.log(`🎉 ${summary}`);
    return { ok: true, summary };
}

/** Zones & sous-zones — repli direct de ZONES (le worker, lui, appelle le cœur `src/lib`). */
async function runZones(ctx: RunContext): Promise<InlineRunResult> {
    const res = await syncZonesFromDofusDb();
    if (!res.success || !res.data) {
        const error = res.error || "inconnue";
        ctx.log(`❌ Zones : ${error}`);
        return { ok: false, summary: "", error };
    }
    const summary = `Zones : ${res.data.synced} synchronisée(s) sur ${res.data.total}.`;
    ctx.log(`🎉 ${summary}`);
    return { ok: true, summary };
}

/** Familles de monstres — repli direct de FAMILIES. */
async function runFamilies(ctx: RunContext): Promise<InlineRunResult> {
    const res = await syncMonsterFamiliesFromDofusDb();
    if (!res.success || !res.data) {
        const error = res.error || "inconnue";
        ctx.log(`❌ Familles : ${error}`);
        return { ok: false, summary: "", error };
    }
    const summary = `Familles : ${res.data.synced} famille(s), ${res.data.monstersSynced ?? 0} monstre(s).`;
    ctx.log(`🎉 ${summary}`);
    return { ok: true, summary };
}


/** Message d'attente affiché dans le tableau pendant le run inline. */
const INLINE_START_MESSAGE: Record<string, string> = {
    CLASS_SPELLS: "Grimoires de classes (DofusDB, classe par classe)",
    ASSETS_WEBP: "Images WebP manquantes (par lots de 5)",
    REFERENTIALS: "Référentiels (effets & caractéristiques)",
    QUESTS: "Quêtes (écarts DofusDB)",
    CATALOGUE: "Catalogue local (donjons & monstres)",
    BOUNTIES: "Avis de recherche (race par race)",
    ZONES: "Zones & sous-zones (DofusDB)",
    FAMILIES: "Familles de monstres (DofusDB)",
    ITEMS: "Items & ressources (DofusDB, lots de 100)",
};

/**
 * Lance **dans l'onglet** un dataset sans cœur `src/lib` (ou le repli direct d'un dataset
 * d'arrière-plan quand aucun worker n'écoute). Écrit l'état serveur
 * (`begin` / `report` / `finish`) ⇒ le Tableau suit le run, quelle que soit la porte
 * d'entrée. Renvoie un résumé lisible (jamais un faux pourcentage).
 */
export async function runInlineGameDataDataset(
    dataset: InlineRunnableDataset,
    options: InlineRunOptions = {},
): Promise<InlineRunResult> {
    const ctx = makeContext(dataset, options);
    await beginGameDataSync(dataset, null, INLINE_START_MESSAGE[dataset] ?? "Siphon en cours");

    let result: InlineRunResult;
    try {
        switch (dataset) {
            case "CLASS_SPELLS":
                result = await runClassSpellbooks(ctx);
                break;
            case "ASSETS_WEBP":
                result = await runAssetWebp(options.assetTargets, ctx);
                break;
            case "ITEMS":
                result = await runItemBatches(ctx);
                break;
            case "BOUNTIES":
                result = await runBounties(ctx);
                break;
            case "REFERENTIALS":
                result = await runReferentials(ctx);
                break;
            case "QUESTS":
                result = await runQuestDeltas(ctx);
                break;
            case "CATALOGUE":
                result = await runCatalogue(ctx);
                break;
            case "ZONES":
                result = await runZones(ctx);
                break;
            case "FAMILIES":
                result = await runFamilies(ctx);
                break;
        }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await finishGameDataSync(dataset, false, undefined, error, [error]);
        ctx.log(`❌ Exception : ${error}`);
        return { ok: false, summary: "", error };
    }

    // 🔢 `result.errors` = lot **complet** (le store en tire `lastError` chiffré + `errorGroups`) ;
    // `result.error` reste la phrase courte quand l'appelant en a une plus juste.
    await finishGameDataSync(dataset, result.ok, result.summary || undefined, result.error, result.errors);
    return result;
}

/** Images WebP : cibles imposées (« manquants affichés ») ou inventaire des manquantes. */
async function runAssetWebp(
    assetTargets: AssetSiphonTarget[] | undefined,
    ctx: RunContext,
): Promise<InlineRunResult> {
    let targets = assetTargets;
    if (!targets) {
        const inv = await getSiphonInventory({ status: "missing", limit: ASSET_SIPHON_MAX_TARGETS });
        if (!inv.success || !inv.data) {
            throw new Error(inv.error || "Inventaire des images indisponible");
        }
        targets = inv.data.items.filter((i) => !i.hasLocalImage);
    }
    if (targets.length === 0) {
        const summary = "Images WebP : rien à faire, tout est déjà en cache local.";
        ctx.log(`ℹ️ ${summary}`);
        return { ok: true, summary };
    }
    ctx.log(`🚀 ${targets.length} image(s) à siphonner — lots de ${ASSET_SIPHON_CHUNK_SIZE}…`);
    return siphonAssetTargets(targets, ctx);
}


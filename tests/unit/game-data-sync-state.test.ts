import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    GAME_DATA_AUTO_SYNC_DATASETS,
    GAME_DATA_BACKGROUND_DATASETS,
    GAME_DATA_DATASETS,
    GAME_DATA_DATASET_LABEL,
    GAME_DATA_INLINE_DATASETS,
    GAME_DATA_SCRIPT_DATASETS,
    GAME_DATA_WATCH_DATASETS,
    computePercent,
    emptyGameDataRunState,
    gameDataLaunchKind,
    isAutoSyncDataset,
    isWatchedDataset,
} from "@/lib/game-data-sync-state";

const read = (p: string) => readFileSync(p, "utf8");

/**
 * Gardes du chantier « game-data : état par dataset + arrière-plan » (22/09/2026).
 *
 * Audit mesuré : la barre de progression n'était branchée que sur 2 boutons sur 4
 * (`progressValue` local) ⇒ « En cours… 0 % » faux ; aucun état lisible avant clic ;
 * siphons pilotés par le navigateur (fermer l'onglet = tout perdu, 429 en boucle).
 */
describe("game-data — état des datasets (progression vraie)", () => {
    it("le pourcentage est calculé, borné, et `null` quand le total est inconnu", () => {
        expect(computePercent(0, 5)).toBe(0);
        expect(computePercent(5, 5)).toBe(100);
        expect(computePercent(1, 3)).toBe(33);
        expect(computePercent(12, 10)).toBe(100); // borné
        expect(computePercent(-3, 10)).toBe(0); // borné
        // Pas de total ⇒ `null` : l'UI dit « total inconnu », elle n'affiche PAS un faux 0 %.
        expect(computePercent(5, null)).toBeNull();
        expect(computePercent(5, 0)).toBeNull();
        expect(computePercent(5, undefined)).toBeNull();
    });

    it("un dataset jamais lancé est `IDLE` et n'affiche aucune progression", () => {
        const state = emptyGameDataRunState("CATALOGUE");
        expect(state.status).toBe("IDLE");
        expect(state.percent).toBeNull();
        expect(state.total).toBeNull();
        expect(state.startedAt).toBeNull();
        expect(state.lastError).toBeNull();
    });

    it("les 11 datasets du dashboard ont un libellé (aucune ligne muette)", () => {
        expect(GAME_DATA_DATASETS.length).toBe(11);
        for (const dataset of GAME_DATA_DATASETS) {
            expect(GAME_DATA_DATASET_LABEL[dataset]?.length).toBeGreaterThan(3);
        }
    });

    it("le panneau d'état est monté UNE fois, dans le tableau — et route vers le bon outil", () => {
        const code = read("src/components/admin/GameDataInterface.tsx");
        expect(code).toContain("<GameDataSyncStatePanel onGo={goTo} />");
        // Refonte du 22/09/2026 : plus de doublon du tableau sur 2 onglets.
        expect(code.match(/<GameDataSyncStatePanel/g)?.length).toBe(1);
        // 15 onglets → 4 entrées (fin de la barre qui débordait).
        expect(code).toContain('{ id: "tableau", label: "📊 Tableau" }');
        expect(code).toContain('{ id: "siphons", label: "🛰️ Siphons DofusDB" }');
        expect(code).toContain('{ id: "editeurs", label: "📚 Éditeurs" }');
        expect(code).toContain('{ id: "outils", label: "🧰 Outils locaux" }');
        // Les 10 référentiels sont en maître/détail, pas dans la barre d'onglets.
        expect(code.match(/<TabsTrigger/g)?.length).toBe(1); // un seul trigger, mappé sur les 4 entrées
        expect(code).toContain("{EDITORS.map((entry) => {");
    });

    it("les 3 outils SANS RÉSEAU sont déplacés, pas dupliqués (§4.3)", () => {
        const tools = read("src/components/admin/GameDataLocalToolsPanel.tsx");
        expect(tools).toContain("Rattraper les effets natifs");
        expect(tools).toContain("Purger les libellés d'effets gabarits");
        expect(tools).toContain("Associer familles (auto)");
        // Retirés de leurs panneaux d'origine : une action = un seul bouton.
        const items = read("src/components/admin/GameItemSiphonPanel.tsx");
        expect(items).not.toContain("Rattraper les effets natifs");
        expect(items).not.toContain("handlePurgeEffectLabels");
        const zones = read("src/components/admin/ZoneManager.tsx");
        expect(zones).not.toContain("Associer familles (auto)");
        expect(zones).not.toContain("handleAssociateFamilies");
    });

    it("les 3 outils locaux ne mentent plus sur un « 0 » (mesure 23/09/2026)", () => {
        const tools = read("src/components/admin/GameDataLocalToolsPanel.tsx");
        // Ancien message **faux** : « les zones gérées ne matchent pas celles des archis ».
        // Mesure en base : 1 765 archis portent une zone, 348 zones gérées matchent, et
        // 348/348 sont déjà liées ⇒ c'est un « déjà à jour », jamais un échec.
        expect(tools).not.toContain("les zones gérées ne matchent pas celles des archis");
        // Les 3 cas « rien à faire » sont nommés explicitement.
        expect(tools).toContain("aucune fiche en attente");
        expect(tools).toContain("rien à réparer");
        expect(tools).toContain("déjà à jour");
        // Compteurs qui rendent ces messages possibles (contrats de retour).
        const actions = read("src/server/actions/game-data-actions.ts");
        expect(actions).toContain("matchedZones");
        expect(actions).toContain("alreadyUpToDate");
        // 2ᵉ voie de la purge : libellé réel dé-punctuarisé, sans invention. La règle pure
        // vit dans `src/lib/market/effects.ts`, à côté de `isPlaceholderStatLabel` (§7.2).
        const effects = read("src/lib/market/effects.ts");
        expect(effects).toContain("cleanTemplateBraces");
        expect(tools).toContain("cleaned");
    });

    it("le panneau n'invente plus de pourcentage (jamais de faux 0 %)", () => {
        const code = read("src/components/admin/GameDataSiphonPanel.tsx");
        expect(code).not.toContain("isSiphoning ? `${progressValue}%`");
        expect(code).toContain('progressValue > 0 ? `${progressValue} %` : "en cours…"');
    });
});

describe("game-data — siphons en arrière-plan (file + worker)", () => {
    it("la file est nommée, idempotente par dataset, et n'accepte que les cœurs `lib`", () => {
        const queue = read("src/lib/queue/game-data-queue.ts");
        expect(queue).toContain('GAME_DATA_QUEUE_NAME = "game-data-sync"');
        expect(queue).toContain("jobId: `game-data-${dataset}`");
        expect(queue).toContain("attempts: 3");
        expect(queue).toContain("backoff");
        const state = read("src/lib/game-data-sync-state.ts");
        expect(state).toContain(
            'GAME_DATA_BACKGROUND_DATASETS = ["CATALOGUE", "ANOMALY_BOSSES", "ZONES", "FAMILIES", "BOUNTIES", "ITEMS", "REFERENTIALS", "QUESTS"] as const',
        );
        // ⚠️ Garde anti-régression (incident du 22/09/2026 : `Can't resolve 'dns'`) :
        // ce module est importé par un composant CLIENT ⇒ il ne doit tirer NI `bullmq`
        // NI `@/lib/redis` (ioredis) dans le bundle navigateur. Le Redis vit dans
        // `src/server/game-data-sync-state-store.ts`.
        expect(state).not.toContain('from "bullmq"');
        expect(state).not.toContain("lib/redis");
        expect(read("src/server/game-data-sync-state-store.ts")).toContain('await import("@/lib/redis")');
    });

    it("le worker est ENREGISTRÉ dans le worker principal (sinon il ne tourne jamais en prod)", () => {
        const main = read("src/workers/metamob-worker.ts");
        expect(main).toContain('import { gameDataWorker } from "./game-data-worker"');
        expect(main).toContain("await gameDataWorker.close()");
    });

    it("le worker appelle les cœurs déjà en `src/lib` et persiste l'état", () => {
        const worker = read("src/workers/game-data-worker.ts");
        expect(worker).toContain('await import("../lib/dungeon-monsters-siphon")');
        expect(worker).toContain('await import("../lib/bounty-siphon")');
        expect(worker).toContain("beginGameDataRun(");
        expect(worker).toContain("finishGameDataRun(");
        // Échec définitif irrécupérable (dataset inconnu) → pas de retry inutile.
        expect(worker).toContain("UnrecoverableError");
    });

    it("la mise en file est FAIL-CLOSED : sans worker actif, on refuse (pas de job fantôme)", () => {
        const actions = read("src/server/actions/game-data-sync-actions.ts");
        expect(actions).toContain("await gameDataQueue.getWorkers()");
        expect(actions).toMatch(/workers\.length === 0/);
        expect(actions).toContain("Aucun worker en arrière-plan n'écoute la file");
    });

    it("les cœurs ZONES/FAMILIES vivent en `src/lib` (une seule implémentation, §4.3)", () => {
        const actions = read("src/server/actions/game-data-actions.ts");
        // Les boucles réseau ont QUITTÉ les server actions (elles y tournaient dans le navigateur)…
        expect(actions).not.toContain("api.dofusdb.fr/monster-races?$limit=50");
        expect(actions).not.toContain("api.dofusdb.fr/subareas?$limit=50");
        expect(actions).toContain("await syncZonesFromDofusDbCore()");
        expect(actions).toContain("await syncMonsterFamiliesCore()");
        // …et vivent ici, exécutables sans session Next.
        const zones = read("src/lib/zones-siphon.ts");
        expect(zones).toContain("export async function syncZonesFromDofusDbCore");
        expect(zones).toContain("api.dofusdb.fr/subareas?$limit=50");
        expect(zones).toContain("isIgnoredZone");
        const families = read("src/lib/monster-families-siphon.ts");
        expect(families).toContain("export async function syncMonsterFamiliesCore");
        expect(families).toContain("api.dofusdb.fr/monster-races?$limit=50");
        expect(families).toContain("isIgnoredFamily");
    });

    it("les listes d'exclusion ont UNE source (`src/lib/game-data-ignores`) : le worker filtre comme le dashboard", () => {
        const ignores = read("src/lib/game-data-ignores.ts");
        expect(ignores).toContain("export function isIgnoredFamily");
        expect(ignores).toContain("export function isIgnoredZone");
        expect(ignores).toContain("ignored-families.json");
        expect(ignores).toContain("ignored-zones.json");
        const actions = read("src/server/actions/game-data-actions.ts");
        expect(actions).toContain('from "@/lib/game-data-ignores"');
        // Plus aucune copie locale (une suppression ne doit jamais être annulée par un siphon).
        expect(actions).not.toContain("const DEFAULT_IGNORED_FAMILY_PATTERNS");
        expect(actions).not.toContain("function isIgnoredZone");
    });

    it("le worker lance les 8 datasets éligibles et remonte une progression RÉELLE", () => {
        const worker = read("src/workers/game-data-worker.ts");
        expect(worker).toContain('await import("../lib/zones-siphon")');
        expect(worker).toContain('await import("../lib/monster-families-siphon")');
        expect(worker).toContain('await import("../lib/anomaly-boss-siphon")');
        expect(worker).toContain('await import("../lib/game-items-siphon")');
        expect(worker).toContain('await import("../lib/market/referential-siphon")');
        expect(worker).toContain('await import("../lib/quest-siphon")');
        expect(worker).toContain('reportGameDataProgress("ZONES"');
        expect(worker).toContain('reportGameDataProgress("FAMILIES"');
        expect(worker).toContain('reportGameDataProgress("ITEMS"');
    });

    it("le cœur ITEMS vit en `src/lib/game-items-siphon.ts` (enveloppe mince, §4.3)", () => {
        const actions = read("src/server/actions/game-item-actions.ts");
        // La boucle réseau (218 allers-retours) et l'écriture `GameItem` ont QUITTÉ la
        // server action : elles tournaient dans le navigateur, un lot = un aller-retour.
        expect(actions).not.toContain("api.dofusdb.fr/items?$limit=${safeLimit}");
        expect(actions).not.toContain("hashPayload");
        expect(actions).not.toContain("siphonAndCompressImage(remoteImg");
        // …et l'action reste l'ENVELOPPE : garde fail-closed + cœur, retour INCHANGÉ.
        expect(actions).toContain("await canManageGameItems()");
        expect(actions).toContain("await siphonGameItemsBatchCore(skip, limit)");
        expect(actions).toContain("totalProcessed: batch.totalProcessed");
        // Le lancement « dans l'onglet » boucle sur la MÊME signature — mais depuis le
        // lanceur partagé (le panneau Items ne lance plus, voir le test ci-dessous).
        const runners = read("src/components/admin/game-data-inline-runners.ts");
        expect(runners).toContain("siphonGameItemsBatch(skip, GAME_ITEMS_BATCH_SIZE)");
        // ⚠️ Garde anti-régression (build cassé le 23/09/2026) : le lanceur client importe
        // la cadence depuis le module PUR — jamais le cœur (`sharp`/`fs` dans le navigateur).
        expect(runners).toContain('from "@/lib/game-items-cadence"');
        expect(runners).not.toContain("game-items-siphon");
        // Le cœur, lui, porte les invariants du siphon — à l'identique.
        const core = read("src/lib/game-items-siphon.ts");
        expect(core).toContain("export async function siphonGameItemsBatchCore");
        expect(core).toContain("export async function siphonAllGameItemsCore");
        expect(core).toContain("api.dofusdb.fr/items?$limit=${safeLimit}&$skip=${skip}");
        expect(core).toContain("crypto.createHash('md5')");
        expect(core).toContain("where: { ankamaId }");
        expect(core).toContain("siphonAndCompressImage(imageSrc, 'items', ankamaId).catch(() => {})");
        expect(core).toContain("resolveMarketItemFamily({ typeId, superTypeId, typeName })");
        // Cadence du limiteur partagé : 100 par lot, ~2,1 s entre deux lots (fin des 429).
        // Les valeurs vivent dans le module PUR `game-items-cadence` (client-safe), que le
        // cœur réexporte — une seule source, deux étages (voir le build cassé du 23/09).
        const cadence = read("src/lib/game-items-cadence.ts");
        expect(cadence).toContain("GAME_ITEMS_BATCH_SIZE = 100");
        expect(cadence).toContain("GAME_ITEMS_BATCH_PAUSE_MS = 2_100");
        expect(core).toContain("from '@/lib/game-items-cadence'");
    });

    it("chaque dataset dit COMMENT il se lance : 3 modes qui partitionnent les 11 (plus de renvoi « ci-dessous »)", () => {
        // Les 3 modes couvrent TOUS les datasets, sans recouvrement (aucun dataset orphelin).
        expect(
            GAME_DATA_BACKGROUND_DATASETS.length + GAME_DATA_INLINE_DATASETS.length + GAME_DATA_SCRIPT_DATASETS.length,
        ).toBe(GAME_DATA_DATASETS.length);
        expect(gameDataLaunchKind("CATALOGUE")).toBe("BACKGROUND");
        expect(gameDataLaunchKind("ITEMS")).toBe("BACKGROUND");
        expect(gameDataLaunchKind("CLASS_SPELLS")).toBe("INLINE");
        expect(gameDataLaunchKind("ASSETS_WEBP")).toBe("INLINE");
        // Cœurs descendus en `lib` le 23/09/2026 : ces siphons partent en file.
        expect(gameDataLaunchKind("REFERENTIALS")).toBe("BACKGROUND");
        expect(gameDataLaunchKind("QUESTS")).toBe("BACKGROUND");
        // Récoltables : le JSON vient d'un script local — le tableau ne promet plus un bouton.
        expect(gameDataLaunchKind("HARVEST")).toBe("SCRIPT");
        // Garde anti-impasse : tout dataset « dans l'onglet » a VRAIMENT une branche de lancement.
        const runners = read("src/components/admin/game-data-inline-runners.ts");
        for (const dataset of GAME_DATA_INLINE_DATASETS) {
            expect(runners).toContain(`case "${dataset}":`);
        }
        expect(runners).not.toContain("case \"HARVEST\":");
    });

    it("le tableau est le SEUL point de lancement (plus de doublon dans les pages, §4.3)", () => {
        const panel = read("src/components/admin/GameDataSyncStatePanel.tsx");
        expect(panel).not.toContain("Bouton direct ci-dessous");
        expect(panel).toContain("gameDataLaunchKind(state.dataset)");
        expect(panel).toContain('"Lancer ici"');
        expect(panel).toContain('"Ici"');
        // Les lancements GÉNÉRIQUES ont quitté les panneaux…
        const siphon = read("src/components/admin/GameDataSiphonPanel.tsx");
        expect(siphon).not.toContain("Régénérer le catalogue JSON");
        expect(siphon).not.toContain("Siphonner les avis de recherche");
        expect(siphon).not.toContain("Pré-chauffer sorts de classes");
        expect(siphon).not.toContain("warmClassSpellbook(");
        expect(siphon).not.toContain("siphonBountiesRaceAction(");
        // …l'action CONTEXTUELLE reste (manquants affichés) et passe par le lanceur partagé.
        expect(siphon).toContain("Siphonner les manquants affichés");
        expect(siphon).toContain('runInlineGameDataDataset("ASSETS_WEBP"');
        // …et vivent, à l'identique, dans UNE seule implémentation.
        const runners = read("src/components/admin/game-data-inline-runners.ts");
        expect(runners).toContain("export async function runInlineGameDataDataset");
        expect(runners).toContain("warmClassSpellbook(classId)");
        expect(runners).toContain("siphonBountiesRaceAction(raceId)");
        expect(runners).toContain("siphonGameItemsBatch(skip, GAME_ITEMS_BATCH_SIZE)");
        expect(runners).toContain("GAME_ITEMS_BATCH_PAUSE_MS");
        expect(runners).toContain("siphonDungeonMonstersDatasetAction()");
        expect(runners).toContain("syncZonesFromDofusDb()");
        expect(runners).toContain("syncMonsterFamiliesFromDofusDb()");
        // Les éditeurs ne doublonnent plus ZONES/FAMILIES (leur bouton vit au tableau).
        expect(read("src/components/admin/ZoneManager.tsx")).not.toContain("Sync Zones (DofusDB)");
        expect(read("src/components/admin/MonsterFamilyManager.tsx")).not.toContain("Sync Familles (DofusDB)");
        // Le panneau Items ne lance plus rien : il renvoie au tableau.
        const items = read("src/components/admin/GameItemSiphonPanel.tsx");
        expect(items).not.toContain("siphonGameItemsBatch(");
        expect(items).not.toContain("siphonMarketReferentials(");
        expect(items).toContain("📊 Tableau");
        // La mise en file renvoie vers le bon bouton quand aucun worker n'écoute.
        expect(read("src/server/actions/game-data-sync-actions.ts")).toContain("Aucun worker en arrière-plan n'écoute la file");
        expect(read("src/server/actions/game-data-sync-actions.ts")).toContain("« ▶ Ici »");
    });

    it("le God voit ce qui se passe : journal live des runs « dans l'onglet » + erreurs lisibles", () => {
        // Constat user du 23/09/2026 : les erreurs s'empilaient dans le terminal serveur et
        // l'écran God ne montrait RIEN. Le lanceur remonte désormais son journal au tableau.
        const panel = read("src/components/admin/GameDataSyncStatePanel.tsx");
        expect(panel).toContain("setJournal({ dataset, lines: [] })");
        expect(panel).toContain("log: (line) =>");
        expect(panel).toContain("Journal — ");
        expect(panel).not.toContain("runInlineGameDataDataset(dataset);");

        // Cause racine des « Error: {} » ×20 : 2 `fetch()` bruts dans `getMonsterStats`
        // contournaient le limiteur partagé (30 req/min) ⇒ 429 local en boucle.
        const actions = read("src/server/actions/game-data-actions.ts");
        expect(actions).not.toMatch(/(?<!Db)fetch\(`https:\/\/api\.dofusdb\.fr/);
        expect(actions).not.toContain('throw new Error("DofusDB search failed")');
        expect(actions).not.toContain('throw new Error("DofusDB details failed")');
        // Le refus de quota est EXPLICITE (nom du monstre + raison), plus un throw opaque.
        expect(actions).toContain("Quota DofusDB atteint (429)");

        // Le message d'une erreur ne doit plus être perdu à la sérialisation.
        const logger = read("src/lib/logger.ts");
        expect(logger).toContain("value instanceof Error");
        expect(logger).toContain("'apikey'");
    });

    it("chaque éditeur ne garde QUE ses sources propres (aucun doublon du Tableau dans les pages)", () => {
        // Audit du 23/09/2026 après « on garde les boutons dans les pages ?? » : les éditeurs
        // gardent leurs sources **non couvertes** par les 11 datasets, et rien d'autre.
        const dungeons = read("src/components/admin/DungeonManager.tsx");
        // « Siphonner les boss d'anomalie » = dataset ANOMALY_BOSSES ⇒ retiré (doublon).
        expect(dungeons).not.toContain("siphonAnomalyBossesNow");
        // …et la décision reste TRACÉE dans le fichier (pourquoi ce n'est pas un oubli).
        expect(dungeons).toContain("a été RETIRÉ");
        // Archis & Boss : 3 sources propres à l'éditeur (aucun dataset ne les couvre) ⇒ gardées,
        // et EXPLIQUÉES à l'écran (c'est ce qui manquait pour comprendre).
        const archi = read("src/components/admin/ArchimonstreManager.tsx");
        expect(archi).toContain("syncOcreArchimonstres()");
        expect(archi).toContain("syncDofusBosses()");
        expect(archi).toContain("syncWorldMonsters({ skip, batchSize: 50 })");
        expect(archi).toContain("aucune n&apos;est un dataset du 📊 Tableau");
        // Quêtes : l'import initial (masse, avec plafond) n'est PAS le dataset QUESTS (écarts)
        // ⇒ gardé, mais son texte ne doit plus renvoyer à un panneau « ci-dessous » inexistant.
        const quests = read("src/components/admin/QuestSiphonPanel.tsx");
        expect(quests).toContain("siphonQuestsFromDofusDB(");
        expect(quests).not.toContain("le panneau « Synchronisation » ci-dessous");
        expect(quests).toContain("📊 Tableau");
    });
});

/**
 * 🔭 Veille ciblée + bilan de passe (23/09/2026).
 *
 * Demandes user (verbatim) : « on siphonne vraiment tous DofusDB … pour l'autonomie 100 % ? »,
 * « est-ce que ça détecte s'il y a des changements (nom d'un item, ligne caractéristique,
 * effets…) ? », « ça resiphonne l'item mis à jour ? », « y a des notifs god ? des lancements
 * auto des siphon intelligemment ? ». Mesures faites avant de coder (API DofusDB) :
 *   · `items?updatedAt[$gt]=<date>` = filtre **réel** (date future ⇒ 0 résultat) ;
 *   · 30 jours glissants ⇒ **46 items** (au lieu de 21 776) ; `createdAt[$gt]=2026-09-01` ⇒ 28 ;
 *   · `$sort` / `$order` / `$select` ⇒ **HTTP 400** (pas de tri ni de projection) ;
 *   · `isDeprecated=true` ⇒ 0 (aucun item retiré du jeu aujourd'hui).
 * Et le trou trouvé côté hash : `description`, `typeId` et l'image étaient **stockés mais
 * absents du hash** ⇒ un item dont seule la description changeait n'était jamais réécrit.
 */
describe("game-data — veille ciblée & bilan de passe", () => {
    it("le registre de veille est cohérent : AUTO ⊆ WATCH ⊆ BACKGROUND", () => {
        for (const dataset of GAME_DATA_WATCH_DATASETS) {
            expect(GAME_DATA_BACKGROUND_DATASETS).toContain(dataset);
        }
        for (const dataset of GAME_DATA_AUTO_SYNC_DATASETS) {
            expect(GAME_DATA_WATCH_DATASETS).toContain(dataset);
        }
        expect(isWatchedDataset("ITEMS")).toBe(true);
        expect(isAutoSyncDataset("ITEMS")).toBe(true);
        // HARVEST est « SCRIPT » (fichier produit localement) : ni veille, ni auto.
        expect(isWatchedDataset("HARVEST")).toBe(false);
        expect(isAutoSyncDataset("HARVEST")).toBe(false);
    });

    it("un état vierge ne prétend pas connaître un bilan", () => {
        expect(emptyGameDataRunState("ITEMS").counts).toBeNull();
    });

    it("le cœur ITEMS filtre par date, couvre tout le stocké, et ne perd rien au plafond", () => {
        const core = read("src/lib/game-items-siphon.ts");
        // Filtre mesuré comme réel côté DofusDB.
        expect(core).toContain("updatedAt[$gt]");
        expect(core).toContain("export async function siphonGameItemsIncrementalCore");
        // Plafond : on s'arrête sans faire avancer le filigrane (reprise au même `skip`).
        expect(core).toContain("if (hasMore && processed >= maxItems)");
        expect(core).toContain("truncated = true");
        // Le hash couvre désormais TOUT ce qu'on persiste (il en manquait trois).
        expect(core).toContain("name, level, description, typeId, imageSrc, typeName, effects, hasRecipe,");
    });

    it("le worker n'avance le filigrane que sur une passe complète, et écrit le bilan", () => {
        const worker = read("src/workers/game-data-worker.ts");
        expect(worker).toContain("job.data?.incremental === true");
        expect(worker).toContain("since: result.truncated ? watch.since : result.nextWatermark ?? watch.since");
        expect(worker).toContain("counts: { inserted: result.inserted, updated: result.updated, unchanged }");
    });

    it("le cron de veille met la passe ciblée en file au lieu de seulement alerter", () => {
        const cron = read("src/app/api/cron/data-watch/route.ts");
        expect(cron).toContain("GAME_DATA_AUTO_SYNC_DATASETS");
        expect(cron).toContain("enqueueGameDataSync(dataset, { incremental: true })");
        // La machine ne supprime jamais : le message de notif le dit explicitement.
        expect(cron).toContain("Aucune suppression n'est automatique");
        const store = read("src/server/game-data-sync-state-store.ts");
        expect(store).toContain("game-data:watch:");
        expect(store).toContain("export async function setGameDataWatchState");
    });

    it("le Tableau montre le bilan chiffré et un bouton de veille explicite", () => {
        const panel = read("src/components/admin/GameDataSyncStatePanel.tsx");
        expect(panel).toContain("state.counts.inserted");
        expect(panel).toContain("launchWatch");
        expect(panel).toContain("🔭 Veille");
    });
});

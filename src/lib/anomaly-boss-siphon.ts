/**
 * SIPHON « boss d'anomalie » — Gardiens des anomalies temporelles (Dofensive + DofusDB).
 *
 * Contrat (règle de la maison : le contenu n'est JAMAIS saisi à la main) :
 *  1. **Liste** = DofusDB `monsters?race=191` (« Gardiens des anomalies », 16 entités dont Qilby).
 *     DofusDB est la source de vérité de l'APPARTENANCE (Dofensive n'expose pas de liste).
 *  2. **Carte de combat + famille** = Dofensive `/monsters/{id}` (`PreferredMaps`, `Race`, `Family`,
 *     `Type`). Un gardien absent de Dofensive (dernier-né, ex. Qilby 8131) reçoit la
 *     **map par défaut** (`DEFAULT_ANOMALY_MAP`) : jamais de map vide (exigence produit).
 *  3. **Sorts de combat** = Dofensive `/spells/{id}` (source de vérité combat). Si le gardien
 *     n'est pas exposé par Dofensive, les sorts sont RECONSTRUITS depuis DofusDB
 *     (`spells?` + `spell-levels?` : AP, portée, LdV, ligne/diagonale, critique, zone) afin
 *     que la **simulation isométrique** fonctionne malgré tout.
 *  4. **Icônes** = DofusDB (`img/spells/sort_<iconId>.png` + `img/monsters/<gfxId>.png`),
 *     compressées en WebP sur disque : zéro dépendance CDN à l'exécution.
 *  5. **Écriture** = une ligne `Dungeon` par gardien boss (`name` = carte, `bossName` = gardien,
 *     `isAnomalyBoss` + `isNoAchievement` → pseudo-succès « Donjon validé ») + une fiche
 *     `MonsterStat` (stats DofusDB enrichies, sorts de combat fusionnés) + la map
 *     `DofensiveMap` (grille isométrique). Idempotent : relançable sans effet de bord.
 *
 * Appelé par le cron `sync-monster-stats` (une seule passe nocturne, pas de nouveau crontab)
 * et par le bouton God « Siphonner les boss d'anomalie ».
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { dofensiveFetch } from "@/lib/dofensive-fetch";
import { DB_READABLE, persistMonsterStat, siphonDofensiveMapById } from "@/lib/dofensive-sync";
import { mergeDofensiveSpells, type DofensiveSpellCombat } from "@/lib/dofensive-spells";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";
import { attachNoAchievementToDungeon } from "@/lib/dungeon-no-achievement";
import {
    ANOMALY_COMPANION_FAMILY_ID,
    ANOMALY_COMPANION_PICK,
    ANOMALY_COMPANION_RACE_IDS,
    ANOMALY_FAMILY_NAME,
    ANOMALY_RACE_ID,
    ANOMALY_RACE_NAME,
    DEFAULT_ANOMALY_MAP,
    anomalyDofensiveUrl,
    anomalyDofusDbUrl,
    buildAnomalyDungeonName,
    groupAnomalyGuardiansByMap,
    isAnomalyCompanion,
    orderAnomalyCompanions,
    pickAnomalyBossEntries,
    resolveAnomalyMap,
    toAnomalyZone,
    type AnomalyMonsterRef,
} from "@/lib/anomaly-boss";

/** Gardien d'anomalie résolu (sortie du siphon — utilisée par la télémétrie/God). */
export interface AnomalyGuardian {
    id: number;
    name: string;
    level: number;
    isBoss: boolean;
    imageUrl: string | null;
    mapId: number;
    mapName: string;
    isDefaultMap: boolean;
    family: string;
    source: "DOFENSIVE" | "DOFUSDB";
    spells: number;
    /** Co-gardiens de la même carte (les « monstres de salle » de l'anomalie). */
    siblings: string[];
}


// ─── Helpers purs (testables sans réseau ni base) ────────────────────────────

/** Normalise la réponse Dofensive `/monsters/{id}` (métadonnées d'un gardien). */
export function normalizeDofensiveGuardian(raw: unknown): {
    preferredMaps: { id: number; name: string }[];
    raceName: string | null;
    familyName: string | null;
    type: number | null;
} {
    const d = (raw ?? {}) as any;
    const maps: any[] = Array.isArray(d?.PreferredMaps) ? d.PreferredMaps : [];
    const preferredMaps = maps
        .map((m) => ({ id: Math.floor(Number(m?.Id) || 0), name: String(m?.Name ?? "").trim() }))
        .filter((m) => m.id > 0);
    return {
        preferredMaps,
        raceName: d?.Race?.Name ? String(d.Race.Name) : null,
        familyName: d?.Family?.Name ? String(d.Family.Name) : null,
        type: Number.isFinite(Number(d?.Type)) ? Number(d.Type) : null,
    };
}

/** IDs des sorts d'un monstre DofusDB (`spells` + `grades[].startingSpellId`). */
export function pickAnomalySpellIds(monster: any): number[] {
    const ids: number[] = [];
    const push = (value: unknown) => {
        const n = Math.floor(Number(value));
        if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
    };
    for (const s of Array.isArray(monster?.spells) ? monster.spells : []) push(s);
    for (const g of Array.isArray(monster?.grades) ? monster.grades : []) push(g?.startingSpellId);
    return ids;
}

/**
 * Reconstruit des sorts de combat « Dofensive-compatibles » depuis DofusDB.
 *
 * Indispensable pour les gardiens NON exposés par Dofensive (Qilby) : sans cela la
 * simulation isométrique (`SpellRangeGrid`) n'aurait ni AP, ni portée, ni zone.
 * Les libellés d'effets viennent de la description DofusDB déjà formatée en FR par
 * `getMonsterStats` (`parseEffects`) — on n'invente aucun texte.
 */
export function buildCombatSpellsFromDofusDb(dbSpells: any[], levels: any[]): DofensiveSpellCombat[] {
    // Un seul niveau par sort : le plus haut grade (= comportement des fiches boss).
    const bestBySpell = new Map<number, any>();
    for (const lvl of Array.isArray(levels) ? levels : []) {
        const sid = Math.floor(Number(lvl?.spellId));
        if (!Number.isFinite(sid) || sid <= 0) continue;
        const current = bestBySpell.get(sid);
        if (!current || (Number(lvl?.grade) || 0) >= (Number(current?.grade) || 0)) bestBySpell.set(sid, lvl);
    }

    const out: DofensiveSpellCombat[] = [];
    for (const spell of Array.isArray(dbSpells) ? dbSpells : []) {
        const sid = Math.floor(Number(spell?.id));
        if (!Number.isFinite(sid) || sid <= 0) continue;
        const lvl = bestBySpell.get(sid);
        const description = String(spell?.description ?? "").trim();
        const zoneEffect = (Array.isArray(lvl?.effects) ? lvl.effects : []).find((e: any) => e?.zoneDescr);
        out.push({
            id: sid,
            name: String(spell?.name ?? ""),
            imageUrl: typeof spell?.imageUrl === "string" ? spell.imageUrl : undefined,
            apCost: Number(lvl?.apCost ?? spell?.apCost) || 0,
            minRange: Number(lvl?.minRange ?? spell?.minRange) || 0,
            range: Number(lvl?.range ?? spell?.range) || 0,
            castTestLos: lvl?.castTestLos ?? spell?.castTestLos ?? true,
            castInLine: !!lvl?.castInLine,
            castInDiagonal: !!lvl?.castInDiagonal,
            criticalChance: Number(lvl?.criticalHitProbability) || 0,
            maxCastPerTurn: Number(lvl?.maxCastPerTurn) || 0,
            maxCastPerTarget: Number(lvl?.maxCastPerTarget) || 0,
            minCastInterval: Number(lvl?.minCastInterval) || 0,
            description: description || undefined,
            grade: Number(lvl?.grade) || undefined,
            effects: description ? [description] : [],
            hasCriticalEffects: false,
            zone: toAnomalyZone(zoneEffect?.zoneDescr),
        });
    }
    return out;
}

export interface AnomalyBossSyncResult {
    synced: number;
    unchanged: number;
    errors: string[];
    imagesSiphoned: number;
    guardians: AnomalyGuardian[];
    /** Monstres de l'anomalie (accompagnateurs Briko/Bruto/Gromo) — rattachés par la famille 35. */
    companions: AnomalyCompanion[];
}

/**
 * Accompagnateur d'anomalie résolu (sortie du siphon — télémétrie God + fiche).
 * `familyId` = famille Dofensive lue sur la source (`null` = Dofensive injoignable).
 * `validated` = `familyId === ANOMALY_COMPANION_FAMILY_ID` (appartenance PROUVÉE, jamais déduite).
 */
export interface AnomalyCompanion extends AnomalyMonsterRef {
    raceId: number;
    raceName: string | null;
    familyId: number | null;
    validated: boolean;
    imageUrl: string | null;
}

// ─── Siphon ──────────────────────────────────────────────────────────────────

const CONCURRENCY = 4;

/** Borne la concurrence réseau (politesse : jamais de pic, cf. PLAN-REFONTE-SIPHON §5.3). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(limit, queue.length || 1) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift()!;
            await fn(item);
        }
    });
    await Promise.all(workers);
    return [];
}

/** Niveau « affiché » d'un gardien : dernier grade DofusDB (sinon 200). */
function guardianLevel(monster: any): number {
    const grades: any[] = Array.isArray(monster?.grades) ? monster.grades : [];
    const last = grades[grades.length - 1] ?? grades[0];
    const level = Number(last?.level);
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 200;
}

/** Niveaux de sorts DofusDB (`spell-levels?spellId[$in][]=…`) — repli sans Dofensive. */
async function fetchSpellLevels(spellIds: number[]): Promise<any[]> {
    const ids = spellIds.filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return [];
    const query = ids.map((id) => `spellId[$in][]=${id}`).join("&");
    const data = await dofusdbFetch<any[]>(`/spell-levels?${query}&$limit=50&lang=fr`);
    return Array.isArray(data) ? data : [];
}

/**
 * Résout les **monstres de l'anomalie** (accompagnateurs Briko / Bruto / Gromo) — en combat,
 * le gardien est accompagné de 3 monstres tirés au hasard parmi cette liste.
 *
 * Méthode (règle de la maison : aucune invention, aucune saisie à la main) :
 *   1. **Candidats** = DofusDB `monsters?race=` pour chaque race « morphs » d'anomalie
 *      (`ANOMALY_COMPANION_RACE_IDS` : Gromorphes 192, Brutomorphes 194, Brikomorphes 195) ;
 *   2. **Preuve d'appartenance** = Dofensive `/monsters/{id}` → `Family.Id` doit valoir
 *      `ANOMALY_COMPANION_FAMILY_ID` (35 « Créatures des Anomalies Temporelles »), la MÊME
 *      famille que les gardiens de la race 191 (ces monstres n'ont ni carte ni sous-zone) ;
 *   3. **Panne Dofensive totale** : les candidats des races sourcées sont conservés marqués
 *      `validated: false` — jamais de liste vidée par un incident réseau.
 *
 * Renvoie aussi les métadonnées Dofensive par id (nécessaires pour les sorts de combat).
 */
export async function resolveAnomalyCompanions(result: AnomalyBossSyncResult): Promise<{
    companions: AnomalyCompanion[];
    metaById: Map<number, ReturnType<typeof normalizeDofensiveGuardian>>;
}> {
    const byId = new Map<number, AnomalyCompanion>();
    const metaById = new Map<number, ReturnType<typeof normalizeDofensiveGuardian>>();

    for (const raceId of ANOMALY_COMPANION_RACE_IDS) {
        const rawList = await dofusdbFetch<any[]>(`/monsters?race=${raceId}&lang=fr&$limit=200`);
        const list = Array.isArray(rawList) ? rawList : [];
        if (list.length === 0) {
            result.errors.push(`DofusDB monsters?race=${raceId} (monstres de l'anomalie) indisponible`);
            continue;
        }

        await mapWithConcurrency(list, CONCURRENCY, async (monster) => {
            const id = Math.floor(Number(monster?.id) || 0);
            const name = String(monster?.name?.fr ?? "").trim();
            if (id <= 0 || !name) return;

            let familyId: number | null = null;
            let raceName: string | null = null;
            try {
                const rawMeta = await dofensiveFetch<any>(`/monsters/${id}?lang=fr`, `anomaly-companion-${id}`, true);
                const item = Array.isArray(rawMeta) ? rawMeta[0] : rawMeta;
                if (item) {
                    metaById.set(id, normalizeDofensiveGuardian(item));
                    const parsed = Number(item?.Family?.Id);
                    familyId = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
                    raceName = item?.Race?.Name ? String(item.Race.Name) : null;
                }
            } catch (error) {
                // Fail-soft : candidat conservé (appartenance non prouvée pour cette passe).
                result.errors.push(`Monstre de l'anomalie ${name}: Dofensive indisponible (${String(error)})`);
            }

            byId.set(id, {
                id,
                name,
                level: guardianLevel(monster),
                isBoss: false,
                raceId,
                raceName,
                familyId,
                validated: familyId === ANOMALY_COMPANION_FAMILY_ID,
                imageUrl: typeof monster?.img === "string" ? monster.img : null,
            });
        });
    }

    const all = [...byId.values()];
    if (all.length === 0) return { companions: [], metaById };

    // Dofensive totalement injoignable (aucune famille lue) → on garde les races sourcées ;
    // sinon, seuls les membres dont l'appartenance à la famille d'anomalie est PROUVÉE restent.
    const dofensiveDown = all.every((c) => c.familyId === null);
    const kept = dofensiveDown ? all : all.filter((c) => isAnomalyCompanion(c));
    return { companions: orderAnomalyCompanions(kept), metaById };
}

/**
 * Siphonne TOUS les gardiens d'anomalie (race 191) **et les monstres de l'anomalie**
 * (accompagnateurs Briko/Bruto/Gromo, famille Dofensive 35) : liste DofusDB + métadonnées/carte
 * Dofensive + sorts de combat + icônes + persistance (Dungeon / MonsterStat / DofensiveMap).
 * Idempotent et fail-soft : une erreur unitaire n'interrompt pas la passe.
 */
export async function syncAnomalyBosses(): Promise<AnomalyBossSyncResult> {
    const result: AnomalyBossSyncResult = {
        synced: 0,
        unchanged: 0,
        errors: [],
        imagesSiphoned: 0,
        guardians: [],
        companions: [],
    };

    // 1. LISTE — DofusDB `monsters?race=191` (source de vérité de l'appartenance).
    const rawList = await dofusdbFetch<any[]>(`/monsters?race=${ANOMALY_RACE_ID}&lang=fr&$limit=200`);
    const list = Array.isArray(rawList) ? rawList : [];
    if (list.length === 0) {
        result.errors.push(`DofusDB monsters?race=${ANOMALY_RACE_ID} indisponible`);
        return result;
    }

    const base = list
        .map((m) => ({
            id: Math.floor(Number(m?.id) || 0),
            name: String(m?.name?.fr ?? "").trim(),
            level: guardianLevel(m),
            isBoss: !!m?.isBoss,
            imageUrl: typeof m?.img === "string" ? m.img : null,
        }))
        .filter((g) => g.id > 0 && g.name.length > 0);

    // 2. MÉTADONNÉES Dofensive (carte + famille + type) — concurrence bornée + fail-soft par gardien.
    const metaById = new Map<number, ReturnType<typeof normalizeDofensiveGuardian>>();
    await mapWithConcurrency(base, CONCURRENCY, async (guardian) => {
        try {
            const rawMonster = await dofensiveFetch<any>(`/monsters/${guardian.id}?lang=fr`, `anomaly-monster-${guardian.id}`, true);
            const item = Array.isArray(rawMonster) ? rawMonster[0] : rawMonster;
            if (item) metaById.set(guardian.id, normalizeDofensiveGuardian(item));
        } catch (error) {
            result.errors.push(`Gardien ${guardian.name}: Dofensive indisponible (${String(error)})`);
        }
    });

    // 3. RÉSOLUTION carte/famille + co-gardiens de la même carte.
    const resolved = base.map((guardian) => {
        const meta = metaById.get(guardian.id) ?? null;
        const map = resolveAnomalyMap(meta?.preferredMaps);
        return {
            ...guardian,
            meta,
            mapId: map.id,
            mapName: buildAnomalyDungeonName(map.name),
            isDefaultMap: map.isDefault,
            family: meta?.familyName || meta?.raceName || ANOMALY_FAMILY_NAME,
            source: (meta ? "DOFENSIVE" : "DOFUSDB") as "DOFENSIVE" | "DOFUSDB",
        };
    });
    const groups = groupAnomalyGuardiansByMap(resolved.map((g) => ({ name: g.name, mapId: g.mapId })));
    // Règle unique « qui obtient une fiche Boss Anomalie » (les boss seuls).
    const bossIds = new Set(pickAnomalyBossEntries(resolved).map((g) => g.id));
    // Famille complète d'une carte (id + nom + statut boss) — sert d'« accompagnateurs » dans la fiche.
    const familyByMap: Record<number, { id: number; name: string; isBoss: boolean }[]> = {};
    for (const g of resolved) {
        if (!familyByMap[g.mapId]) familyByMap[g.mapId] = [];
        familyByMap[g.mapId].push({ id: g.id, name: g.name, isBoss: g.isBoss });
    }

    // 3bis. MONSTRES DE L'ANOMALIE (accompagnateurs) — rattachés par la famille Dofensive 35.
    //      Ils suivent la MÊME chaîne de siphon (fiche `MonsterStat` + sorts + icône) mais n'ont
    //      ni carte de combat ni ligne `Dungeon` : ils n'existent qu'en monstres d'accompagnement.
    const companionResolution = await resolveAnomalyCompanions(result);
    const companions = companionResolution.companions;
    result.companions = companions;
    const companionRefs = companions.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level ?? null,
        isBoss: false,
        raceId: c.raceId,
        raceName: c.raceName,
    }));

    type AnomalySiphonTarget = {
        id: number;
        name: string;
        level: number;
        isBoss: boolean;
        imageUrl: string | null;
        meta: ReturnType<typeof normalizeDofensiveGuardian> | null;
        mapId: number;
        mapName: string;
        isDefaultMap: boolean;
        family: string;
        source: "DOFENSIVE" | "DOFUSDB";
        raceId: number;
        raceName: string | null;
        isCompanion: boolean;
    };

    const targets: AnomalySiphonTarget[] = [
        ...resolved.map((g) => ({
            id: g.id,
            name: g.name,
            level: g.level,
            isBoss: g.isBoss,
            imageUrl: g.imageUrl,
            meta: g.meta,
            mapId: g.mapId,
            mapName: g.mapName,
            isDefaultMap: g.isDefaultMap,
            family: g.family,
            source: g.source,
            raceId: ANOMALY_RACE_ID,
            raceName: g.meta?.raceName ?? ANOMALY_RACE_NAME,
            isCompanion: false,
        })),
        ...companions.map((c) => ({
            id: c.id,
            name: c.name,
            level: c.level ?? 200,
            isBoss: false,
            imageUrl: c.imageUrl,
            meta: companionResolution.metaById.get(c.id) ?? null,
            mapId: DEFAULT_ANOMALY_MAP.id,
            mapName: DEFAULT_ANOMALY_MAP.name,
            isDefaultMap: true,
            family: ANOMALY_FAMILY_NAME,
            source: (companionResolution.metaById.has(c.id) ? "DOFENSIVE" : "DOFUSDB") as "DOFENSIVE" | "DOFUSDB",
            raceId: c.raceId,
            raceName: c.raceName,
            isCompanion: true,
        })),
    ];

    // 4. SIPHON unitaire (concurrence bornée) : sorts + fiche + map + icônes + ligne Dungeon.
    await mapWithConcurrency(targets, CONCURRENCY, async (guardian) => {
        try {
            // Imports dynamiques : ces deux modules tirent la chaîne d'auth Next (`@/auth`) et
            // n'ont aucune raison d'être chargés pour les helpers purs (ni dans les tests unitaires).
            const { getMonsterStats } = await import("@/server/actions/game-data-actions");
            const { getDofensiveSpells } = await import("@/server/actions/dofensive-actions");
            const statsRes = await getMonsterStats(guardian.name, guardian.isCompanion ? undefined : guardian.mapName, true);
            const stats: any = statsRes.success && statsRes.data
                ? statsRes.data
                : { id: guardian.id, name: guardian.name, spells: [] };

            // 4.1 Sorts de combat : Dofensive d'abord (source de vérité), DofusDB en repli.
            let combat: DofensiveSpellCombat[] = [];
            if (guardian.meta) {
                const dRes = await getDofensiveSpells(guardian.id, undefined, true);
                if (dRes.success && dRes.data) combat = dRes.data;
            }
            if (combat.length === 0) {
                const dbSpells: any[] = Array.isArray(stats.spells) ? stats.spells : [];
                const levels = await fetchSpellLevels(dbSpells.map((s) => Math.floor(Number(s?.id))));
                combat = buildCombatSpellsFromDofusDb(dbSpells, levels);
            }

            // 4.2 Fiche locale (`MonsterStat`) : stats DofusDB enrichies + sorts de combat + métadonnées.
            const siblings = guardian.isCompanion ? [] : (groups[guardian.mapId] ?? [guardian.name]);
            const payload = {
                ...stats,
                id: Math.floor(Number(stats.id) || guardian.id),
                name: String(stats.name ?? guardian.name),
                imageUrl: stats.imageUrl || guardian.imageUrl || `https://api.dofusdb.fr/img/monsters/${guardian.id}.png`,
                dofusdbId: guardian.id,
                spells: combat.length > 0 ? mergeDofensiveSpells(stats.spells ?? [], combat) : (stats.spells ?? []),
                preferredMaps: guardian.meta?.preferredMaps ?? [],
                isAnomalyBoss: !guardian.isCompanion,
                anomaly: {
                    raceId: guardian.raceId,
                    raceName: guardian.raceName,
                    familyName: guardian.family,
                    // Les accompagnateurs n'ont NI carte NI sous-zone : jamais de fausse carte.
                    mapId: guardian.isCompanion ? null : guardian.mapId,
                    mapName: guardian.isCompanion ? null : guardian.mapName,
                    isDefaultMap: guardian.isCompanion ? false : guardian.isDefaultMap,
                    isBoss: guardian.isBoss,
                    // 🌀 3 monstres tirés au hasard parmi `companions` à l'ouverture de l'anomalie.
                    isCompanion: guardian.isCompanion,
                    companionFamilyId: ANOMALY_COMPANION_FAMILY_ID,
                    companionPick: ANOMALY_COMPANION_PICK,
                    companions: guardian.isCompanion ? [] : companionRefs,
                    source: guardian.source,
                    siblings,
                    family: guardian.isCompanion
                        ? []
                        : (familyByMap[guardian.mapId] ?? [{ id: guardian.id, name: guardian.name, isBoss: guardian.isBoss }]),
                },
            };
            await persistMonsterStat({ ...payload, dungeonName: guardian.isCompanion ? null : guardian.mapName });

            // 4.3 Grille isométrique de la carte de combat (local-first à la lecture).
            //     Les accompagnateurs n'ont pas de carte : rien à siphonner de ce côté.
            if (!guardian.isCompanion) await siphonDofensiveMapById(guardian.mapId);

            // 4.4 Icônes : monstre + sorts (DofusDB → WebP disque, zéro CDN à l'exécution).
            const monsterImg = await siphonAndCompressImage(guardian.imageUrl, "monsters", guardian.id);
            if (monsterImg.success) result.imagesSiphoned++;
            const iconById = new Map<number, string>();
            for (const s of Array.isArray(stats.spells) ? stats.spells : []) {
                const sid = Math.floor(Number(s?.id));
                const url = typeof s?.imageUrl === "string" ? s.imageUrl : "";
                if (sid > 0 && url.startsWith("https://api.dofusdb.fr/")) iconById.set(sid, url);
            }
            for (const [sid, url] of iconById) {
                const iconRes = await siphonAndCompressImage(url, "spells", sid);
                if (iconRes.success) result.imagesSiphoned++;
            }

            // 4.5 Ligne `Dungeon` (une par gardien BOSS) + pseudo-succès « Donjon validé ».
            // Les créatures d'accompagnement (isBoss=false, ex. Cristal Malakite niv. 20) et les
            // monstres de l'anomalie (Briko/Bruto/Gromo) n'ont pas d'occurrence propre : ils
            // restent des monstres de salle (famille de la carte pour les uns, accompagnateurs pour les autres).
            if (!guardian.isCompanion && bossIds.has(guardian.id)) {
                const entry = await upsertAnomalyDungeonRow({
                    name: guardian.mapName,
                    bossName: guardian.name,
                    level: guardian.level,
                    dofusdbId: guardian.id,
                    mapId: guardian.mapId,
                    family: guardian.family,
                    imageUrl: `/api/assets-dofus/monsters/${guardian.id}`,
                });
                if (entry.created) result.synced++;
                else result.unchanged++;
            }

            if (guardian.isCompanion) {
                // Accompagnateur : aucune ligne `Dungeon` ; la télémétrie vit dans `result.companions`.
                const idx = result.companions.findIndex((c) => c.id === guardian.id);
                if (idx >= 0 && monsterImg.localUrl) {
                    result.companions[idx] = { ...result.companions[idx], imageUrl: monsterImg.localUrl };
                }
            } else {
                result.guardians.push({
                    id: guardian.id,
                    name: guardian.name,
                    level: guardian.level,
                    isBoss: guardian.isBoss,
                    imageUrl: monsterImg.localUrl ?? guardian.imageUrl,
                    mapId: guardian.mapId,
                    mapName: guardian.mapName,
                    isDefaultMap: guardian.isDefaultMap,
                    family: guardian.family,
                    source: guardian.source,
                    spells: Array.isArray(payload.spells) ? payload.spells.length : 0,
                    siblings,
                });
            }
        } catch (error) {
            result.errors.push(`Gardien ${guardian.name}: ${String(error)}`);
            logger.warn("[anomaly-boss-siphon] gardien en échec:", { error: String(error), id: guardian.id });
        }
    });

    logger.info(
        `[anomaly-boss-siphon] ${result.guardians.length} gardiens d'anomalie + ${result.companions.length} monstre(s) de l'anomalie résolus ` +
        `(${result.synced} créés/mis à jour, ${result.unchanged} inchangés, ${result.errors.length} erreur(s), ${result.imagesSiphoned} image(s)).`
    );
    return result;
}

/**
 * Écrit (upsert) la ligne `Dungeon` d'un gardien d'anomalie et garantit le pseudo-succès
 * « Donjon validé » (l'entrée devient cochable dans « Mes Succès »).
 * `db.dungeon` est inatteignable en test (`DB_READABLE=false`) → renvoie `created:false`.
 */
async function upsertAnomalyDungeonRow(input: {
    name: string;
    bossName: string;
    level: number;
    dofusdbId: number;
    mapId: number;
    family: string;
    imageUrl: string;
}): Promise<{ created: boolean; id?: string }> {
    if (!DB_READABLE) return { created: false };
    const existing = await db.dungeon.findFirst({
        where: { name: input.name, bossName: input.bossName },
        select: { id: true, isAnomalyBoss: true, anomalyMapId: true },
    });
    const dungeon = await db.dungeon.upsert({
        where: { name_bossName: { name: input.name, bossName: input.bossName } },
        create: {
            name: input.name,
            bossName: input.bossName,
            level: input.level,
            dofusdbId: input.dofusdbId,
            imageUrl: input.imageUrl,
            dofensiveUrl: anomalyDofensiveUrl(input.dofusdbId),
            dofuspourlesnoobsUrl: anomalyDofusDbUrl(input.dofusdbId),
            dofensiveMonsterName: input.bossName,
            isAnomalyBoss: true,
            anomalyMapId: input.mapId,
            anomalyFamily: input.family,
            /* « succès » = avoir vaincu le gardien (même règle qu'un donjon sans succès). */
            isNoAchievement: true,
        },
        update: {
            level: input.level,
            dofusdbId: input.dofusdbId,
            imageUrl: input.imageUrl,
            dofensiveMonsterName: input.bossName,
            isAnomalyBoss: true,
            anomalyMapId: input.mapId,
            anomalyFamily: input.family,
            isNoAchievement: true,
        },
        select: { id: true },
    });
    await attachNoAchievementToDungeon(dungeon.id);
    const unchanged = !!existing && existing.isAnomalyBoss && existing.anomalyMapId === input.mapId;
    return { created: !unchanged, id: dungeon.id };
}



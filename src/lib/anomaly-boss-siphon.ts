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
import { getIgnoredDungeons } from "@/lib/game-data-ignores";
import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { dofensiveFetch } from "@/lib/dofensive-fetch";
import { DB_READABLE, persistMonsterStat, siphonDofensiveMapById } from "@/lib/dofensive-sync";
import { mergeDofensiveSpells, type DofensiveSpellCombat } from "@/lib/dofensive-spells";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";
import { attachNoAchievementToDungeon } from "@/lib/dungeon-no-achievement";
import { resolveUniqueDungeonSlug } from "@/server/game/dungeon-slug";
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
    isAnomalyGuardianIgnored,
    orderAnomalyCompanions,
    pickAdoptableDungeon,
    pickAnomalyBossEntries,
    resolveAnomalyMap,
    toAnomalyZone,
    type AnomalyGuardianRef,
    type AnomalyIgnoredDungeon,
    type AnomalyMonsterRef,
    type DungeonCurationRow,
} from "@/lib/anomaly-boss";
// 🔴 A1 (28/09/2026) — ces deux CŒURS vivent en `src/lib` : le worker BullMQ les charge sans
// session Next, et surtout **sans** `@/lib/security` → jsdom (dont le `default-stylesheet.css`
// relatif disparaît une fois le bundle déployé en `/app/` : `ENOENT` par item).
import { getDofensiveSpells } from "@/lib/dofensive-api";
import { getMonsterStats } from "@/lib/monster-stats-core";

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
 *
 * Les jets numériques (`effectDetails[].damage`) sont extraits des effets bruts du
 * niveau (`diceNum`/`diceSide`, `effectId`, `effectElement`) avec le MÊME mapping
 * élémentaire que `parseEffects` — sans eux la simulation liste les sorts mais
 * n'affiche aucune prévisu de dégâts (constat Qilby 8131).
 */

type DofusDbStatBonus = { earth?: number; water?: number; fire?: number; air?: number };

/** Extrait les bonus élémentaires du dernier grade (même convention que `parseEffects`). */
export function dofusDbStatBonusFromGrades(grades: any[]): DofusDbStatBonus {
    const g5 = Array.isArray(grades) && grades.length > 0 ? grades[grades.length - 1] : {};
    const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
    return { earth: num(g5?.strength), water: num(g5?.chance), fire: num(g5?.intelligence), air: num(g5?.agility) };
}

/**
 * Construit les effets structurés d'un niveau de sort DofusDB.
 * Seuls les dégâts élémentaires directs et les poussées/attirances sont retenus —
 * tout le reste (soins, états, % PV…) reste texte seul, jamais de chiffre inventé.
 */
export function dofusDbEffectDetails(
    effects: any[],
    bonus: DofusDbStatBonus = {}
): { label: string; duration: null; triggers: string[]; masks: string[]; damage: { element: string; min: number; max: number } | null; pushDistance: number | null }[] {
    const out: { label: string; duration: null; triggers: string[]; masks: string[]; damage: { element: string; min: number; max: number } | null; pushDistance: number | null }[] = [];
    const scaled = (val: number, stat: number) => Math.floor((Number(val) || 0) * (1 + (Number(stat) || 0) / 100));
    const elementDamageIds = [91, 92, 93, 94, 95, 112, 113, 117];
    for (const eff of Array.isArray(effects) ? effects : []) {
        const id = Math.floor(Number(eff?.effectId));
        if (!Number.isFinite(id)) continue;
        const min = Math.floor(Number(eff?.diceNum ?? eff?.value) || 0);
        const max = Math.floor(Number(eff?.diceSide) || 0);
        const zoneParam = Math.floor(Number(eff?.zoneDescr?.param1) || 0);
        if (elementDamageIds.includes(id) && min > 0) {
            const elem = eff?.effectElement;
            const key = elem === 1 ? "terre" : elem === 2 ? "feu" : elem === 3 ? "eau" : elem === 4 ? "air" : "neutre";
            const stat = key === "terre" ? bonus.earth ?? 0 : key === "feu" ? bonus.fire ?? 0 : key === "eau" ? bonus.water ?? 0 : key === "air" ? bonus.air ?? 0 : 0;
            const lo = scaled(min, stat);
            const hi = Math.max(lo, scaled(max, stat));
            if (hi <= 0) continue;
            const name = key === "neutre" ? "Neutre" : key === "terre" ? "Terre" : key === "feu" ? "Feu" : key === "eau" ? "Eau" : "Air";
            out.push({ label: `Dommages ${name}`, duration: null, triggers: [], masks: [], damage: { element: key, min: lo, max: hi }, pushDistance: null });
        } else if ((id === 100 || id === 108) && min > 0) {
            const lo = scaled(min, 0);
            const hi = Math.max(lo, scaled(max, 0));
            if (hi <= 0) continue;
            out.push({ label: "Vol de vie", duration: null, triggers: [], masks: [], damage: { element: "neutre", min: lo, max: hi }, pushDistance: null });
        } else if ((id === 97 || id === 96 || id === 99 || id === 98) && min > 0) {
            const key = id === 97 ? "terre" : id === 96 ? "eau" : id === 99 ? "feu" : "air";
            const stat = key === "terre" ? bonus.earth ?? 0 : key === "feu" ? bonus.fire ?? 0 : key === "eau" ? bonus.water ?? 0 : bonus.air ?? 0;
            const lo = scaled(min, stat);
            const hi = Math.max(lo, scaled(max, stat));
            if (hi <= 0) continue;
            const name = key === "terre" ? "Terre" : key === "feu" ? "Feu" : key === "eau" ? "Eau" : "Air";
            out.push({ label: `Dommages ${name}`, duration: null, triggers: [], masks: [], damage: { element: key, min: lo, max: hi }, pushDistance: null });
        } else if ((id === 6 || id === 8 || id === 5 || id === 4) && (min > 0 || zoneParam > 0)) {
            const dist = min > 0 ? min : zoneParam;
            out.push({ label: id === 6 || id === 8 ? `Attire de ${dist}` : `Repousse de ${dist}`, duration: null, triggers: [], masks: [], damage: null, pushDistance: dist });
        }
    }
    return out;
}
export function buildCombatSpellsFromDofusDb(dbSpells: any[], levels: any[], statBonus: DofusDbStatBonus = {}): DofensiveSpellCombat[] {
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
            effectDetails: dofusDbEffectDetails(Array.isArray(lvl?.effects) ? lvl.effects : [], statBonus),
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
    /** Gardiens dont l'entrée `Dungeon` a été **supprimée à la main** (exclue) : jamais recréée. */
    skippedIgnored: number;
}

/**
 * Ligne `Dungeon` chargée **une fois par passe** : l'adoption (anti-doublon) et la complétion
 * lisent cet index plutôt que d'ouvrir une requête par gardien.
 */
type AnomalyDungeonRow = DungeonCurationRow & {
    isAnomalyBoss: boolean;
    anomalyMapId: number | null;
    anomalyFamily: string | null;
    imageUrl: string | null;
    isNoAchievement: boolean;
};

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
export async function fetchSpellLevels(spellIds: number[]): Promise<any[]> {
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
        skippedIgnored: 0,
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
        const map = resolveAnomalyMap(meta?.preferredMaps, guardian.id);
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

    // 3.bis CURATION & EXCLUSIONS — lues UNE fois par passe (jamais une requête par gardien) :
    //  · `curationRows` = index des `Dungeon` existants → **ADOPTION** de la ligne déclarée à la
    //    main (fin des doublons type `qilby-2` / `agonie-la-deterree-2`) ;
    //  · `ignoredDungeons` = suppressions du God (`ignored-dungeons.json`) → jamais recréées.
    const curationRows: AnomalyDungeonRow[] = DB_READABLE
        ? await db.dungeon.findMany({
              select: {
                  id: true,
                  name: true,
                  bossName: true,
                  dofusdbId: true,
                  dofensiveMonsterName: true,
                  isAnomalyBoss: true,
                  anomalyMapId: true,
                  anomalyFamily: true,
                  imageUrl: true,
                  isNoAchievement: true,
              },
          })
        : [];
    const ignoredDungeons: AnomalyIgnoredDungeon[] = getIgnoredDungeons();

    // 4. SIPHON unitaire (concurrence bornée) : sorts + fiche + map + icônes + ligne Dungeon.
    await mapWithConcurrency(targets, CONCURRENCY, async (guardian) => {
        try {
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
                combat = buildCombatSpellsFromDofusDb(dbSpells, levels, dofusDbStatBonusFromGrades(stats?.grades));
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
                const entry = await upsertAnomalyDungeonRow(
                    {
                        name: guardian.mapName,
                        bossName: guardian.name,
                        level: guardian.level,
                        dofusdbId: guardian.id,
                        mapId: guardian.mapId,
                        family: guardian.family,
                        imageUrl: `/api/assets-dofus/monsters/${guardian.id}`,
                    },
                    { rows: curationRows, ignored: ignoredDungeons }
                );
                if (entry.skipped) result.skippedIgnored++;
                else if (entry.created || entry.changed) result.synced++;
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
 * Écrit la ligne `Dungeon` d'un gardien d'anomalie — en **ADOPTANT** la ligne déjà déclarée à la
 * main quand il en existe une, et en **respectant** les suppressions du God.
 *
 * 🐛 Correctif 27/09/2026 (« je ne veux plus me retrouver avec des doublons ») :
 *  · une entrée qui désigne **le même gardien** (`dofusdbId`, ou même entité que `bossName` /
 *    `dofensiveMonsterName`) est **complétée** — le siphon ne crée plus une seconde ligne au nom
 *    de la carte, ne renomme jamais la ligne du God et ne réécrit pas ce qu'il a curé
 *    (`name`, `slug`, `level`, image) ;
 *  · un gardien **exclu** (`ignored-dungeons.json`) n'est **pas recréé** (ses fiches `MonsterStat`
 *    et sa carte restent siphonnées : seul le donjon ne revient pas).
 *
 * `db.dungeon` est inatteignable en test (`DB_READABLE=false`) → `{ skipped: false }`.
 */
async function upsertAnomalyDungeonRow(
    input: {
        name: string;
        bossName: string;
        level: number;
        dofusdbId: number;
        mapId: number;
        family: string;
        imageUrl: string;
    },
    ctx: { rows: AnomalyDungeonRow[]; ignored: AnomalyIgnoredDungeon[] }
): Promise<{ created: boolean; changed: boolean; skipped: boolean; id?: string }> {
    if (!DB_READABLE) return { created: false, changed: false, skipped: false };

    const guardian: AnomalyGuardianRef = { name: input.bossName, mapName: input.name, dofusdbId: input.dofusdbId };
    if (isAnomalyGuardianIgnored(guardian, ctx.ignored)) {
        return { created: false, changed: false, skipped: true };
    }

    const adopted = pickAdoptableDungeon(ctx.rows, guardian);
    if (adopted) {
        // COMPLÉTER, jamais réécrire : uniquement les champs d'anomalie encore absents.
        const data: Record<string, unknown> = {};
        if (!adopted.isAnomalyBoss) data.isAnomalyBoss = true;
        if (!adopted.anomalyMapId) data.anomalyMapId = input.mapId;
        if (!adopted.anomalyFamily) data.anomalyFamily = input.family;
        if (adopted.dofusdbId == null) data.dofusdbId = input.dofusdbId;
        if (!adopted.dofensiveMonsterName) data.dofensiveMonsterName = input.bossName;
        if (!adopted.imageUrl) data.imageUrl = input.imageUrl;
        if (!adopted.isNoAchievement) {
            // « boss d'anomalie » = aucun succès propre : on pose le pseudo-succès seulement si la
            // ligne n'en porte AUCUN (une curation explicite du God est respectée).
            const achievements = await db.dungeonAchievement.count({ where: { dungeonId: adopted.id } });
            if (achievements === 0) data.isNoAchievement = true;
        }
        if (Object.keys(data).length > 0) {
            await db.dungeon.update({ where: { id: adopted.id }, data });
        }
        await attachNoAchievementToDungeon(adopted.id);
        return { created: false, changed: Object.keys(data).length > 0, skipped: false, id: adopted.id };
    }

    const dungeon = await db.dungeon.create({
        data: {
            name: input.name,
            bossName: input.bossName,
            // Slug public `/boss/<slug>` : généré à la création, **conservé** ensuite
            // (une URL publiée ne doit pas changer quand le nom du boss évolue).
            slug: await resolveUniqueDungeonSlug(input.bossName),
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
        select: { id: true },
    });
    await attachNoAchievementToDungeon(dungeon.id);
    return { created: true, changed: true, skipped: false, id: dungeon.id };
}



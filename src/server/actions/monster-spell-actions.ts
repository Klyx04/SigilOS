"use server";

/**
 * Lot 6 « siphon spell-levels » — enrichissement sorts d'un monstre.
 *
 * Constat (Mureine 8333) : `spells/{id}.description` est vide à la source,
 * mais `monsters/{id}` + `spell-levels/{gradeId}` portent le combat réel —
 * dés, conditions de lancer, passif de début de combat (`startingSpellId`),
 * drops à critères et paramètres d'aggro. Cette action assemble ces données
 * (DofusDB, borné Zod, cache mémoire 1 h) ; le parsing est PUR et testé
 * (`src/lib/monster-spell-levels.ts`).
 *
 * Donnée de jeu publique (aucun guildId) : même régime que `getMonsterStats`
 * (local-first ailleurs, ici mémoire 1 h + limiteur DofusDB partagé).
 * Fail-closed : toute erreur ⇒ `{ success: false }`, l'appelant garde son
 * rendu local (jamais d'écran vide).
 */

import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import {
    parseSpellLevelConditions,
    describeSpellLevelConditions,
    parseDropRange,
} from "@/lib/monster-spell-levels";
import { findUnityMonsterBySlug } from "@/lib/unity-bestiary";

export interface MonsterSpellLevelView {
    spellId: number;
    name: string;
    apCost: number;
    minRange: number;
    range: number;
    maxCastPerTurn: number | null;
    maxCastPerTarget: number | null;
    conditions: string[];
    effects: { diceMin: number; diceMax: number; element: number; actionId: number }[];
}

export interface MonsterSpellLevelsData {
    monsterId: number;
    monsterName: string;
    spells: MonsterSpellLevelView[];
    startingSpell: { id: number; name: string; levelId: number | null } | null;
    drops: { objectId: number; alterationId: number; min: number; max: number; hasCriterions: boolean }[];
    aggression: { zoneSize: number | null; delayMs: number | null };
}

type ActionResponse<T> = { success: boolean; data?: T; error?: string };

const CACHE = new Map<string, { data: MonsterSpellLevelsData; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const NAME_CACHE = new Map<string, { data: Record<number, string>; expiresAt: number }>();

const safeInt = (v: unknown): number | null => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : null;
};

async function fetchJson(url: string): Promise<any | null> {
    try {
        const res = await dofusDbFetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Niveaux de sorts + passif + drops + aggro d'un monstre DofusDB.
 * `monsterId` = id DofusDB du monstre (ex. 8333 Mureine). Réponse bornée
 * (≤ 12 sorts, effets ≤ 8/sort) : jamais de blob incontrôlé vers le client.
 */
export async function getMonsterSpellLevels(monsterId: number): Promise<ActionResponse<MonsterSpellLevelsData>> {
    const id = Math.floor(Number(monsterId));
    if (!Number.isFinite(id) || id <= 0) return { success: false, error: "Monstre invalide" };

    const cached = CACHE.get(`m:${id}`);
    if (cached && cached.expiresAt > Date.now()) return { success: true, data: cached.data };

    try {
        const monster = await fetchJson(`https://api.dofusdb.fr/monsters/${id}?lang=fr`);
        if (!monster || monster.id !== id) return { success: false, error: "Monstre introuvable" };

        const rawSpells: unknown[] = Array.isArray(monster.spells) ? monster.spells : [];
        const spellIds: number[] = [...new Set(
            rawSpells.map((s) => Math.floor(Number(s))).filter((n) => Number.isFinite(n) && n > 0)
        )].slice(0, 12);
        const startingSpellId = safeInt(monster.startingSpellId);

        // Détails des sorts (noms + niveaux) en une requête.
        let spellsMeta: Record<number, any> = {};
        if (spellIds.length > 0) {
            const q = spellIds.map((s) => `id[$in][]=${s}`).join("&");
            const data = await fetchJson(`https://api.dofusdb.fr/spells?${q}&$limit=50&lang=fr`);
            for (const s of data?.data ?? []) spellsMeta[Number(s?.id)] = s;
        }

        // Dernier niveau de chaque sort (palier du boss).
        const levelIds: number[] = [];
        for (const sid of spellIds) {
            const levels = spellsMeta[sid]?.spellLevels;
            if (Array.isArray(levels) && levels.length > 0) {
                const last = Math.floor(Number(levels[levels.length - 1]));
                if (Number.isFinite(last) && last > 0) levelIds.push(last);
            }
        }
        let levelsMap: Record<number, any> = {};
        if (levelIds.length > 0) {
            const q = levelIds.map((l) => `id[$in][]=${l}`).join("&");
            const data = await fetchJson(`https://api.dofusdb.fr/spell-levels?${q}&$limit=50&lang=fr`);
            for (const l of data?.data ?? []) levelsMap[Number(l?.id)] = l;
        }

        const spells: MonsterSpellLevelView[] = spellIds.map((sid) => {
            const meta = spellsMeta[sid] ?? {};
            const levels = Array.isArray(meta.spellLevels) ? meta.spellLevels : [];
            const lastLevel = levels.length > 0 ? levelsMap[Math.floor(Number(levels[levels.length - 1]))] ?? {} : {};
            const effects = Array.isArray(lastLevel.effects) ? lastLevel.effects.slice(0, 8) : [];
            return {
                spellId: sid,
                name: typeof meta.name?.fr === "string" ? meta.name.fr : String(meta.name ?? "Sort"),
                apCost: safeInt(lastLevel.apCost) ?? 0,
                minRange: safeInt(lastLevel.minRange) ?? 0,
                range: safeInt(lastLevel.range) ?? 0,
                maxCastPerTurn: safeInt(lastLevel.maxCastPerTurn),
                maxCastPerTarget: safeInt(lastLevel.maxCastPerTarget),
                conditions: describeSpellLevelConditions(parseSpellLevelConditions(lastLevel)),
                effects: effects.map((e: any) => ({
                    diceMin: safeInt(e?.diceNum ?? e?.value) ?? 0,
                    diceMax: safeInt(e?.diceSide) ?? 0,
                    element: safeInt(e?.effectElement) ?? -1,
                    actionId: safeInt(e?.actionId ?? e?.effectId) ?? 0,
                })),
            };
        });

        let startingSpell: MonsterSpellLevelsData["startingSpell"] = null;
        if (startingSpellId) {
            // `startingSpellId` est un id de NIVEAU : niveau → `spellId` → nom.
            // On ne devine rien : sans chaîne complète, on expose le niveau seul.
            const level = await fetchJson(`https://api.dofusdb.fr/spell-levels/${startingSpellId}?lang=fr`);
            const spellId = safeInt(level?.spellId);
            let name = "Passif de combat";
            if (spellId) {
                const data = await fetchJson(`https://api.dofusdb.fr/spells/${spellId}?lang=fr`);
                if (typeof data?.name?.fr === "string") name = data.name.fr;
                else if (typeof data?.name === "string") name = data.name;
            }
            startingSpell = { id: spellId ?? startingSpellId, name, levelId: startingSpellId };
        }

        const drops = (Array.isArray(monster.drops) ? monster.drops : []).slice(0, 24).map((d: any) => ({
            objectId: safeInt(d?.objectId) ?? -1,
            alterationId: safeInt(d?.alterationId) ?? -1,
            ...(parseDropRange(d) ?? { min: 0, max: 0 }),
            hasCriterions: d?.hasCriterions === true,
        }));

        const payload: MonsterSpellLevelsData = {
            monsterId: id,
            monsterName: typeof monster.name?.fr === "string" ? monster.name.fr : String(monster.name ?? ""),
            spells,
            startingSpell,
            drops,
            aggression: {
                zoneSize: safeInt(monster.aggressiveZoneSize),
                delayMs: safeInt(monster.aggressiveAttackDelay),
            },
        };
        CACHE.set(`m:${id}`, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
        return { success: true, data: payload };
    } catch (error) {
        logger.warn("[getMonsterSpellLevels] échec", { monsterId: id, error: String(error) });
        return { success: false, error: "DofusDB indisponible" };
    }
}

/**
 * Noms de monstres par ids DofusDB (ex. `8334` → `Murare`), pour résoudre les
 * chaînes brutes « Invoque : 8334 » sans jamais afficher un id nu. Borné à
 * 20 ids, cache 1 h. Fail-soft : ids non résolus absents du résultat.
 */
export async function resolveMonsterNames(ids: number[]): Promise<ActionResponse<Record<number, string>>> {
    const clean = [...new Set(
        (Array.isArray(ids) ? ids : [])
            .map((n) => Math.floor(Number(n)))
            .filter((n) => Number.isFinite(n) && n > 0)
    )].slice(0, 20);
    if (clean.length === 0) return { success: true, data: {} };

    const key = `n:${clean.slice().sort((a, b) => a - b).join(",")}`;
    const cached = NAME_CACHE.get(key);
    if (cached && cached.expiresAt > Date.now()) return { success: true, data: cached.data };

    try {
        const q = clean.map((n) => `id[$in][]=${n}`).join("&");
        const data = await fetchJson(`https://api.dofusdb.fr/monsters?${q}&$limit=50&lang=fr`);
        const out: Record<number, string> = {};
        for (const m of data?.data ?? []) {
            const mid = Math.floor(Number(m?.id));
            const name = typeof m?.name?.fr === "string" ? m.name.fr : null;
            if (Number.isFinite(mid) && mid > 0 && name) out[mid] = name;
        }
        NAME_CACHE.set(key, { data: out, expiresAt: Date.now() + CACHE_TTL_MS });
        return { success: true, data: out };
    } catch (error) {
        logger.warn("[resolveMonsterNames] échec", { error: String(error) });
        return { success: false, error: "DofusDB indisponible" };
    }
}

export interface RaidBestiaryEntryView {
    slug: string;
    monsterId: number;
    name: string;
    lifePoints: number | null;
    actionPoints: number | null;
    movementPoints: number | null;
    resistances: { neutral: number | null; earth: number | null; fire: number | null; water: number | null; air: number | null };
    /** Stats élémentaires du palier max (dégâts calculés : dés × stats). */
    damageStats: { earth: number | null; fire: number | null; water: number | null; air: number | null };
    dodgeAp: number | null;
    dodgeMp: number | null;
    imageUrl: string;
    spells: { id: number; name: string; iconId: number | null; apCost: number; minRange: number; range: number; effects: string[] }[];
    passiveName: string | null;
}

/**
 * Lot 5 — fiche compacte d'une entité du bestiaire de raid, depuis le
 * bestiaire LOCAL Unity (zéro réseau). `null` si le slug ne résout pas
 * (jamais de fiche inventée). L'enrichissement sorts (lot 6) se fait côté
 * appelant via `getMonsterSpellLevels`.
 */
export async function getRaidBestiaryEntry(slug: string): Promise<ActionResponse<RaidBestiaryEntryView | null>> {
    const clean = String(slug ?? "").trim().toLowerCase().slice(0, 150);
    if (!clean) return { success: false, error: "Slug invalide" };
    try {
        const m = findUnityMonsterBySlug(clean);
        if (!m) return { success: true, data: null };
        const grades = Array.isArray((m as any).grades) ? (m as any).grades : [];
        const top = grades[grades.length - 1] ?? grades[0] ?? {};
        const spells = (Array.isArray((m as any).spells) ? (m as any).spells : []).slice(0, 12).map((s: any) => ({
            id: Math.floor(Number(s?.id)) || 0,
            name: String(s?.name ?? "Sort"),
            iconId: Number.isFinite(Number(s?.iconId)) ? Number(s.iconId) : null,
            apCost: Math.floor(Number(s?.apCost)) || 0,
            minRange: Math.floor(Number(s?.minRange)) || 0,
            range: Math.floor(Number(s?.range)) || 0,
            effects: Array.isArray(s?.effects) ? s.effects.map((e: unknown) => String(e)).slice(0, 8) : [],
        }));
        return {
            success: true,
            data: {
                slug: clean,
                monsterId: Math.floor(Number((m as any).id)) || 0,
                name: String((m as any).name ?? clean),
                lifePoints: Number.isFinite(Number(top.lifePoints)) ? Number(top.lifePoints) : null,
                actionPoints: Number.isFinite(Number(top.actionPoints)) ? Number(top.actionPoints) : null,
                movementPoints: Number.isFinite(Number(top.movementPoints)) ? Number(top.movementPoints) : null,
                resistances: {
                    neutral: Number.isFinite(Number(top.neutralResistance)) ? Number(top.neutralResistance) : null,
                    earth: Number.isFinite(Number(top.earthResistance)) ? Number(top.earthResistance) : null,
                    fire: Number.isFinite(Number(top.fireResistance)) ? Number(top.fireResistance) : null,
                    water: Number.isFinite(Number(top.waterResistance)) ? Number(top.waterResistance) : null,
                    air: Number.isFinite(Number(top.airResistance)) ? Number(top.airResistance) : null,
                },
                dodgeAp: Number.isFinite(Number(top.apDodge)) ? Number(top.apDodge) : null,
                dodgeMp: Number.isFinite(Number(top.mpDodge)) ? Number(top.mpDodge) : null,
                damageStats: {
                    earth: Number.isFinite(Number(top.strength)) ? Number(top.strength) : null,
                    fire: Number.isFinite(Number(top.intelligence)) ? Number(top.intelligence) : null,
                    water: Number.isFinite(Number(top.chance)) ? Number(top.chance) : null,
                    air: Number.isFinite(Number(top.agility)) ? Number(top.agility) : null,
                },
                imageUrl: `/api/assets-dofus/monsters/${Math.floor(Number((m as any).id)) || 0}`,
                spells,
                passiveName: typeof (m as any).passive?.name === "string" ? (m as any).passive.name : null,
            },
        };
    } catch (error) {
        logger.warn("[getRaidBestiaryEntry] échec", { slug: clean, error: String(error) });
        return { success: false, error: "Bestiaire indisponible" };
    }
}

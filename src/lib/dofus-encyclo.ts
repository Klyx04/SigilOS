/**
 * Fiche encyclopédique d'un monstre (façon encyclopédie Dofus).
 *
 * Source de vérité : payload DofusDB brut (`/monsters/{id}`) — **jamais** de valeur
 * inventée : tout champ absent ou hors bornes vaut `null` et sa ligne est masquée.
 * Règles mesurées sur Cire Momore (7222) :
 * - race `277` → « Gardiens solitaires » (`monster-races`), superRace `1` →
 *   « Créatures diverses » (`monster-super-races`), subarea `1031` → « Ereboria » ;
 * - « Agressif jusqu'au niveau X » = `level - aggressiveLevelDiff` (900 − 50 = 850).
 */

import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { logger } from "@/lib/logger";

const num = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    const f = Math.floor(n);
    if (f < min || f > max) return null;
    return f;
};

const bool = (v: unknown): boolean | null =>
    typeof v === "boolean" ? v : null;

const frName = (v: unknown): string | null => {
    const name = (v as any)?.name;
    const fr = typeof name === "object" && name !== null ? name.fr : name;
    if (typeof fr !== "string") return null;
    const clean = fr.trim().slice(0, 80);
    return clean.length > 0 ? clean : null;
};

export interface EncycloGrade {
    level: number | null;
    lifePoints: number | null;
    actionPoints: number | null;
    movementPoints: number | null;
    wisdom: number | null;
    strength: number | null;
    intelligence: number | null;
    chance: number | null;
    agility: number | null;
    paDodge: number | null;
    pmDodge: number | null;
    gradeXp: number | null;
    resists: {
        neutral: number | null;
        earth: number | null;
        fire: number | null;
        water: number | null;
        air: number | null;
    };
}

/** Caractéristiques d'un grade brut DofusDB — champs inconnus ignorés, jamais inventés. */
export function encycloGrade(g: any): EncycloGrade {
    return {
        level: num(g?.level, 1, 1000),
        lifePoints: num(g?.lifePoints, 0, 10_000_000),
        actionPoints: num(g?.pa ?? g?.actionPoints, 0, 100),
        movementPoints: num(g?.pm ?? g?.movementPoints, 0, 100),
        wisdom: num(g?.wisdom, 0, 100_000),
        strength: num(g?.strength, 0, 100_000),
        intelligence: num(g?.intelligence, 0, 100_000),
        chance: num(g?.chance, 0, 100_000),
        agility: num(g?.agility, 0, 100_000),
        paDodge: num(g?.paDodge, 0, 100_000),
        pmDodge: num(g?.pmDodge, 0, 100_000),
        gradeXp: num(g?.gradeXp, 0, 1_000_000_000),
        resists: {
            neutral: num(g?.neutralResistance, -100, 100),
            earth: num(g?.earthResistance, -100, 100),
            fire: num(g?.fireResistance, -100, 100),
            water: num(g?.waterResistance, -100, 100),
            air: num(g?.airResistance, -100, 100),
        },
    };
}

export interface EncycloIdentity {
    raceId: number | null;
    isBoss: boolean | null;
    isMiniBoss: boolean | null;
    subareaIds: number[];
    aggressiveZoneSize: number | null;
    aggressiveLevelDiff: number | null;
    canTackle: boolean | null;
    canBePushed: boolean | null;
    canSwitchPos: boolean | null;
    canSwitchPosOnTarget: boolean | null;
    canBeCarried: boolean | null;
    canUsePortal: boolean | null;
    soulCaptureForbidden: boolean | null;
}

/** Identité encyclopédique depuis le payload DofusDB brut (pur, borné). */
export function encycloIdentity(monster: any): EncycloIdentity {
    const subareaIds = Array.isArray(monster?.subareas)
        ? monster.subareas
              .map((id: unknown) => num(id, 1, 1_000_000))
              .filter((id: number | null): id is number => id !== null)
              .slice(0, 10)
        : [];
    return {
        raceId: num(monster?.race, 1, 1_000_000),
        isBoss: bool(monster?.isBoss),
        isMiniBoss: bool(monster?.isMiniBoss),
        subareaIds,
        aggressiveZoneSize: num(monster?.aggressiveZoneSize, 0, 20),
        aggressiveLevelDiff: num(monster?.aggressiveLevelDiff, 0, 1000),
        canTackle: bool(monster?.canTackle),
        canBePushed: bool(monster?.canBePushed),
        canSwitchPos: bool(monster?.canSwitchPos),
        canSwitchPosOnTarget: bool(monster?.canSwitchPosOnTarget),
        canBeCarried: bool(monster?.canBeCarried),
        canUsePortal: bool(monster?.canUsePortal),
        soulCaptureForbidden: bool(monster?.soulCaptureForbidden),
    };
}

export interface EncycloNames {
    raceName: string | null;
    superRaceName: string | null;
    zoneName: string | null;
}

/** Lignes de propriétés façon DofusDB (« Ne peut pas être poussé », agression…). */
export function encycloProperties(
    identity: EncycloIdentity,
    level: number | null
): string[] {
    const lines: string[] = [];
    if (
        identity.aggressiveZoneSize !== null &&
        identity.aggressiveZoneSize > 0
    ) {
        lines.push(`Zone d'agression de ${identity.aggressiveZoneSize} case${identity.aggressiveZoneSize > 1 ? "s" : ""}`);
    }
    // Garde mesurée sur Mob l'Éponge (niv. 20, diff 50) : un niveau calculé < 1
    // est absurde (DofusDB n'affiche alors aucune ligne) ⇒ on masque.
    if (
        level !== null &&
        identity.aggressiveLevelDiff !== null &&
        identity.aggressiveLevelDiff > 0 &&
        level - identity.aggressiveLevelDiff >= 1
    ) {
        lines.push(`Agressif jusqu'au niveau ${level - identity.aggressiveLevelDiff}`);
    }
    const denials: [boolean | null, string][] = [
        [identity.soulCaptureForbidden, "Ne peut pas être capturé"],
        [identity.canBeCarried === false ? true : null, "Ne peut pas être porté"],
        [identity.canBePushed === false ? true : null, "Ne peut pas être poussé"],
        [identity.canSwitchPos === false ? true : null, "Ne peut pas échanger de position"],
        [identity.canSwitchPosOnTarget === false ? true : null, "Ne peut pas échanger de position avec la cible"],
        [identity.canUsePortal === false ? true : null, "Ne peut pas utiliser de portail"],
    ];
    for (const [active, label] of denials) {
        if (active) lines.push(label);
    }
    return lines;
}

const nameCache = new Map<string, string | null>();
const raceRowCache = new Map<string, { name: string | null; superRaceId: number | null }>();

async function cachedFrName(kind: "race" | "superRace" | "subarea", id: number): Promise<string | null> {
    const key = `${kind}:${id}`;
    if (nameCache.has(key)) return nameCache.get(key) ?? null;
    try {
        const collection =
            kind === "race" ? "monster-races" : kind === "superRace" ? "monster-super-races" : "subareas";
        const rows = await dofusdbFetch<any[]>(`/${collection}?id=${id}&$limit=1&lang=fr`);
        const name = Array.isArray(rows) && rows.length > 0 ? frName(rows[0]) : null;
        if (nameCache.size > 500) nameCache.clear();
        nameCache.set(key, name);
        return name;
    } catch (error) {
        logger.warn(`[encyclo] nom ${kind} ${id} indisponible (fail-soft)`, { error: String(error) });
        return null;
    }
}

/**
 * Noms d'encyclopédie (race, super-race, zone) — fail-soft : `null` si DofusDB
 * est injoignable, la fiche masque alors la ligne au lieu d'inventer.
 */
export async function resolveEncycloNames(identity: EncycloIdentity): Promise<EncycloNames> {
    const out: EncycloNames = { raceName: null, superRaceName: null, zoneName: null };
    try {
        // Une seule lecture de la race : nom + superRaceId d'un coup.
        let superRaceId: number | null = null;
        if (identity.raceId !== null) {
            const key = `race:${identity.raceId}`;
            if (raceRowCache.has(key)) {
                const cached = raceRowCache.get(key);
                out.raceName = cached?.name ?? null;
                superRaceId = cached?.superRaceId ?? null;
            } else {
                const rows = await dofusdbFetch<any[]>(`/monster-races?id=${identity.raceId}&$limit=1&lang=fr`);
                const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                out.raceName = row ? frName(row) : null;
                superRaceId = row ? num(row?.superRaceId, 1, 1_000_000) : null;
                if (raceRowCache.size > 500) raceRowCache.clear();
                raceRowCache.set(key, { name: out.raceName, superRaceId });
            }
            if (superRaceId !== null) out.superRaceName = await cachedFrName("superRace", superRaceId);
        }
        if (identity.subareaIds.length > 0) {
            out.zoneName = await cachedFrName("subarea", identity.subareaIds[0]);
        }
    } catch (error) {
        logger.warn("[encyclo] résolution des noms impossible (fail-soft)", { error: String(error) });
    }
    return out;
}

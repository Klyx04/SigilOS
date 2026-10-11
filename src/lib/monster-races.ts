/**
 * Référentiel des **familles de monstres** (races + super-races) — lu depuis
 * `public/game-data/monster-races.json`, produit par `scripts/siphon-monster-races.mjs`
 * (DofusDB, 264 races / 35 super-races, 22 Ko, versionné).
 *
 * Pourquoi il existe (mesure du 11/10/2026) : le bestiaire local porte un `raceId` par
 * monstre, mais le seul référentiel du dépôt était **déduit** de `dungeon-monsters.json`
 * (132 races rencontrées dans les donjons) alors que le bestiaire en utilise **263** —
 * 124 sans libellé (1 349 monstres) ⇒ le filtre « familles » affichait des pastilles
 * « Monstre » ×N (constat user). Les super-races (« Créatures de quête », « Créatures
 * Archimonstres », « Créatures des raids »…) servent à **grouper** la liste déroulante.
 *
 * Fail-soft : fichier absent ou illisible ⇒ référentiels vides (jamais de throw) — les
 * appelants ont un repli (`dungeon-monsters.json`) et n'inventent jamais un nom.
 */
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

export interface MonsterRaceRow {
    id: number;
    name: string;
    superRaceId: number | null;
}

let cachedRaces: Map<number, MonsterRaceRow> | null = null;
let cachedSuperRaces: Map<number, string> | null = null;

function load() {
    if (cachedRaces) return;
    cachedRaces = new Map();
    cachedSuperRaces = new Map();
    try {
        const filePath = path.join(process.cwd(), "public", "game-data", "monster-races.json");
        if (!fs.existsSync(filePath)) return;
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        for (const race of raw?.races ?? []) {
            const id = Math.floor(Number(race?.id) || 0);
            const name = String(race?.name ?? "").trim();
            if (id > 0 && name) {
                cachedRaces.set(id, {
                    id,
                    name,
                    superRaceId: Math.floor(Number(race?.superRaceId) || 0) || null,
                });
            }
        }
        for (const superRace of raw?.superRaces ?? []) {
            const id = Math.floor(Number(superRace?.id) || 0);
            const name = String(superRace?.name ?? "").trim();
            if (id > 0 && name) cachedSuperRaces.set(id, name);
        }
    } catch (err) {
        logger.warn("[monster-races] Référentiel des familles illisible:", { error: String(err) });
    }
}

/** Toutes les races connues (`raceId` → libellé officiel + super-race). */
export function monsterRaces(): Map<number, MonsterRaceRow> {
    load();
    return cachedRaces ?? new Map();
}

/** Toutes les super-races connues (`id` → libellé) — servent de regroupement d'affichage. */
export function monsterSuperRaces(): Map<number, string> {
    load();
    return cachedSuperRaces ?? new Map();
}

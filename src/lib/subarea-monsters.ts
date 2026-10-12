/**
 * Sous-zone de la carte du monde → **monstres et familles RÉELS** — donnée souveraine.
 *
 * 🎯 Demande user (12/10/2026) : « je ne comprends pas que tu ne sois pas capable de
 * proposer précisément par sous-zone les bonnes familles de monstres : il y a des tas de
 * sous-zones où il manque des familles, ou alors les familles sont des faux positifs dû au
 * nom ressemblant … il n'y a aucun guessing à faire, tout doit être mappé réalistement ».
 * Puis : « tout doit être souverain, les sites servent juste de siphon ».
 *
 * Causes racines mesurées (base de dev + DofusDB) :
 *   · `getZoneMonsters` résolvait une ligne `Zone` **par nom** : `Zone` = 619 lignes alors
 *     que `worldmap.json` porte **562 sous-zones** ⇒ « Touribère nauséabonde » (sous-zone
 *     471) n'existe pas dans `Zone` → « Aucune Famille Détectée » garanti ;
 *   · les liens `Zone ↔ MonsterFamily` étaient déduits par **sous-chaînes de noms**
 *     (`zNorm.includes(fNorm)`, suffixe ≥ 5 lettres) ⇒ les faux positifs exactement décrits ;
 *   · `Monster` (Prisma) n'a **pas** de zone et le dump du client (`unity-bestiary.json`)
 *     n'a **pas** de `subareas` ⇒ rien, en local, ne reliait un monstre à une sous-zone.
 *
 * La donnée **réelle** est `monsters[].subareas` côté DofusDB ; elle est siphonnée une fois
 * (`scripts/siphon-subarea-monsters.mjs`) dans `public/game-data/subarea-monsters.json`
 * (445 sous-zones, 19 Ko, versionné). Le rendu ne dépend donc **ni** de la base, **ni**
 * d'un site tiers : uniquement de fichiers versionnés. Les noms, races et sprites viennent
 * des référentiels souverains existants (`unity-bestiary.json`, `monster-races.json`) —
 * aucun doublon de donnée.
 */
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { getUnityBestiary, type UnityMonsterData } from "@/lib/unity-bestiary";
import { monsterRaces, monsterSuperRaces } from "@/lib/monster-races";
import { monsterSpriteUrl } from "@/lib/monster-fiche";

export interface SubareaMonstersDataset {
    updatedAt: string;
    /** Taille du bestiaire siphonné (5 129) — pour dire « N sur M » sans mentir. */
    totalMonsters: number;
    /** Nombre de sous-zones couvertes (445). */
    totalSubareas: number;
    /** `subAreaId` (worldmap) → identifiants Ankama des monstres qui y apparaissent. */
    subareas: Record<string, number[]>;
}

/**
 * Races **écartées** de l'onglet « Familles » : elles ont leur propre surface et ne sont
 * pas des familles de terrain.
 *   · 32 / 90 / 127 / 147 / 156 → « Avis de recherche » (onglet Avis) ;
 *   · 78 → « Archimonstres » (compteur + onglet dédiés).
 *
 * Le reste est conservé **tel quel** (décision user) : monstres normaux, monstres de quête
 * (dont Pwâk, race 196) et créatures invoquées — des créatures réellement rencontrées là.
 */
export const SUBAREA_EXCLUDED_RACE_IDS: readonly number[] = [32, 78, 90, 127, 147, 156];
const EXCLUDED_RACE_IDS = new Set<number>(SUBAREA_EXCLUDED_RACE_IDS);

let cachedDataset: SubareaMonstersDataset | null = null;
/** Index inverse `monsterId → subAreaIds[]`, construit une fois (jamais relu). */
let monsterToSubareas: Map<number, number[]> | null = null;

/** Charge le dataset souverain (une fois par process). Jamais de throw : vide en repli. */
export function loadSubareaMonsters(): SubareaMonstersDataset {
    if (cachedDataset) return cachedDataset;
    const empty: SubareaMonstersDataset = { updatedAt: "", totalMonsters: 0, totalSubareas: 0, subareas: {} };
    try {
        const filePath = path.join(process.cwd(), "public", "game-data", "subarea-monsters.json");
        if (!fs.existsSync(filePath)) {
            cachedDataset = empty;
            return cachedDataset;
        }
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const subareas: Record<string, number[]> = {};
        for (const [key, value] of Object.entries(raw?.subareas ?? {})) {
            if (!Array.isArray(value)) continue;
            const ids = value.map((v) => Math.floor(Number(v) || 0)).filter((v) => v > 0);
            if (ids.length > 0) subareas[String(Math.floor(Number(key) || 0))] = ids;
        }
        cachedDataset = {
            updatedAt: String(raw?.updatedAt ?? ""),
            totalMonsters: Math.floor(Number(raw?.totalMonsters) || 0),
            totalSubareas: Object.keys(subareas).length,
            subareas,
        };
    } catch (err) {
        logger.warn("[subarea-monsters] Dataset illisible:", { error: String(err) });
        cachedDataset = empty;
    }
    return cachedDataset;
}

/** Identifiants des monstres qui apparaissent dans une sous-zone (liste vide si inconnue). */
export function subareaMonsterIds(subAreaId: number | null | undefined): number[] {
    const id = Math.floor(Number(subAreaId) || 0);
    if (id <= 0) return [];
    return loadSubareaMonsters().subareas[String(id)] ?? [];
}

/**
 * Sous-zones **réelles** d'un monstre (index inverse du même dataset) : c'est ce qui permet
 * de proposer « chaque zone disponible » d'un archimonstre — donnée de jeu, jamais devinée.
 */
export function subareaIdsForMonster(monsterId: number | null | undefined): number[] {
    const id = Math.floor(Number(monsterId) || 0);
    if (id <= 0) return [];
    if (!monsterToSubareas) {
        const index = new Map<number, number[]>();
        for (const [key, ids] of Object.entries(loadSubareaMonsters().subareas)) {
            const subAreaId = Math.floor(Number(key) || 0);
            if (subAreaId <= 0) continue;
            for (const monster of ids) {
                const list = index.get(monster);
                if (list) list.push(subAreaId);
                else index.set(monster, [subAreaId]);
            }
        }
        for (const list of index.values()) list.sort((a, b) => a - b);
        monsterToSubareas = index;
    }
    return monsterToSubareas.get(id) ?? [];
}

/** Monstre d'une sous-zone, enrichi de sa famille officielle et de son sprite. */
export interface SubareaMonsterFacet {
    id: number;
    name: string;
    raceId: number;
    /** Libellé officiel de la famille (« Blops », « Monstres de quête »…) ; `null` si inconnu. */
    raceName: string | null;
    /** Niveau du premier palier (`0` = non renseigné par le bestiaire local). */
    level: number;
    imageUrl: string | null;
}

/** Famille **réellement peuplée** d'une sous-zone (jamais un groupe vide). */
export interface SubareaFamilyFacet {
    raceId: number;
    name: string;
    superRaceId: number | null;
    superRaceName: string | null;
    /** Sprite officiel d'un monstre représentatif (proxy d'assets). */
    imageUrl: string | null;
    /** Niveau du monstre le plus bas de la famille dans la zone (donnée de palier réelle). */
    level: number;
    monsters: SubareaMonsterFacet[];
}

function toFacet(monster: UnityMonsterData): SubareaMonsterFacet {
    const raceId = Math.floor(Number(monster.raceId) || 0);
    const race = monsterRaces().get(raceId) ?? null;
    return {
        id: monster.id,
        name: monster.name,
        raceId,
        raceName: race?.name ?? null,
        level: Math.floor(Number(monster.grades?.[0]?.level) || 0),
        imageUrl: monsterSpriteUrl(monster.id),
    };
}

/**
 * Familles + monstres d'une sous-zone, à partir du **dataset souverain** et des référentiels
 * locaux. Une famille sans libellé officiel n'est **pas** proposée (on n'invente pas un nom
 * de famille, même règle que le filtre des fiches monstres) ; une famille sans monstre non
 * plus. Les races `excludeRaceIds` (avis, archimonstres) sont écartées.
 */
export function buildSubareaFamilies(
    subAreaId: number | null | undefined,
    options: { excludeRaceIds?: readonly number[] } = {},
): { families: SubareaFamilyFacet[]; monsters: SubareaMonsterFacet[] } {
    const ids = subareaMonsterIds(subAreaId);
    if (ids.length === 0) return { families: [], monsters: [] };

    const excluded = options.excludeRaceIds ? new Set(options.excludeRaceIds) : EXCLUDED_RACE_IDS;
    const bestiary = getUnityBestiary();
    const superRaces = monsterSuperRaces();

    const byRace = new Map<number, SubareaFamilyFacet>();
    const all: SubareaMonsterFacet[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
        const monster = bestiary[String(id)];
        if (!monster || !monster.name) continue;
        const raceId = Math.floor(Number(monster.raceId) || 0);
        if (raceId <= 0 || excluded.has(raceId)) continue;
        const race = monsterRaces().get(raceId);
        const name = String(race?.name ?? "").trim();
        if (name === "") continue;
        if (seen.has(monster.name)) continue;
        seen.add(monster.name);

        const facet = toFacet(monster);
        all.push(facet);

        const family = byRace.get(raceId);
        if (family) {
            family.monsters.push(facet);
            if (facet.level > 0 && (family.level === 0 || facet.level < family.level)) family.level = facet.level;
            continue;
        }
        byRace.set(raceId, {
            raceId,
            name,
            superRaceId: race?.superRaceId ?? null,
            superRaceName: race?.superRaceId ? (superRaces.get(race.superRaceId) ?? null) : null,
            imageUrl: monsterSpriteUrl(monster.id),
            level: facet.level,
            monsters: [facet],
        });
    }

    const families = [...byRace.values()].sort(
        (a, b) => b.monsters.length - a.monsters.length || a.name.localeCompare(b.name, "fr"),
    );
    for (const family of families) family.monsters.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    all.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return { families, monsters: all };
}

import * as fs from "fs";
import * as path from "path";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";

const OUTPUT_PATH = path.join(process.cwd(), "public", "game-data", "dungeon-monsters.json");

function norm(str: string | null | undefined): string {
    return (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

async function fetchPaged(baseUrl: string, limit = 50): Promise<any[]> {
    const items: any[] = [];
    let skip = 0;
    while (true) {
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}$limit=${limit}&$skip=${skip}&lang=fr`;
        const res = await dofusDbFetch(url, { cache: 'no-store' });
        if (!res.ok) {
            logger.error(`[siphonDungeonMonsters] Fetch failed for ${url}: status ${res.status}`);
            break;
        }
        const data = await res.json();
        const batch = data.data || [];
        if (!batch.length) break;
        items.push(...batch);
        if (items.length >= (data.total || 0)) break;
        skip += limit;
    }
    return items;
}

export interface SiphonResult {
    totalDungeons: number;
    totalMonsters: number;
    totalBossFamilies: number;
}

export interface ContractIssue {
    field: string;
    message: string;
}

/**
 * Phase 5.4 — Test de contrat DofusDB (pur, testé) : pin les endpoints et les
 * champs critiques (dungeons, monster-races.monsters, monster.img/grades).
 * Un renommage côté source doit ÉCHOUER explicitement (throw → pas d'écriture,
 * alerte) au lieu de produire un dataset partiel silencieux.
 */
export function checkDungeonsContract(dungeons: unknown): ContractIssue[] {
    const issues: ContractIssue[] = [];
    if (!Array.isArray(dungeons) || dungeons.length === 0) {
        return [{ field: 'dungeons', message: 'liste vide ou absente' }];
    }
    const d = dungeons[0] as Record<string, unknown>;
    if (typeof d.id !== 'number') issues.push({ field: 'dungeons[].id', message: 'id numérique attendu' });
    if (typeof d.name !== 'object' && typeof d.name !== 'string') {
        issues.push({ field: 'dungeons[].name', message: 'nom (objet localisé ou chaîne) attendu' });
    }
    if (!Array.isArray(d.monsters) && !Array.isArray(d.bosses)) {
        issues.push({ field: 'dungeons[].monsters|bosses', message: 'listes de monstres attendues' });
    }
    return issues;
}

export function checkRacesContract(races: unknown): ContractIssue[] {
    const issues: ContractIssue[] = [];
    if (!Array.isArray(races) || races.length === 0) {
        return [{ field: 'monster-races', message: 'liste vide ou absente' }];
    }
    const r = races[0] as Record<string, unknown>;
    if (typeof r.id !== 'number') issues.push({ field: 'monster-races[].id', message: 'id numérique attendu' });
    if (!Array.isArray(r.monsters)) issues.push({ field: 'monster-races[].monsters', message: 'liste IDs attendue' });
    return issues;
}

export function checkMonsterContract(m: unknown): ContractIssue[] {
    const issues: ContractIssue[] = [];
    const mon = (m || {}) as Record<string, unknown>;
    if (typeof mon.id !== 'number') issues.push({ field: 'monster.id', message: 'id numérique attendu' });
    if (mon.img !== undefined && mon.img !== null && typeof mon.img !== 'string') {
        issues.push({ field: 'monster.img', message: 'URL chaîne attendue' });
    }
    if (!Array.isArray(mon.grades)) issues.push({ field: 'monster.grades', message: 'tableau attendu' });
    return issues;
}

/** Valide un échantillon du fetch ; throw avec le détail (bloque l'écriture). */
export function assertDatasetContract(input: { dungeons: unknown; races: unknown; sampleMonster: unknown }): void {
    const issues = [
        ...checkDungeonsContract(input.dungeons),
        ...checkRacesContract(input.races),
        ...checkMonsterContract(input.sampleMonster),
    ];
    if (issues.length > 0) {
        throw new Error(
            `[siphonDungeonMonsters] Contrat DofusDB rompu : ${issues.map((i) => `${i.field} (${i.message})`).join(' ; ')}`
        );
    }
}

export interface CompiledDataset {
    dungeons: unknown[];
    monsters: unknown[];
}

/**
 * Garde anti-écrasement partiel : refuse de persister un dataset incohérent
 * (panne source en cours de run). Règles : jamais vide, et jamais moins de
 * 50 % du fichier précédent (dérive massive = fetch tronqué, pas suppression
 * réelle — DofusDB ne supprime pas la moitié de son catalogue d'un coup).
 * Throw → l'appelant ne doit PAS écrire (le bon fichier reste en place).
 */
export function assertDatasetCoherent(
    compiled: CompiledDataset,
    previous: CompiledDataset | null
): void {
    const dungeons = compiled.dungeons.length;
    const monsters = compiled.monsters.length;
    if (dungeons === 0 || monsters === 0) {
        throw new Error(
            `[siphonDungeonMonsters] Dataset incohérent (donjons=${dungeons}, monstres=${monsters}) — persistance refusée`
        );
    }
    if (previous) {
        const prevD = previous.dungeons.length;
        const prevM = previous.monsters.length;
        if (prevD > 0 && dungeons < prevD / 2) {
            throw new Error(
                `[siphonDungeonMonsters] Effondrement donjons ${prevD} → ${dungeons} (< 50 %) — persistance refusée`
            );
        }
        if (prevM > 0 && monsters < prevM / 2) {
            throw new Error(
                `[siphonDungeonMonsters] Effondrement monstres ${prevM} → ${monsters} (< 50 %) — persistance refusée`
            );
        }
    }
}

function readPreviousDataset(): CompiledDataset | null {
    try {
        if (!fs.existsSync(OUTPUT_PATH)) return null;
        const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
        if (!Array.isArray(parsed?.dungeons) || !Array.isArray(parsed?.monsters)) return null;
        return { dungeons: parsed.dungeons, monsters: parsed.monsters };
    } catch {
        return null;
    }
}

/**
 * Siphonne et synchronise localement l'intégralité des donjons, monstres de salles et familles de boss de DofusDB.
 * Génère le fichier public/game-data/dungeon-monsters.json garantissant l'indépendance réseau.
 */
export async function siphonDungeonMonstersDataset(): Promise<SiphonResult> {
    logger.info("🚀 [siphonDungeonMonstersDataset] Démarrage du siphonnage...");

    // 1. Récupération des donjons DofusDB
    const dungeons = await fetchPaged("https://api.dofusdb.fr/dungeons");

    // 2. Récupération des familles (races) DofusDB
    const races = await fetchPaged("https://api.dofusdb.fr/monster-races");
    const raceMap = new Map<number, { id: number; name: string; monsterIds: number[] }>();
    races.forEach(r => {
        raceMap.set(r.id, {
            id: r.id,
            name: r.name?.fr || "Famille inconnue",
            monsterIds: r.monsters || []
        });
    });

    // 3. Identification des monstres requis
    const allNeededMobIds = new Set<number>();
    const bossRaceIds = new Set<number>();

    dungeons.forEach(d => {
        (d.monsters || []).forEach((id: number) => allNeededMobIds.add(id));
        (d.bosses || []).forEach((bId: number) => {
            allNeededMobIds.add(bId);
            for (const r of races) {
                if ((r.monsters || []).includes(bId) && r.id > 0) {
                    bossRaceIds.add(r.id);
                }
            }
        });
    });

    bossRaceIds.forEach(rId => {
        const r = raceMap.get(rId);
        if (r) {
            r.monsterIds.forEach(id => allNeededMobIds.add(id));
        }
    });

    // 4. Téléchargement des monstres par lots
    const mobMap = new Map<number, any>();
    const mobIdArray = Array.from(allNeededMobIds);
    const CHUNK_SIZE = 40;
    let firstRawMonster: unknown = null;

    for (let i = 0; i < mobIdArray.length; i += CHUNK_SIZE) {
        const chunk = mobIdArray.slice(i, i + CHUNK_SIZE);
        const query = chunk.map(id => `id[$in][]=${id}`).join("&");
        const url = `https://api.dofusdb.fr/monsters?${query}&$limit=50&lang=fr`;
        try {
            const res = await dofusDbFetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (!firstRawMonster && Array.isArray(data.data) && data.data.length > 0) {
                    firstRawMonster = data.data[0];
                }
                (data.data || []).forEach((m: any) => {
                    const r = raceMap.get(m.race);
                    const grades = m.grades || [];
                    const topGrade = grades[grades.length - 1] || grades[0] || {};
                    mobMap.set(m.id, {
                        id: m.id,
                        name: m.name?.fr || "Monstre",
                        imageUrl: m.img || `https://static.ankama.com/dofus/www/game/monsters/${m.id}.png`,
                        isBoss: !!m.isBoss,
                        raceId: m.race ?? null,
                        raceName: r ? r.name : (m.subtype?.name?.fr || "Monstre"),
                        level: topGrade.level || 0,
                        gradesCount: grades.length
                    });
                });
            }
        } catch (e: any) {
            logger.warn(`[siphonDungeonMonsters] Erreur chunk ${i}:`, { error: e.message });
        }
    }

    // 4bis. Contrat : un renommage côté DofusDB doit échouer explicitement
    // (throw → pas d'écriture) plutôt que produire un dataset partiel silencieux.
    assertDatasetContract({ dungeons, races, sampleMonster: firstRawMonster });

    // 5. Construction de la structure unifiée des Donjons
    const compiledDungeons = dungeons.map(d => {
        const dungeonName = d.name?.fr || "Donjon inconnu";
        const dMonsters = (d.monsters || [])
            .map((id: number) => mobMap.get(id))
            .filter(Boolean);

        const dBosses = (d.bosses || [])
            .map((id: number) => mobMap.get(id))
            .filter(Boolean);

        let primaryRace = null;
        for (const b of dBosses) {
            if (b.raceId && raceMap.has(b.raceId)) {
                primaryRace = raceMap.get(b.raceId);
                break;
            }
        }

        const familyMonsters = primaryRace
            ? primaryRace.monsterIds.map(id => mobMap.get(id)).filter(Boolean)
            : [];

        return {
            id: d.id,
            name: dungeonName,
            cleanName: norm(dungeonName),
            bosses: dBosses,
            monsters: dMonsters,
            raceId: primaryRace ? primaryRace.id : null,
            raceName: primaryRace ? primaryRace.name : null,
            familyMonsters
        };
    });

    const allMonstersList = Array.from(mobMap.values()).sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name, "fr");
    });

    const outputData = {
        updatedAt: new Date().toISOString(),
        totalDungeons: compiledDungeons.length,
        totalMonsters: allMonstersList.length,
        dungeons: compiledDungeons,
        monsters: allMonstersList
    };

    // Garde anti-écrasement partiel AVANT écriture (le bon fichier reste en place si throw).
    assertDatasetCoherent(
        { dungeons: compiledDungeons, monsters: allMonstersList },
        readPreviousDataset()
    );

    // Assurer le répertoire parent
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2), "utf-8");
    logger.info(`✅ [siphonDungeonMonstersDataset] Terminé avec succès : ${compiledDungeons.length} donjons, ${allMonstersList.length} monstres.`);

    return {
        totalDungeons: compiledDungeons.length,
        totalMonsters: allMonstersList.length,
        totalBossFamilies: bossRaceIds.size,
    };
}

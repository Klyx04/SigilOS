/**
 * Génère `src/data/rush-monster-map.json` — carte **nom normalisé → fiche** du
 * bestiaire local, utilisée par le seed Rush pour résoudre les groupes de
 * monstres des tags de combat.
 *
 * Source unique : `public/game-data/unity-bestiary.json` (5 129 monstres, le
 * même fichier que `getMonsterFicheBySegment`). Aucune requête réseau : la carte
 * est déterministe et versionnée.
 *
 *   npx tsx scripts/build-rush-monster-map.ts
 *
 * Mesure du 19/11/2026 : sur les 1 443 noms individuels des 742 tags de combat,
 * **815** trouvent une fiche dans cette carte. Les autres restent des libellés
 * de rôle : le rendu les affiche en texte, jamais avec une fiche inventée.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyBossName } from "../src/lib/boss-slug";
import { normalizeRushCombatMonsterName, type RushMonsterMapEntry } from "../src/lib/rush-combat-monsters";

const SOURCE = path.join(process.cwd(), "public", "game-data", "unity-bestiary.json");
const TARGET = path.join(process.cwd(), "src", "data", "rush-monster-map.json");

type BestiaryMonster = {
    id?: unknown;
    name?: unknown;
    gfxId?: unknown;
};

function main() {
    const raw = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as Record<string, BestiaryMonster>;
    const map: Record<string, RushMonsterMapEntry> = {};
    let total = 0;
    let duplicates = 0;
    let ignored = 0;

    for (const monster of Object.values(raw)) {
        const name = typeof monster.name === "string" ? monster.name.trim() : "";
        const monsterId = Math.floor(Number(monster.id));
        const gfxId = Math.floor(Number(monster.gfxId));
        if (!name || !Number.isSafeInteger(monsterId) || monsterId <= 0) {
            ignored += 1;
            continue;
        }
        const key = normalizeRushCombatMonsterName(name);
        if (!key) {
            ignored += 1;
            continue;
        }
        total += 1;
        if (map[key]) {
            duplicates += 1;
            continue;
        }
        map[key] = {
            name,
            slug: slugifyBossName(name),
            monsterId,
            gfxId: Number.isSafeInteger(gfxId) && gfxId > 0 ? gfxId : 0,
        };
    }

    const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, JSON.stringify(sorted), "utf8");

    const size = fs.statSync(TARGET).size;
    console.log(
        `[rush-monster-map] ${Object.keys(sorted).length} entrées · ${total} lues · ` +
            `${duplicates} doublons · ${ignored} ignorées · ${(size / 1024).toFixed(1)} Ko`
    );
}

main();

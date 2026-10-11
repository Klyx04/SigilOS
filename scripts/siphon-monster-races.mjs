#!/usr/bin/env node
/**
 * Siphon du **référentiel des familles de monstres** (DofusDB) →
 * `public/game-data/monster-races.json`.
 *
 * Pourquoi ce fichier existe (mesure du 11/10/2026) : le bestiaire local
 * (`unity-bestiary.json`) porte un `raceId` par monstre, mais le seul référentiel de libellés
 * du dépôt était **déduit** de `dungeon-monsters.json` (132 races rencontrées dans les
 * donjons). Or le bestiaire utilise **263 races** : **124 n'avaient aucun libellé** (1 349
 * monstres) ⇒ le filtre « familles » produisait des pastilles « Monstre » ×N, inutilisables
 * (constat user : « c quoi ces monstres 1 machin, ça va pas »). Ces races sont de vraies
 * familles : **78 = Archimonstres**, 110 = Invocations de monstre, 196 = Monstres de quête de
 * Pwâk, 329 = Protecteurs du Sanctuaire des Jardins Éternels…
 *
 * Usage :
 *     node scripts/siphon-monster-races.mjs
 *
 * Écrit un fichier **versionné** (référentiel de jeu, ~15 Ko) : `updatedAt`, `races`
 * (`id`, `name`, `superRaceId`) et `superRaces` (`id`, `name`) — les super-races
 * (« Créatures de Cania »…) servent à **grouper** la longue liste dans le menu déroulant.
 */
import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(process.cwd(), "public", "game-data", "monster-races.json");

async function fetchPaged(baseUrl, limit = 50) {
    const items = [];
    let skip = 0;
    while (true) {
        const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}$limit=${limit}&$skip=${skip}&lang=fr`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Fetch failed for ${url}: status ${res.status}`);
            break;
        }
        const data = await res.json();
        const batch = data.data || [];
        if (!batch.length) break;
        items.push(...batch);
        if (items.length >= data.total) break;
        skip += limit;
    }
    return items;
}

async function main() {
    console.log("🚀 Siphon du référentiel des familles de monstres (races + super-races)…");

    const races = await fetchPaged("https://api.dofusdb.fr/monster-races");
    console.log(`✅ ${races.length} races récupérées.`);

    const superRaces = await fetchPaged("https://api.dofusdb.fr/monster-super-races");
    console.log(`✅ ${superRaces.length} super-races récupérées.`);

    const payload = {
        updatedAt: new Date().toISOString(),
        races: races
            .map((r) => ({
                id: Math.floor(Number(r.id) || 0),
                name: String(r.name?.fr ?? "").trim(),
                superRaceId: Math.floor(Number(r.superRaceId) || 0) || null,
            }))
            .filter((r) => r.id > 0 && r.name !== "")
            .sort((a, b) => a.id - b.id),
        superRaces: superRaces
            .map((s) => ({ id: Math.floor(Number(s.id) || 0), name: String(s.name?.fr ?? "").trim() }))
            .filter((s) => s.id > 0 && s.name !== "")
            .sort((a, b) => a.id - b.id),
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 1), "utf8");
    console.log(
        `📝 ${payload.races.length} races et ${payload.superRaces.length} super-races écrites dans ${OUTPUT_PATH}\n` +
            `   (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} Ko)`
    );
}

main().catch((error) => {
    console.error("❌ Siphon des races en échec :", error);
    process.exit(1);
});

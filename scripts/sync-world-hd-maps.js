#!/usr/bin/env node
/**
 * Sync des images HD par-map (hd_maps/{id}.webp) pour un/plusieurs mondes depuis DofusDB.
 * Usage : node scripts/sync-world-hd-maps.js <worldId> [worldId...]
 *
 * Les maps proviennent de public/game-data/worldmap.json (propriété `worldMap`).
 * Les images officielles sont récupérées via https://api.dofusdb.fr/img/maps/1/{id}.jpg
 * (1910x970, 16:9) puis converties en .webp, SANS rognage — identique au comportement
 * de siphon-brigandins.js pour le monde 38.
 * Résumable : les images déjà présentes sont sautées.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const HD_MAPS_DIR = path.join(ROOT, 'public', 'game-data', 'hd_maps');
const WORLDMAP_JSON_PATH = path.join(ROOT, 'public', 'game-data', 'worldmap.json');

const worldIds = process.argv.slice(2).map(Number);
if (worldIds.length === 0) {
    console.error('Usage: node scripts/sync-world-hd-maps.js <worldId> [worldId...]');
    process.exit(1);
}

const CONCURRENCY = 6;
const DELAY = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    if (!fs.existsSync(HD_MAPS_DIR)) fs.mkdirSync(HD_MAPS_DIR, { recursive: true });

    const wm = JSON.parse(fs.readFileSync(WORLDMAP_JSON_PATH, 'utf-8'));
    const wanted = new Set(worldIds);

    // Collecte des maps des mondes ciblés. On inclut aussi les cartes à (0,0) car
    // elles peuvent avoir une image HD utilisée par le panneau satellite / "Ton choix".
    const mapIds = [...new Set(
        (wm.maps || [])
            .filter(m => wanted.has(m.worldMap))
            .map(m => m.id)
            .filter(id => Number.isInteger(id) && id > 0)
    )];
    console.log(`\n📡 ${mapIds.length} maps à traiter pour les mondes [${worldIds.join(', ')}]`);

    const missing = mapIds.filter(id => !fs.existsSync(path.join(HD_MAPS_DIR, `${id}.webp`)));
    console.log(`   ✅ déjà présentes: ${mapIds.length - missing.length} | ⏳ à télécharger: ${missing.length}`);

    let ok = 0, fail = 0;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (id) => {
            const dest = path.join(HD_MAPS_DIR, `${id}.webp`);
            if (fs.existsSync(dest)) return 'skip';
            const url = `https://api.dofusdb.fr/img/maps/1/${id}.jpg`;
            try {
                const res = await fetch(url);
                if (!res.ok) return 'fail';
                const buf = Buffer.from(await res.arrayBuffer());
                await sharp(buf).webp({ quality: 82 }).toFile(dest);
                return 'ok';
            } catch {
                return 'fail';
            }
        }));
        for (const r of results) {
            if (r === 'ok') ok++;
            else if (r === 'fail') fail++;
        }
        if (DELAY > 0) await sleep(DELAY);
        process.stdout.write(`\r   Progression: ${Math.min(i + CONCURRENCY, missing.length)}/${missing.length} — ✅${ok} ❌${fail}`);
    }
    console.log('\n\n🏆 Terminé !');
    console.log(`   ✅ ${ok} téléchargées | ❌ ${fail} en échec (404)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

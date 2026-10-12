#!/usr/bin/env node
/**
 * Sync des tuiles officielles d'un/plusieurs mondes depuis DofusDB.
 * Usage : node scripts/sync-world-tiles.js <worldId> [worldId...]
 * Banques tentées : 1, 0.75, 0.5, 0.25, custom2, custom3 (celles qui existent sont téléchargées)
 * Convertit les .jpg officiels en .webp dans public/game-data/tiles/w{id}/{bank}/.
 * Résumable : les tuiles déjà présentes sont sautées.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TILES_DIR = path.join(ROOT, 'public', 'game-data', 'tiles');

const worldIds = process.argv.slice(2).map(Number);
if (worldIds.length === 0) { console.error('Usage: node scripts/sync-world-tiles.js <worldId> [worldId...]'); process.exit(1); }

const BANKS = ['1', '0.75', '0.5', '0.25', 'custom2', 'custom3'];
const MAX_CONSECUTIVE_FAILS = 30;
const CONCURRENCY = 6;
const DELAY = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tileExists(worldId, bank, idx) {
    const res = await fetch(`https://api.dofusdb.fr/img/worlds/${worldId}/${bank}/${idx}.jpg`, { method: 'HEAD' });
    return res.ok;
}

async function syncWorld(worldId) {
    const worldDir = path.join(TILES_DIR, `w${worldId}`);
    console.log(`\n── Monde ${worldId} ──`);
    for (const bank of BANKS) {
        // Sonde : si la 1e tuile n'existe pas, la banque est absente
        if (!(await tileExists(worldId, bank, 1))) {
            console.log(`  [${bank}] absent (banque inexistante)`);
            continue;
        }
        const bankDir = path.join(worldDir, bank);
        if (!fs.existsSync(bankDir)) fs.mkdirSync(bankDir, { recursive: true });

        let idx = 1, ok = 0, skip = 0, fail = 0, consecutiveFails = 0;
        while (consecutiveFails < MAX_CONSECUTIVE_FAILS) {
            const batch = [];
            for (let j = 0; j < CONCURRENCY && consecutiveFails < MAX_CONSECUTIVE_FAILS; j++) {
                const i = idx++;
                batch.push((async () => {
                    const url = `https://api.dofusdb.fr/img/worlds/${worldId}/${bank}/${i}.jpg`;
                    const dest = path.join(bankDir, `${i}.webp`);
                    if (fs.existsSync(dest)) return 'skip';
                    try {
                        const res = await fetch(url);
                        if (!res.ok) return 'fail';
                        const buf = Buffer.from(await res.arrayBuffer());
                        await sharp(buf).webp({ quality: 82 }).toFile(dest);
                        return 'ok';
                    } catch { return 'fail'; }
                })());
            }
            const results = await Promise.all(batch);
            for (const r of results) {
                if (r === 'ok') { ok++; consecutiveFails = 0; }
                else if (r === 'skip') { skip++; consecutiveFails = 0; }
                else { fail++; consecutiveFails++; }
            }
            if (DELAY > 0) await sleep(DELAY);
        }
        const max = idx - 1 - MAX_CONSECUTIVE_FAILS;
        console.log(`  [${bank}] ok=${ok} skip=${skip} fail=${fail} max_index=${max}`);
    }
}

async function main() {
    for (const id of worldIds) {
        await syncWorld(id);
    }
    console.log('DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });

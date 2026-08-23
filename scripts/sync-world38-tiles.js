#!/usr/bin/env node
/**
 * Sync des tuiles officielles du Monde 38 (Village des Brigandins) depuis DofusDB.
 * Usage : node scripts/sync-world38-tiles.js [bank1 bank2 ...]
 *   (sans argument : banks par défaut 1 0.75 0.5 0.25 custom2)
 * Convertit les .jpg officiels en .webp dans public/game-data/tiles/w38/{bank}/.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TILES_DIR = path.join(ROOT, 'public', 'game-data', 'tiles', 'w38');
const WORLD_ID = 38;
const DEFAULT_BANKS = ['1', '0.75', '0.5', '0.25', 'custom2'];
const MAX_CONSECUTIVE_FAILS = 30;
const CONCURRENCY = 6;
const DELAY = 25;

const banks = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_BANKS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadTile(bank, idx) {
    const url = `https://api.dofusdb.fr/img/worlds/${WORLD_ID}/${bank}/${idx}.jpg`;
    const dest = path.join(TILES_DIR, bank, `${idx}.webp`);
    if (fs.existsSync(dest)) return 'skip';
    try {
        const res = await fetch(url);
        if (!res.ok) return 'fail';
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).webp({ quality: 82 }).toFile(dest);
        return 'ok';
    } catch {
        return 'fail';
    }
}

async function syncBank(bank) {
    const bankDir = path.join(TILES_DIR, bank);
    if (!fs.existsSync(bankDir)) fs.mkdirSync(bankDir, { recursive: true });
    let idx = 1, ok = 0, skip = 0, fail = 0, consecutiveFails = 0;
    while (consecutiveFails < MAX_CONSECUTIVE_FAILS) {
        const batch = [];
        for (let j = 0; j < CONCURRENCY && consecutiveFails < MAX_CONSECUTIVE_FAILS; j++) {
            batch.push(downloadTile(bank, idx++));
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
    console.log(`[${bank}] ok=${ok} skip=${skip} fail=${fail} max_index=${max}`);
}

async function main() {
    for (const bank of banks) {
        await syncBank(bank);
    }
    console.log('DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });

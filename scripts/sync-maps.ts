import fs from 'fs';
import path from 'path';
import https from 'https';

const BASE_URL = 'https://api.dofusdb.fr/img';
const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public', 'game-data');
const WORLDS_JSON = path.join(PUBLIC_DIR, 'worlds.json');
const WORLDMAP_JSON = path.join(PUBLIC_DIR, 'worldmap.json');
const TILES_DIR = path.join(PUBLIC_DIR, 'tiles');
const HD_DIR = path.join(PUBLIC_DIR, 'hd_maps');

[TILES_DIR, HD_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

function cleanZoom(val: number): string {
    return parseFloat(val.toFixed(4)).toString();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Télécharge un fichier. Retourne: 'ok' | 'skip' (déjà local) | 'fail' (404/erreur)
function downloadFile(url: string, dest: string): Promise<'ok' | 'skip' | 'fail'> {
    return new Promise((resolve) => {
        if (fs.existsSync(dest)) { resolve('skip'); return; }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const req = https.get(url, { timeout: 20000 }, (res) => {
            if (res.statusCode === 200) {
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve('ok'); });
                file.on('error', () => { fs.unlink(dest, () => { }); resolve('fail'); });
            } else { res.resume(); resolve('fail'); }
        });
        req.on('error', () => resolve('fail'));
        req.on('timeout', () => { req.destroy(); resolve('fail'); });
    });
}

// ─────────────────────────────────────────────────
// Téléchargement SÉQUENTIEL intelligent :
// On télécharge les tuiles 1, 2, 3... et on s'arrête
// quand on obtient MAX_CONSECUTIVE_FAILS 404 d'affilée.
// Cela évite de deviner le nombre de tuiles.
// ─────────────────────────────────────────────────
const MAX_CONSECUTIVE_FAILS = 30;

async function downloadBankSequential(
    worldId: number,
    bank: string,
    delayMs = 30,
    concurrency = 4,
): Promise<{ ok: number; skip: number; fail: number }> {
    const destDir = path.join(TILES_DIR, `w${worldId}`, bank);
    let idx = 1;
    let ok = 0, skip = 0, fail = 0;
    let consecutiveFails = 0;

    while (consecutiveFails < MAX_CONSECUTIVE_FAILS) {
        // Lancer un mini-batch de `concurrency` requêtes
        const batch: Array<{ url: string; dest: string; index: number }> = [];
        for (let j = 0; j < concurrency && consecutiveFails < MAX_CONSECUTIVE_FAILS; j++) {
            const currentIdx = idx++;
            batch.push({
                url: `${BASE_URL}/worlds/${worldId}/${bank}/${currentIdx}.jpg`,
                dest: path.join(destDir, `${currentIdx}.jpg`),
                index: currentIdx,
            });
        }

        const results = await Promise.all(batch.map(b => downloadFile(b.url, b.dest)));

        for (const r of results) {
            if (r === 'ok') { ok++; consecutiveFails = 0; }
            else if (r === 'skip') { skip++; consecutiveFails = 0; }
            else { fail++; consecutiveFails++; }
        }

        if (delayMs > 0) await sleep(delayMs);
    }

    // Nettoyage : supprimer les derniers fichiers fantômes (ne devrait pas y en avoir)
    return { ok, skip, fail: fail - MAX_CONSECUTIVE_FAILS }; // Les derniers fails sont juste la sonde de fin
}

// Téléchargement en batch pour les décors HD (on connait la liste exacte)
async function downloadBatch(
    tasks: Array<{ url: string; dest: string }>,
    concurrency = 4,
    delayMs = 30,
): Promise<{ ok: number; skip: number; fail: number }> {
    let ok = 0, skip = 0, fail = 0;
    let i = 0;
    async function worker() {
        while (i < tasks.length) {
            const task = tasks[i++];
            const result = await downloadFile(task.url, task.dest);
            if (result === 'ok') ok++;
            else if (result === 'skip') skip++;
            else fail++;
            if (delayMs > 0) await sleep(delayMs);
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { ok, skip, fail };
}

// ─────────────────────────────────────────────────
async function main() {
    const worlds: any[] = JSON.parse(fs.readFileSync(WORLDS_JSON, 'utf-8'));
    const worldmap: any = JSON.parse(fs.readFileSync(WORLDMAP_JSON, 'utf-8'));

    console.log('🗺️  SYNC DOFUSDB → LOCAL');
    console.log('   Concurrency: 4 | Delay: 30ms | Stop after 30 consecutive 404s\n');

    // ── 1. Parchemin + Custom par monde ───────────
    for (const world of worlds) {
        const { id, totalWidth, totalHeight, name, zoom: zoomArr, customScales } = world;
        if (!totalWidth || !totalHeight) {
            console.log(`⏩ Monde ${id} (${name?.fr ?? '?'}) — pas de dimensions, skippé`);
            continue;
        }

        console.log(`\n── Monde ${id} : "${name?.fr ?? '?'}" (${totalWidth}×${totalHeight})`);

        // A. Banques de zoom numériques du parchemin (0.2, 0.4, 0.6, 0.8, 1.0)
        const numericBanks: number[] = zoomArr || [1];
        for (const zoomVal of numericBanks) {
            const bank = cleanZoom(zoomVal);
            process.stdout.write(`   [${bank}] `);
            const res = await downloadBankSequential(id, bank, 30, 4);
            console.log(`→ ✅${res.ok} DL | ⏭ ${res.skip} existant | total: ${res.ok + res.skip} tuiles`);
        }

        // B. Banques custom (custom2, custom3, custom5...)
        const customs: Array<{ x: number; y: number; name: string }> = customScales || [];
        const customBanks = customs.filter(s => s.name.startsWith('custom'));
        for (const cs of customBanks) {
            process.stdout.write(`   [${cs.name}] `);
            const res = await downloadBankSequential(id, cs.name, 30, 4);
            const total = res.ok + res.skip;
            if (total === 0) {
                console.log(`→ banque vide (n'existe pas)`);
            } else {
                console.log(`→ ✅${res.ok} DL | ⏭ ${res.skip} existant | total: ${total} tuiles`);
            }
        }
    }

    // ── 2. Décors HD par map ID ──────────────────
    console.log('\n\n🏙️  Décors HD par map ID...');
    const maps: any[] = worldmap.maps;
    console.log(`   ${maps.length} maps au total\n`);

    const hdTasks = maps.map((m: any) => ({
        url: `${BASE_URL}/maps/1/${m.id}.jpg`,
        dest: path.join(HD_DIR, `${m.id}.jpg`),
    }));

    const CHUNK = 500;
    let totalOk = 0, totalSkip = 0, totalFail = 0;
    for (let i = 0; i < hdTasks.length; i += CHUNK) {
        const chunk = hdTasks.slice(i, i + CHUNK);
        const r = await downloadBatch(chunk, 4, 30);
        totalOk += r.ok; totalSkip += r.skip; totalFail += r.fail;
        const done = Math.min(i + CHUNK, hdTasks.length);
        const pct = Math.round((done / hdTasks.length) * 100);
        process.stdout.write(`\r   Décors HD: ${done}/${hdTasks.length} (${pct}%) — ✅${totalOk} ⏭${totalSkip} ❌${totalFail}`);
    }

    console.log('\n\n🏆 Synchronisation complète !');
    console.log(`   ✅ ${totalOk} fichiers téléchargés`);
    console.log(`   ⏭  ${totalSkip} déjà présents`);
    console.log(`   ❌ ${totalFail} maps HD sans image (normal pour donjons instanciés)`);
}

main().catch(console.error);

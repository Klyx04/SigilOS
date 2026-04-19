import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBS_DIR = path.join(__dirname, '../public/game-data/invader/mobs');
const BOSSES_DIR = path.join(__dirname, '../public/game-data/invader/bosses');

// The IDs that failed — from the 404 logs
const MISSING_MOBS = [46, 47, 287, 288, 289, 290, 291, 292, 293, 299, 344];
const MISSING_BOSSES = []; // 147 boss exists, skip

async function getAssetUrl(id) {
    try {
        const res = await fetch(`https://api.dofusdb.fr/monsters/${id}?lang=fr`);
        const data = await res.json();
        // The 'img' field has the real image URL
        return data.img || null;
    } catch (e) {
        console.error(`[API ERROR] ID ${id}:`, e.message);
        return null;
    }
}

async function downloadAsWebp(url, destPath) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Dynamic import of sharp (CommonJS compat)
        const sharp = (await import('sharp')).default;
        await sharp(buffer).webp({ quality: 80 }).toFile(destPath);
        return true;
    } catch (e) {
        console.error(`[DOWNLOAD ERROR] ${url}:`, e.message);
        // Save raw PNG as fallback
        try {
            const res2 = await fetch(url);
            if (res2.ok) {
                const buf = Buffer.from(await res2.arrayBuffer());
                // Try saving as-is with webp extension using sharp ignoring format
                const sharp = (await import('sharp')).default;
                await sharp(buf).webp({ quality: 80 }).toFile(destPath);
                return true;
            }
        } catch {}
        return false;
    }
}

async function processId(id, targetDir, label) {
    const destPath = path.join(targetDir, `${id}.webp`);
    if (fs.existsSync(destPath)) {
        console.log(`[SKIP] ${label} ID ${id} already exists`);
        return;
    }

    console.log(`[LOOKUP] ${label} ID ${id}...`);
    const imgUrl = await getAssetUrl(id);

    if (!imgUrl) {
        console.warn(`[WARN] No image URL found for ${label} ${id} — will use fallback at runtime`);
        return;
    }

    console.log(`[DOWNLOAD] ${label} ${id} from ${imgUrl}`);
    const ok = await downloadAsWebp(imgUrl, destPath);
    if (ok) {
        console.log(`[OK] ${label} ${id} saved as WebP`);
    }
}

if (!fs.existsSync(MOBS_DIR)) fs.mkdirSync(MOBS_DIR, { recursive: true });
if (!fs.existsSync(BOSSES_DIR)) fs.mkdirSync(BOSSES_DIR, { recursive: true });

console.log(`Processing ${MISSING_MOBS.length} missing mobs + ${MISSING_BOSSES.length} missing bosses...`);

for (const id of MISSING_MOBS) {
    await processId(id, MOBS_DIR, 'mob');
}
for (const id of MISSING_BOSSES) {
    await processId(id, BOSSES_DIR, 'boss');
}

// Also check boss 147 for the /bosses/ dir specifically (different from mobs/147)
const boss147Path = path.join(BOSSES_DIR, '147.webp');
if (!fs.existsSync(boss147Path)) {
    await processId(147, BOSSES_DIR, 'boss');
}

console.log('Done!');

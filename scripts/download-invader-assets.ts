import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const BASE_URL = 'https://api.dofusdb.fr/img/monsters';
const MANIFEST_PATH = path.join(process.cwd(), 'public/game-data/invader/manifest.json');
const MOBS_DIR = path.join(process.cwd(), 'public/game-data/invader/mobs');
const BOSSES_DIR = path.join(process.cwd(), 'public/game-data/invader/bosses');

async function downloadAndConvert(id: number, type: 'mob' | 'boss') {
    const url = `${BASE_URL}/${id}.png`;
    const targetDir = type === 'mob' ? MOBS_DIR : BOSSES_DIR;
    const targetPath = path.join(targetDir, `${id}.webp`);

    if (fs.existsSync(targetPath)) {
        console.log(`[SKIP] ID ${id} (${type}) already exists.`);
        return;
    }

    try {
        console.log(`[DOWNLOADING] ID ${id} from ${url}...`);
        const response = await axios({
            url,
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(response.data, 'binary');

        // Convert to webp with compression using Sharp
        await sharp(buffer)
            .webp({ quality: 80 })
            .toFile(targetPath);

        console.log(`[SUCCESS] Saved ID ${id} as WEBP.`);
    } catch (error: any) {
        console.error(`[ERROR] Failed to process ID ${id}:`, error.message);
    }
}

async function main() {
    if (!fs.existsSync(MOBS_DIR)) fs.mkdirSync(MOBS_DIR, { recursive: true });
    if (!fs.existsSync(BOSSES_DIR)) fs.mkdirSync(BOSSES_DIR, { recursive: true });

    const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestRaw);

    console.log(`Found ${manifest.mobs.length} mobs and ${manifest.bosses.length} bosses in manifest.`);

    for (const mob of manifest.mobs) {
        await downloadAndConvert(mob.id, 'mob');
    }

    for (const boss of manifest.bosses) {
        await downloadAndConvert(boss.id, 'boss');
    }

    console.log("Download complete!");
}

main().catch(console.error);

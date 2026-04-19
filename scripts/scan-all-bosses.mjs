/**
 * Scan par plage d'IDs pour trouver TOUS les boss disponibles sur DofusDB
 * On scanne de 1 à 600, on garde ceux avec isBoss=true + une image
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOSSES_DIR = path.join(__dirname, '../public/game-data/invader/bosses');
const MANIFEST_PATH = path.join(__dirname, '../public/game-data/invader/manifest.json');

const SCAN_FROM = 1;
const SCAN_TO = 800;
const CONCURRENCY = 20; // parallel requests

async function checkId(id) {
  try {
    const res = await fetch(`https://api.dofusdb.fr/monsters/${id}?lang=fr`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.isBoss || !d.img) return null;
    return { id: d.id, name: d.name?.fr || `Boss_${id}`, img: d.img };
  } catch {
    return null;
  }
}

async function downloadAsWebp(url, destPath) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    await sharp(buffer).webp({ quality: 80 }).toFile(destPath);
    return true;
  } catch {
    return false;
  }
}

// Process in batches
async function scanBatch(ids) {
  return Promise.all(ids.map(checkId));
}

if (!fs.existsSync(BOSSES_DIR)) fs.mkdirSync(BOSSES_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const existingBossIds = new Set(manifest.bosses.map(b => b.id));

console.log(`Scanning IDs ${SCAN_FROM}–${SCAN_TO} for bosses (batch size ${CONCURRENCY})...`);

const foundBosses = [];
const ids = Array.from({ length: SCAN_TO - SCAN_FROM + 1 }, (_, i) => SCAN_FROM + i);

for (let i = 0; i < ids.length; i += CONCURRENCY) {
  const batch = ids.slice(i, i + CONCURRENCY);
  const results = await scanBatch(batch);
  for (const boss of results) {
    if (boss) {
      process.stdout.write(`✅ BOSS: ${boss.id} "${boss.name}"\n`);
      foundBosses.push(boss);
    }
  }
  // Small sleep to avoid rate limiting
  await new Promise(r => setTimeout(r, 100));
}

console.log(`\nFound ${foundBosses.length} total bosses. Downloading missing ones...`);

const newBosses = [];
for (const boss of foundBosses) {
  const destPath = path.join(BOSSES_DIR, `${boss.id}.webp`);
  if (!fs.existsSync(destPath)) {
    const ok = await downloadAsWebp(boss.img, destPath);
    console.log(ok ? `⬇  ${boss.id} ${boss.name}` : `❌ ${boss.id} ${boss.name} failed`);
  } else {
    console.log(`⏭  ${boss.id} ${boss.name}`);
  }
  if (!existingBossIds.has(boss.id)) {
    newBosses.push({ id: boss.id, name: boss.name });
    existingBossIds.add(boss.id);
  }
}

manifest.bosses = foundBosses.map(b => ({ id: b.id, name: b.name })).sort((a,b) => a.id - b.id);
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`\n✅ Manifest updated with ${manifest.bosses.length} bosses total!`);

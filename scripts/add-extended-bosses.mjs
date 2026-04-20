import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOSSES_DIR = path.join(__dirname, '../public/game-data/invader/bosses');
const MANIFEST_PATH = path.join(__dirname, '../public/game-data/invader/manifest.json');

const NEW_BOSSES = [
  {id:827,name:'Minotot'},{id:854,name:'Crocabulia'},{id:872,name:'Papa Nowel'},
  {id:874,name:'Demi Papa Nowel'},{id:928,name:"Mob l'Eponge"},{id:939,name:'Rat Noir'},
  {id:940,name:'Rat Blanc'},{id:943,name:'Sphincter Cell'},{id:1027,name:'Corailleur Magistral'},
  {id:1045,name:'Kimbo'},{id:1051,name:'Gourlo le Terrible'},{id:1071,name:'Silf le Rasboul Majeur'},
  {id:1072,name:'Tynril Consterne'},{id:1085,name:'Tynril Deconcerte'},{id:1086,name:'Tynril Perfide'},
  {id:1087,name:'Tynril Ahuri'},{id:1159,name:'Ougah'},{id:1179,name:'Sapik'},
  {id:1184,name:'Blop Coco Royal'},{id:1185,name:'Blop Griotte Royal'},{id:1186,name:'Blop Indigo Royal'},
  {id:1187,name:'Blop Reinette Royal'},{id:1188,name:'Blop Multicolore Royal'},{id:1194,name:'Pere Fwetar'}
];

async function downloadAsWebp(url, destPath) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    await sharp(buf).webp({ quality: 80 }).toFile(destPath);
    return true;
  } catch { return false; }
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const existingIds = new Set(manifest.bosses.map(b => b.id));

for (const boss of NEW_BOSSES) {
  const destPath = path.join(BOSSES_DIR, boss.id + '.webp');
  if (!fs.existsSync(destPath)) {
    try {
      const r = await fetch('https://api.dofusdb.fr/monsters/' + boss.id + '?lang=fr');
      const d = await r.json();
      if (d.img) {
        const ok = await downloadAsWebp(d.img, destPath);
        console.log(ok ? 'OK' : 'FAIL', boss.id, boss.name);
      }
    } catch (e) { console.log('ERR', boss.id, e.message); }
  } else {
    console.log('SKIP', boss.id, boss.name);
  }
  if (!existingIds.has(boss.id)) {
    manifest.bosses.push({ id: boss.id, name: boss.name });
    existingIds.add(boss.id);
  }
}

manifest.bosses.sort((a, b) => a.id - b.id);
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log('Total bosses:', manifest.bosses.length);

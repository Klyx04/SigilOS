/**
 * Script de peuplement massif des boss pour Sigil Invader
 * Interroge DofusDB par ID individuel pour trouver les boss connus
 * et télécharge leurs images.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOSSES_DIR = path.join(__dirname, '../public/game-data/invader/bosses');
const MANIFEST_PATH = path.join(__dirname, '../public/game-data/invader/manifest.json');

// ---- Liste manuelle des boss Dofus iconiques ----
// Source: connaissance DofusDB + boss de donjons classiques
const KNOWN_BOSS_IDS = [
  // Donjons Low Level
  58,   // Gelée Royale Bleuet
  85,   // Gelée Royale Menthe
  86,   // Gelée Royale Fraise
  107,  // Hell Mina
  113,  // Dragon Cochon
  121,  // Minotoror
  147,  // Bouftou Royal
  173,  // Abraknyde Ancestral
  180,  // Wa Wabbit
  226,  // Moon
  // Donjons Mid Level
  131,  // Sylvestre
  136,  // Tofu Royal (dungeon)
  143,  // Chafeur Réanimé
  155,  // Skeunk
  158,  // Araknophobia
  174,  // Roi Nidas
  175,  // Kanigroula
  185,  // Xelorium
  191,  // Dokteur Maboul
  192,  // Hyrkul
  195,  // Lollyta
  196,  // Boudalf Le Blanc
  197,  // Grozilla
  201,  // Kralamour
  203,  // Koutoulou
  204,  // Toxine
  206,  // Skeeboss
  207,  // Fafnir
  210,  // Fracasseur
  211,  // Wabbit Squelette Boss
  215,  // Hagen Daz
  217,  // Otomai
  220,  // Rat Roleur
  221,  // Dopeul Boss
  222,  // Kimbo
  223,  // Ombre
  224,  // Kardorim
  225,  // Phossil
  // Donjons High Level
  228,  // Anerice
  229,  // Sram Obscur
  230,  // Bworker
  231,  // Kapou'e
  232,  // Méulou
  235,  // Dark Vlad
  236,  // Ulticroc
  237,  // Bworkette
  239,  // Skreex
  243,  // Vortex
  248,  // Minotot
  250,  // Sylargh
  252,  // Nileza
  255,  // Count Harebourg
  256,  // Dragon de la glace
  257,  // Chouque
  258,  // Célestobule
  261,  // Ougah
  262,  // Prespic
  263,  // Robiosse
  264,  // Klime le maître des montagnes
  265,  // Djaul
  266,  // Missiz Freezz
  // Boss supplémentaires
  382,  // Tofu Royal (variante)
  383,  // Grand Tofu Royal
  400,  // Protecteur de la forêt
  401,  // Silva
  402,  // Fraktal
  403,  // Souris Verte Boss
];

async function fetchMonsterData(id) {
  try {
    const res = await fetch(`https://api.dofusdb.fr/monsters/${id}?lang=fr`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.isBoss && !data.isMiniBoss) return null; // not a boss
    return { id: data.id, name: data.name?.fr || `Boss_${id}`, img: data.img };
  } catch {
    return null;
  }
}

async function downloadAsWebp(url, destPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    await sharp(buffer).webp({ quality: 80 }).toFile(destPath);
    return true;
  } catch (e) {
    return false;
  }
}

if (!fs.existsSync(BOSSES_DIR)) fs.mkdirSync(BOSSES_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const existingBossIds = new Set(manifest.bosses.map(b => b.id));

console.log(`Currently have ${manifest.bosses.length} bosses. Checking ${KNOWN_BOSS_IDS.length} candidates...`);

const newBosses = [];

for (const id of KNOWN_BOSS_IDS) {
  process.stdout.write(`[CHECK] ID ${id}... `);
  const data = await fetchMonsterData(id);
  if (!data) {
    console.log('not a boss or not found');
    continue;
  }

  const destPath = path.join(BOSSES_DIR, `${id}.webp`);

  if (!fs.existsSync(destPath) && data.img) {
    const ok = await downloadAsWebp(data.img, destPath);
    if (!ok) {
      console.log(`❌ download failed`);
      continue;
    }
    console.log(`✅ downloaded "${data.name}"`);
  } else {
    console.log(`⏭  already exists "${data.name}"`);
  }

  if (!existingBossIds.has(id)) {
    newBosses.push({ id: data.id, name: data.name });
    existingBossIds.add(id);
  }
}

// Update manifest
manifest.bosses.push(...newBosses);
// Sort by ID for consistency
manifest.bosses.sort((a, b) => a.id - b.id);

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`\n✅ Done! Added ${newBosses.length} new bosses. Total: ${manifest.bosses.length} bosses.`);

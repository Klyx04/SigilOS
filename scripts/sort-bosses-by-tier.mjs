/**
 * Réorganise le manifeste des boss par ordre de difficulté (tiers)
 * et génère la map de patterns pour le code du jeu.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '../public/game-data/invader/manifest.json');

// =====================================
// TIERS DE DIFFICULTÉ
// 0 = Tutorial (LV1-29 Dofus)
// 1 = Easy    (LV30-59)
// 2 = Medium  (LV60-99)
// 3 = Hard    (LV100-149)
// 4 = Expert  (LV150-199)
// 5 = Brutal  (LV200+)
// =====================================

const BOSS_TIERS = {
  // ---- TIER 0 : Tutorial ----
  58:  { tier: 0, pattern: 'JELLY_BOUNCE',   name: 'Gelée Royale Bleuet' },
  85:  { tier: 0, pattern: 'JELLY_BOUNCE',   name: 'Gelée Royale Menthe' },
  86:  { tier: 0, pattern: 'JELLY_BOUNCE',   name: 'Gelée Royale Fraise' },
  147: { tier: 0, pattern: 'SPIRAL_SLOW',    name: 'Bouftou Royal' },
  382: { tier: 0, pattern: 'TRACKING_BASIC', name: 'Tofu Royal' },

  // ---- TIER 1 : Easy ----
  113: { tier: 1, pattern: 'FRONTAL_BEAM',   name: 'Dragon Cochon' },
  180: { tier: 1, pattern: 'CHAOS_RAIN',     name: 'Wa Wabbit' },
  230: { tier: 1, pattern: 'TRACKING_BASIC', name: 'Le Chouque' },
  257: { tier: 1, pattern: 'SPIRAL_SLOW',    name: 'Chene Mou' },
  430: { tier: 1, pattern: 'JELLY_BOUNCE',   name: 'Gelee Royale Citron' },
  780: { tier: 1, pattern: 'CHAOS_RAIN',     name: 'Skeunk' },

  // ---- TIER 2 : Medium ----
  107: { tier: 2, pattern: 'SPIRAL_STORM',   name: 'Hell Mina' },
  121: { tier: 2, pattern: 'TRACKING_SPREAD',name: 'Minotoror' },
  173: { tier: 2, pattern: 'TRACKING_SPREAD',name: 'Abraknyde Ancestral' },
  232: { tier: 2, pattern: 'SPIRAL_STORM',   name: 'Meulou' },
  252: { tier: 2, pattern: 'FRONTAL_BEAM',   name: 'Coffre des Forgerons' },
  289: { tier: 2, pattern: 'CHAOS_RAIN',     name: 'Maitre Corbac' },
  457: { tier: 2, pattern: 'TRACKING_SPREAD',name: 'Shin Larve' },
  799: { tier: 2, pattern: 'SPIRAL_SLOW',    name: 'Tournesol Affame' },
  800: { tier: 2, pattern: 'TRACKING_BASIC', name: 'Batofu' },

  // ---- TIER 3 : Hard ----
  226: { tier: 3, pattern: 'PHASE_BURST',    name: 'Moon' },
  423: { tier: 3, pattern: 'SPIRAL_STORM',   name: 'Kralamoure Geant' },
  478: { tier: 3, pattern: 'CHARGE_BEAM',    name: 'Bworker' },
  669: { tier: 3, pattern: 'CHAOS_RAIN',     name: 'Craqueleur Legendaire' },
  670: { tier: 3, pattern: 'CHARGE_BEAM',    name: 'Koulosse' },
  792: { tier: 3, pattern: 'TRACKING_SPREAD',name: 'Bworkette' },
  827: { tier: 3, pattern: 'FRONTAL_BEAM',   name: 'Minotot' },
  854: { tier: 3, pattern: 'PHASE_BURST',    name: 'Crocabulia' },
  1045: { tier: 3, pattern: 'CHARGE_BEAM',   name: 'Kimbo' },
  1051: { tier: 3, pattern: 'SPIRAL_STORM',  name: 'Gourlo le Terrible' },

  // ---- TIER 4 : Expert ----
  872: { tier: 4, pattern: 'DOUBLE_SPIRAL',  name: 'Papa Nowel' },
  874: { tier: 4, pattern: 'PHASE_BURST',    name: 'Demi Papa Nowel' },
  928: { tier: 4, pattern: 'CHAOS_RAIN',     name: "Mob l'Eponge" },
  939: { tier: 4, pattern: 'TRACKING_SPREAD',name: 'Rat Noir' },
  940: { tier: 4, pattern: 'DOUBLE_SPIRAL',  name: 'Rat Blanc' },
  943: { tier: 4, pattern: 'CHARGE_BEAM',    name: 'Sphincter Cell' },
  797: { tier: 4, pattern: 'DOUBLE_SPIRAL',  name: 'Scarabosse Dore' },
  1027: { tier: 4, pattern: 'SPIRAL_STORM',  name: 'Corailleur Magistral' },
  1071: { tier: 4, pattern: 'DOUBLE_SPIRAL', name: 'Silf le Rasboul Majeur' },
  1072: { tier: 4, pattern: 'CHARGE_BEAM',   name: 'Tynril Consterne' },
  1085: { tier: 4, pattern: 'PHASE_BURST',   name: 'Tynril Deconcerte' },
  1159: { tier: 4, pattern: 'DOUBLE_SPIRAL', name: 'Ougah' },
  1179: { tier: 4, pattern: 'CHAOS_RAIN',    name: 'Sapik' },

  // ---- TIER 5 : Brutal ----
  1086: { tier: 5, pattern: 'HELLFIRE',      name: 'Tynril Perfide' },
  1087: { tier: 5, pattern: 'HELLFIRE',      name: 'Tynril Ahuri' },
  1184: { tier: 5, pattern: 'DOUBLE_SPIRAL', name: 'Blop Coco Royal' },
  1185: { tier: 5, pattern: 'DOUBLE_SPIRAL', name: 'Blop Griotte Royal' },
  1186: { tier: 5, pattern: 'DOUBLE_SPIRAL', name: 'Blop Indigo Royal' },
  1187: { tier: 5, pattern: 'DOUBLE_SPIRAL', name: 'Blop Reinette Royal' },
  1188: { tier: 5, pattern: 'HELLFIRE',      name: 'Blop Multicolore Royal' },
  1194: { tier: 5, pattern: 'HELLFIRE',      name: 'Pere Fwetar' },
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

// Rebuild bosses array sorted by tier then ID
const enriched = manifest.bosses.map(b => {
  const info = BOSS_TIERS[b.id];
  return {
    id: b.id,
    name: info?.name || b.name,
    tier: info?.tier ?? 2, // default mid
    pattern: info?.pattern ?? 'SPIRAL_SLOW',
  };
});

// Sort: tier ASC, then id ASC within tier
enriched.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : a.id - b.id);

// Write back
manifest.bosses = enriched;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

console.log('Boss manifest updated with tiers:');
for (let t = 0; t <= 5; t++) {
  const bosses = enriched.filter(b => b.tier === t);
  const label = ['Tutorial','Easy','Medium','Hard','Expert','Brutal'][t];
  console.log(`  Tier ${t} (${label}): ${bosses.map(b => b.name).join(', ')}`);
}
console.log(`\nTotal: ${enriched.length} bosses`);

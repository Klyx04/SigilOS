#!/usr/bin/env node
/**
 * SIPHON — effets passifs **officiels** des objets (Dofus, objets légendaires, bénédictions…)
 * → `src/data/item-passives.json` (fichier **versionné**, aucune requête au runtime).
 *
 * Pourquoi ce fichier existe (mesure du 23/10/2026) :
 *   · `src/lib/dofus-passives.ts` ne portait que **24 textes écrits à la main** et, pour les
 *     Prysmaradites, un texte **inventé** (« Effet tactique déclenché lors du premier tour ») ;
 *     les objets légendaires retombaient sur « Effet passif unique déclenché en combat ».
 *   · Le vrai porteur de l'effet est la ligne native **`effectId: 1175`** (capacité légendaire) :
 *     `diceNum` = **id du sort passif**, `diceSide` = grade. Mesuré sur `Dofus Turquoise` (739)
 *     → `diceNum 5952` → `GET /spells/5952` = « Dofus Turquoise », description FR officielle
 *     (« Lorsque le porteur effectue un coup critique, il gagne 1% de dommages finaux… »).
 *   · **344 objets** de la base portent cette ligne (Dofus, « Épée Langue de Feu », bénédictions…).
 *
 * Source : `GET https://api.dofusdb.fr/spells/{id}` (`adminName`, `description.fr`). Le texte est
 * stocké **verbatim** (balisage `{{spell,id,grade::Nom}}` compris) : le nettoyage vit dans la règle
 * pure (`cleanPassiveMarkup`, testée), pour ne jamais altérer la donnée source.
 *
 * Idempotent : clés triées, ré-exécution sans changement ⇒ fichier identique (git ne bouge pas).
 *
 * Usage :
 *     node scripts/siphon-item-passives.mjs             # écrit le fichier
 *     node scripts/siphon-item-passives.mjs --dry-run   # affiche le résumé, n'écrit rien
 *     node scripts/siphon-item-passives.mjs --refresh   # ignore le cache local des sorts
 */
try {
  await import("dotenv/config");
} catch {
  // `dotenv` absent (image standalone) : DATABASE_URL vient de l'environnement.
}
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refresh = args.includes("--refresh");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL absent — impossible de lire le catalogue d'objets.");
  process.exit(1);
}

const OUTPUT = path.join(process.cwd(), "src", "data", "item-passives.json");
const SPELL_API = "https://api.dofusdb.fr/spells";
const DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

/** Ligne native de capacité légendaire : `diceNum` = sort, `diceSide` = grade. */
const LEGENDARY_CAPACITY_EFFECT_ID = 1175;

function readCapacity(effects) {
  if (!Array.isArray(effects)) return null;
  const line = effects.find((fx) => Number(fx?.effectId) === LEGENDARY_CAPACITY_EFFECT_ID);
  if (!line) return null;
  // `possibleEffects` porte diceNum/diceSide ; `nativeEffects` porte from/to.
  const spellId = Number(line.diceNum ?? line.from ?? 0);
  const grade = Number(line.diceSide ?? line.to ?? 1) || 1;
  if (!Number.isFinite(spellId) || spellId <= 0) return null;
  return { spellId, grade };
}

async function fetchSpell(id) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${SPELL_API}/${id}?lang=fr`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const text = json?.description?.fr;
      if (typeof text !== "string" || text.trim().length === 0) return null;
      return {
        name: String(json?.adminName || json?.name?.fr || `Sort ${id}`),
        text,
      };
    } catch (err) {
      if (attempt === 3) {
        console.warn(`⚠️  sort ${id} : ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
      await sleep(DELAY_MS * attempt);
    }
  }
  return null;
}

/** Charge le catalogue existant (sert de cache : on ne re-fetch que ce qui manque). */
function readExisting() {
  try {
    const parsed = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
    return parsed && typeof parsed.spells === "object" && parsed.spells ? parsed.spells : {};
  } catch {
    return {};
  }
}

async function main() {
  // 1. Objets portant la capacité légendaire (les deux colonnes : `effects` = possibleEffects,
  //    `nativeEffects` = version légère ; on interroge les deux pour ne rien manquer).
  const rows = await db.$queryRaw`
    SELECT "ankamaId", name, "typeName", effects, "nativeEffects"
    FROM "GameItem"
    WHERE effects::text LIKE '%"effectId": 1175%'
       OR "nativeEffects"::text LIKE '%"effectId": 1175%'
    ORDER BY "ankamaId"
  `;

  const wanted = new Map(); // spellId → { grade, items: string[] }
  for (const row of rows) {
    const capacity = readCapacity(row.effects) ?? readCapacity(row.nativeEffects);
    if (!capacity) continue;
    const entry = wanted.get(capacity.spellId) ?? { grade: capacity.grade, items: [] };
    entry.grade = Math.min(entry.grade, capacity.grade);
    if (row.name) entry.items.push(row.name);
    wanted.set(capacity.spellId, entry);
  }

  const ids = [...wanted.keys()].sort((a, b) => a - b);
  console.log(`📦 ${rows.length} objet(s) porteur(s) de la capacité 1175 → ${ids.length} sort(s) passif(s).`);

  const existing = readExisting();
  const spells = {};
  let fetched = 0;
  let reused = 0;

  for (const id of ids) {
    const cached = existing[String(id)];
    if (!refresh && cached && typeof cached.text === "string" && cached.text.length > 0) {
      spells[String(id)] = { name: cached.name, text: cached.text };
      reused += 1;
      continue;
    }
    const spell = await fetchSpell(id);
    if (!spell) continue;
    spells[String(id)] = spell;
    fetched += 1;
    await sleep(DELAY_MS);
  }

  // Clés triées : ré-exécution idempotente.
  const sorted = {};
  for (const key of Object.keys(spells).sort((a, b) => Number(a) - Number(b))) sorted[key] = spells[key];

  const payload = {
    source: "DofusDB /spells (effet 1175 → sort passif)",
    generatedAt: new Date().toISOString().slice(0, 10),
    count: Object.keys(sorted).length,
    spells: sorted,
  };

  console.log(`✅ ${Object.keys(sorted).length} sort(s) — ${fetched} récupéré(s), ${reused} depuis le cache.`);
  if (dryRun) {
    console.log("🔎 --dry-run : aucun fichier écrit.");
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`💾 ${path.relative(process.cwd(), OUTPUT)} (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} Ko)`);
}

main()
  .catch((err) => {
    console.error("❌ Siphon des passifs interrompu :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

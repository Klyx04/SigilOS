#!/usr/bin/env node
/**
 * MAINTENANCE — remet les VRAIS objets sur les tags `item` du dataset Rush Sylvestre.
 *
 * Pourquoi : le générateur du dataset (hors dépôt, côté session de l'auteur) écrit des
 * placeholders `{type:"item", name:"Objet", count:N}` — sans nom ni id — d'où « Objet ×25 »
 * et une icône vide dans le guide, le dashboard et l'overlay. Mesuré le 08/10/2026 :
 * 536 tags sur 335 quêtes.
 *
 * Sources (locales, dans cet ordre) :
 *   1. la **trame siphonée** (`--trame`) : `const RUSH_DATA` → les quêtes vivent dans TOUTES les
 *      propriétés tableau dont le nom contient « quete »/« quest » (`quetes`, `bontaQuests`,
 *      `brakQuests`). ⚠️ N'en lire qu'une partie fait manquer des quêtes : mesuré le 08/10/2026,
 *      deux clés sur trois = **368 quêtes manquées** (dont « Le dragon Blanc », 8 items).
 *   2. le dataset **versionné** `src/data/rush-sylvestre-guide.enriched.json` (03/09/2026, 320 tags
 *      déjà résolus depuis DofusDB).
 *
 * Appariement : URL DofusPourLesNoobs, sinon libellé normalisé (`normKey`, source unique partagée
 * avec le seed). Les deux sources partagent l'espace d'ids du catalogue local
 * (`GameItem.ankamaId` — vérifié : 537 = Pomme de Terre, 421 = Ortie, 15990 = Baguette Rikiki),
 * donc l'icône sort du WebP local `/uploads/assets-dofus/items/{id}.webp` (zéro appel externe).
 *
 * DRY-RUN par défaut ; `--apply` réécrit le dataset. **Aucune écriture en base** :
 * relancer `node scripts/seed-rush-sylvestre-cli.mjs --apply` ensuite.
 *
 * Usage :
 *   node scripts/enrich-rush-guide-items.mjs
 *   node scripts/enrich-rush-guide-items.mjs --apply
 *   node scripts/enrich-rush-guide-items.mjs --trame temp/ma-trame.html --dataset src/data/mon-guide.json
 */
import fs from "node:fs";
import { normKey } from "./lib/rush-guide-keys.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const TRAME = valueOf("--trame", "temp/rush-sylvestre-trame-complete.html");
const DATASET = valueOf("--dataset", "src/data/rush-sylvestre-guide.json");
const ENRICHED = "src/data/rush-sylvestre-guide.enriched.json";

/** Extrait `const RUSH_DATA = {…}` par comptage d'accolades (chaînes respectées). */
function extractRushData(html) {
  const marker = "const RUSH_DATA = ";
  const at = html.indexOf(marker);
  if (at < 0) throw new Error("`const RUSH_DATA` introuvable dans la trame");
  const start = html.indexOf("{", at);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let p = start; p < html.length; p++) {
    const c = html[p];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, p + 1));
    }
  }
  throw new Error("`RUSH_DATA` non terminé (accolade fermante manquante)");
}

/** Tag `item` canonique : `{type,id,name,count}` (l'UI résout le WebP depuis `id`). */
const toTags = (items) =>
  items.map((it) => ({
    type: "item",
    id: it.id ?? null,
    name: it.name,
    count: it.count ?? it.qty ?? 1,
  }));

// ── Source 1 : la trame siphonée ───────────────────────────────────────────────
const trame = extractRushData(fs.readFileSync(TRAME, "utf8"));
const questKeys = [];
for (const step of trame.steps || []) {
  for (const [key, value] of Object.entries(step)) {
    if (Array.isArray(value) && /quete|quest/i.test(key) && !questKeys.includes(key)) questKeys.push(key);
  }
}
if (questKeys.length === 0) throw new Error("Aucune propriété de quêtes trouvée dans la trame");

const quests = [];
for (const step of trame.steps || []) {
  for (const key of questKeys) {
    for (const q of step[key] || []) if (q && typeof q === "object") quests.push(q);
  }
}
const byUrl = new Map();
const byTitle = new Map();
for (const q of quests) {
  const entry = { source: "trame", label: q.t, items: toTags(q.items || []) };
  if (q.u) byUrl.set(q.u, entry);
  const key = normKey(q.t);
  if (key && !byTitle.has(key)) byTitle.set(key, entry);
}

// ── Source 2 : dataset « enriched » versionné ─────────────────────────────────
const enriched = JSON.parse(fs.readFileSync(ENRICHED, "utf8"));
const enrByUrl = new Map();
const enrByName = new Map();
for (const q of enriched.quests || []) {
  const entry = {
    source: "enriched",
    label: q.name,
    items: toTags((q.activityTags || []).filter((t) => t && t.type === "item")),
  };
  if (q.dofuspourlesnoobsUrl) enrByUrl.set(q.dofuspourlesnoobsUrl, entry);
  const key = normKey(q.name);
  if (key) enrByName.set(key, entry);
}

// ── Résolution ────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(DATASET, "utf8"));
const seqName = (s) => s.subGuideName || s.subGuideRef || s.name || "";

let seqTotal = 0;
let placeholderBefore = 0;
let itemTagsAfter = 0;
let unresolvedWithoutId = 0;
let rewritten = 0;
const bySource = new Map();
const orphans = [];
const names = new Set();

for (const ms of data.milestones || []) {
  for (const seq of ms.sequences || []) {
    seqTotal++;
    const tags = Array.isArray(seq.activityTags) ? seq.activityTags : [];
    const before = tags.filter((t) => t && t.type === "item");
    placeholderBefore += before.length;

    const wanted = normKey(seqName(seq));
    let hit = byUrl.get(seq.dofuspourlesnoobsUrl);
    let how = "trame/url";
    if (!hit) {
      hit = byTitle.get(wanted);
      how = "trame/titre";
    }
    if (!hit) {
      hit = enrByUrl.get(seq.dofuspourlesnoobsUrl);
      how = "enriched/url";
    }
    if (!hit) {
      hit = enrByName.get(wanted);
      how = "enriched/nom";
    }
    if (!hit) {
      if (before.length > 0) orphans.push(`${ms.title} › ${seqName(seq)}`);
      continue;
    }

    bySource.set(how, (bySource.get(how) || 0) + 1);
    const real = hit.items;
    real.forEach((it) => names.add(it.name));
    unresolvedWithoutId += real.filter((it) => it.id == null).length;
    const others = tags.filter((t) => t && t.type !== "item");
    seq.activityTags = [...others, ...real];
    itemTagsAfter += real.length;
    if (before.length !== real.length) rewritten++;
  }
}

console.log(`Trame            : ${(trame.steps || []).length} étapes · ${quests.length} quêtes (clés : ${questKeys.join(", ")})`);
console.log(`Dataset          : ${seqTotal} quêtes · ${placeholderBefore} tags item AVANT`);
console.log(`Appariées        : ${[...bySource].sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);
console.log(`Tags item APRÈS  : ${itemTagsAfter} · ${names.size} noms · ${unresolvedWithoutId} sans id`);
console.log(`Quêtes modifiées : ${rewritten} · sans source : ${orphans.length}`);
if (orphans.length) orphans.slice(0, 10).forEach((o) => console.log(`   - ${o}`));

if (!apply) {
  console.log("\nDRY-RUN — rien écrit. Relancer avec --apply (puis re-seed).");
  process.exit(0);
}

if (data.meta) data.meta.itemsTaggedCount = itemTagsAfter;
if (data.preparation) {
  data.preparation.items = [...names]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((name) => ({ name, imageUrl: null }));
}
fs.writeFileSync(DATASET, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`\n✅ Écrit : ${DATASET} (itemsTaggedCount=${itemTagsAfter}, preparation.items=${names.size})`);
console.log("   → relancer maintenant : node scripts/seed-rush-sylvestre-cli.mjs --apply");

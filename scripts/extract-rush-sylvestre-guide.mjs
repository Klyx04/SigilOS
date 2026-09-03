#!/usr/bin/env node
/**
 * Extracteur du guide « Route Sylvestre » du streamer Laniyelle.
 * Lit les exports HTML (Google Sheets -> HTML) extraits manuellement et produit
 * un jeu de données normalisé (`item` + `metier`) prêt à être injecté dans les
 * tags `activityTags` des séquences Rush (GuideSequence).
 *
 * Sortie (par défaut, DRY-RUN : n'écrit PAS en base) :
 *   src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-guide-data.json
 *
 * Usage :
 *   node scripts/extract-rush-sylvestre-guide.mjs             -> génère le JSON + résumé
 *   node scripts/extract-rush-sylvestre-guide.mjs --raw       -> n'écrit pas, affiche seulement
 *
 * Source : src/temp/refonte-guide-sylvestre/extracted/
 *   - Préparation.html  -> métiers requis (Paysan 200, Alchimiste 40, ...) + tâches de prep
 *   - Ressources.html   -> objets requis (nom + quantité)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACTED = path.resolve(__dirname, "../src/temp/refonte-guide-sylvestre/extracted");
const OUT_FILE = path.resolve(__dirname, "../src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-guide-data.json");

const raw = process.argv.includes("--raw");

// ─── Helpers de lecture (alignés sur extract-sheet.js) ───────────────────────
function readRows(file) {
  const html = fs.readFileSync(path.join(EXTRACTED, file), "utf8");
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
}
function decode(s) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&uuml;/g, "ü")
    .replace(/&ocirc;/g, "ô")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function cells(row) {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1]));
}

// ─── Extraction des métiers (Préparation.html, ligne « Monter les métiers ») ──
function extractMetiers() {
  const rows = readRows("Préparation.html");
  const found = [];
  for (const row of rows) {
    const c = cells(row);
    const text = c[2] && c[2].toLowerCase().includes("monter les métiers") ? c[2] : null;
    if (!text) continue;
    // format : "Monter les métiers : Paysan 200 Alchimiste 40 ..." + alternative (c[3])
    const parseList = (s) => {
      const out = [];
      const body = s.replace(/^.*?métiers\s*:\s*/i, "");
      const tokens = body.match(/([A-Za-zÀ-ÖØ-öø-ÿ' -]+?)\s+(\d{1,3})(?=\s+[A-Za-zÀ-ÖØ-öø-ÿ' -]+\s+\d|\s*$)/g) || [];
      for (const t of tokens) {
        const m = t.trim().match(/^(.*?)\s+(\d{1,3})$/);
        if (m) out.push({ name: m[1].trim(), level: parseInt(m[2], 10) });
      }
      return out;
    };
    found.push({ source: "main", metiers: parseList(c[2]) });
    if (c[3]) found.push({ source: "alternative", metiers: parseList(c[3]) });
  }
  return found;
}

// ─── Extraction des objets (Ressources.html : nom + quantité) ────────────────
function extractItems() {
  const rows = readRows("Ressources.html");
  const items = [];
  for (const row of rows) {
    const c = cells(row);
    const name = c[0];
    const qty = c[1];
    if (!name || /^(ressource|nombre)$/i.test(name)) continue;
    if (!qty) continue;
    const n = parseInt(String(qty).replace(/[^\d]/g, ""), 10);
    items.push({ name, quantity: Number.isNaN(n) ? null : n });
  }
  return items;
}

// ─── Assemblage ──────────────────────────────────────────────────────────────
const metiers = extractMetiers();
const items = extractItems();

const dataset = {
  meta: {
    source: "Route Sylvestre (Laniyelle) — exports Google Sheets",
    generatedAt: new Date().toISOString(),
    note: "DRY-RUN : aucun tag écrit en base.",
  },
  metiers,
  items,
  counts: {
    metiers: metiers.reduce((acc, g) => acc + g.metiers.length, 0),
    items: items.length,
  },
};

if (!raw) {
  fs.writeFileSync(OUT_FILE, JSON.stringify(dataset, null, 2) + "\n", "utf8");
}

console.log("=== Extraction « Route Sylvestre (Laniyelle) » ===");
console.log(`  Métiers trouvés   : ${dataset.counts.metiers}`);
for (const g of metiers) console.log(`    [${g.source}] ` + g.metiers.map((m) => `${m.name} ${m.level}`).join(" · "));
console.log(`  Objets trouvés    : ${dataset.counts.items}`);
console.log(`  (premiers)        : ` + items.slice(0, 12).map((i) => `${i.name}(${i.quantity})`).join(", "));
console.log(raw ? "  --raw : rien écrit." : `  -> ${OUT_FILE}`);

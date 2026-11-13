#!/usr/bin/env node
/**
 * Siphon du guide Rush Sylvestre de Dofusyelle — **données brutes, zone volatile**.
 *
 * Mesure du 03/11/2026 : Dofusyelle n'expose **aucune API**. Le guide est un fichier JS en dur
 * (`window.RUSH_DATA = { steps, prep, donjons, resources }`), référencé par la page
 * `rush-sylvestre.html` sous `assets/js/rush-sylvestre-data.js?v=…`. L'ancien chemin
 * `assets/js/rush-sylvestre/data.js` (siphon du 08/10/2026) répond **404**.
 *
 * Sortie : `src/temp/archive/siphon-align/dofusyelle-rush-data.json` — **zone volatile**
 * (`docs/agents/zone-volatile.md`) : jamais committée, jamais importée dans `src/lib`, jamais
 * un seed. Le dépôt ne porte que ce script et la règle de corrélation.
 *
 * Usage : `node scripts/siphon-dofusyelle-rush.mjs [--url <url>]`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAGE = "https://dofusyelle.com/rush-sylvestre.html";
const DEFAULT_SCRIPT = "https://dofusyelle.com/assets/js/rush-sylvestre-data.js";
const OUT_FILE = "src/temp/archive/siphon-align/dofusyelle-rush-data.json";

const valueOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** Le fichier de données est référencé par la page avec un cache-buster (`?v=…`). */
async function resolveScriptUrl() {
  const explicit = valueOf("--url", "");
  if (explicit) return explicit;
  const page = await fetch(PAGE);
  if (!page.ok) throw new Error(`page Dofusyelle ${page.status} — arrêt (fail-closed)`);
  const html = await page.text();
  const match = html.match(/assets\/js\/rush-sylvestre-data\.js\?v=[\w.-]+/);
  if (!match) throw new Error("fichier de données introuvable dans la page — arrêt (fail-closed)");
  return new URL(match[0], PAGE).toString();
}

function parseRushData(source) {
  const start = source.indexOf("window.RUSH_DATA");
  if (start < 0) throw new Error("`window.RUSH_DATA` absent du fichier — arrêt (fail-closed)");
  const brace = source.indexOf("{", start);
  if (brace < 0) throw new Error("objet `RUSH_DATA` introuvable — arrêt (fail-closed)");
  // Le fichier est un littéral JS : on isole l'objet par équilibrage des accolades.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return JSON.parse(source.slice(brace, i + 1));
    }
  }
  throw new Error("objet `RUSH_DATA` non terminé — arrêt (fail-closed)");
}

const url = await resolveScriptUrl();
const response = await fetch(url);
if (!response.ok) throw new Error(`données Dofusyelle ${response.status} — arrêt (fail-closed)`);
const source = await response.text();
const data = parseRushData(source);

const steps = Array.isArray(data.steps) ? data.steps : [];
const donjons = Array.isArray(data.donjons) ? data.donjons : Object.values(data.donjons ?? {});
const resources = Array.isArray(data.resources) ? data.resources : Object.values(data.resources ?? {});
const questLines = steps.reduce((total, step) => total + (Array.isArray(step.quetes) ? step.quetes.length : 0), 0);
const aides = steps.filter((step) => String(step.aide ?? "").trim()).length;
const notesDonjons = donjons.filter((donjon) => donjon && String(donjon.note ?? "").trim()).length;

const outPath = path.resolve(OUT_FILE);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`source   : ${url}`);
console.log(`sortie   : ${path.relative(process.cwd(), outPath)}`);
console.log(
  `mesure   : ${steps.length} étapes · ${questLines} lignes de quêtes · ${aides} aides · ` +
    `${donjons.length} donjons (${notesDonjons} avec note) · ${resources.length} ressources`,
);

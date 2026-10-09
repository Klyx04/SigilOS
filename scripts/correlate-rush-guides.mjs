#!/usr/bin/env node
/**
 * CORRÉLATION des guides siphonnés — Rush Sylvestre (alignement Bonta / Brâkmar).
 *
 * Sources (siphonnées à côté, jamais inventées) :
 *   1. `temp/siphon-align/www-dofuspourlesnoobs-com-alignement-{bontarien,bracirckmarien}-html.html`
 *      → les listes ORDONNÉES des 100 quêtes d'alignement de chaque camp (les deux listes
 *        sont parallèles : la position apparie les jumelles) + les **6 ordres** (3 par camp)
 *        avec leurs 5 rangs et leur seuil (« Alignement > 20/40/60/80/100 »).
 *   2. `temp/siphon-align/tougli-guide-details.json` (API `api.tougli.barbofus.com`) →
 *      530 quêtes (`name` 4 langues, `dplnUrl` NOOBS, `optimalLevel`, `verified`,
 *      **items + recettes**, obstacles/combats), 376 items, 99 donjons, `guide.objectives`
 *      (structure ordonnée des chapitres).
 *   3. `temp/siphon-align/dofusyelle-com-assets-js-rush-sylvestre-data-js.js` →
 *      `RUSH_DATA` : 57 étapes (`cat` « Alignement Bonta »), 384 quêtes `{t,u}`,
 *      83 donjons, 531 ressources, 21 points de préparation.
 *   4. `src/data/rush-sylvestre-guide.json` — NOTRE dataset (à corriger).
 *
 * Sortie : un RAPPORT de corrélation (dry-run). Aucune écriture sans `--apply`.
 * Usage : node scripts/correlate-rush-guides.mjs [--siphon <dir>] [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import { normKey } from "./lib/rush-guide-keys.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SIPHON = valueOf("--siphon", "temp/siphon-align");
const DATASET = valueOf("--dataset", "src/data/rush-sylvestre-guide.json");
const BONTA_HTML = path.join(SIPHON, "www-dofuspourlesnoobs-com-alignement-bontarien-html.html");
const BRAK_HTML = path.join(SIPHON, "www-dofuspourlesnoobs-com-alignement-bracirckmarien-html.html");
const TOUGLI_JSON = path.join(SIPHON, "tougli-guide-details.json");
const YELLE_JS = path.join(SIPHON, "dofusyelle-com-assets-js-rush-sylvestre-data-js.js");

const readFile = (p) => fs.readFileSync(path.resolve(p), "utf8");
/** Entités HTML → texte (les pages NOOBS sont encodées : `qu&ecirc;tes`). */
const decodeEntities = (s) =>
  s
    .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&agrave;/g, "à")
    .replace(/&ecirc;/g, "ê").replace(/&icirc;/g, "î").replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û").replace(/&acirc;/g, "â").replace(/&ccedil;/g, "ç")
    .replace(/&Eacute;/g, "É").replace(/&Ecirc;/g, "Ê").replace(/&Agrave;/g, "À")
    .replace(/&ocirc;/g, "ô").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;/g, "’")
    .replace(/&OElig;/g, "Œ").replace(/&oelig;/g, "œ").replace(/&iuml;/g, "ï")
    .replace(/&Acirc;/g, "Â").replace(/&Icirc;/g, "Î").replace(/&Ocirc;/g, "Ô")
    .replace(/&Ucirc;/g, "Û").replace(/&Egrave;/g, "È").replace(/&Ccedil;/g, "Ç")
    .replace(/&euml;/g, "ë").replace(/&Euml;/g, "Ë").replace(/&Iuml;/g, "Ï")
    // `&gt;` sert aux seuils d'Ordre (« Alignement &gt; 20 ») : sans ce décodage, aucune
    // ligne d'Ordre ne s'analyse. `&lt;` reste encodé exprès (le décoder créerait de
    // fausses balises que `stripTags` mangerait ensuite).
    .replace(/&gt;/g, ">");
/** Retire les balises et normalise les espaces (les pages NOOBS sont encodées en entités). */
const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
/**
 * Quêtes d'alignement d'une page NOOBS : liste ORDONNÉE + les 3 ordres de cité du camp.
 * `camp` est déduit du fichier lu (bontarien / brakmarien) — la page ne le dit qu'en titre.
 */
function parseAlignmentPage(file, camp) {
  const html = decodeEntities(readFile(file));
  const marker = "Les quêtes d'alignement.";
  const first = html.indexOf(marker);
  const start = html.indexOf(marker, first + marker.length);
  const ordersAt = html.indexOf("Les ordres et leurs quêtes", start);
  if (start < 0 || ordersAt < 0) throw new Error(`Structure inattendue dans ${file}`);
  const body = html.slice(start, ordersAt);

  // L'unité d'appariement est le **slot** (`<li>`) : la source met plusieurs quêtes dans
  // un même `<li>` quand elles se font ensemble (« Un maître ès pion. **et** Le magnanime.
  // **et** Les kamas résolvent tout. **et** Assassinat effectué. »). Apparier les `<a>`
  // un à un décalerait tout ce qui suit ces groupes.
  const slots = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let lm;
  while ((lm = liRe.exec(body))) {
    const items = [...lm[1].matchAll(/<a\b[^>]*href="(\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((a) => ({ title: stripTags(a[2]), url: "https://www.dofuspourlesnoobs.com" + a[1] }))
      .filter((q) => q.title.length >= 3);
    if (items.length) slots.push(items);
  }

  // Ordres de cité : la section RÉELLE se repère à `class="order-title">Nom<` — la table
  // des matières du haut n'a que des ancres (`#coeur-vaillant`), et les rangs sont des
  // liens suivis de leur seuil : `<a …>Apprentissage : X</a> (Alignement > 20).`
  const ordersBlock = html.slice(html.indexOf('class="order-title">'));
  const marks = [...ordersBlock.matchAll(/class="order-title">([^<]{3,60})</g)];
  const orders = marks.map((mk, i) => {
    const from = mk.index;
    const rawTo = i + 1 < marks.length ? marks[i + 1].index : ordersBlock.indexOf("Liste des choses");
    const seg = ordersBlock.slice(from, rawTo < 0 ? ordersBlock.length : rawTo);
    const ranks = [
      ...seg.matchAll(
        /href="(\/[^"]+\.html)"[^>]*>\s*Apprentissage\s*:\s*([^<]{3,60}?)\s*<\/a>\s*\(\s*Alignement\s*>\s*(\d+)\s*\)/g,
      ),
    ].map((r) => ({
      title: r[2].trim(),
      url: "https://www.dofuspourlesnoobs.com" + r[1],
      level: Number(r[3]),
    }));
    return { order: mk[1].replace(/^Ordre\s+(?:du|de l')?\s*/i, "").trim(), camp, ranks };
  });

  return { camp, slots, orders };
}

/** Quêtes Tougli (clé = URL DofusPourLesNoobs) : le détail technique par quête. */
function parseTougli(file) {
  const j = JSON.parse(readFile(file));
  const slug = Object.keys(j.data)[0];
  const g = j.data[slug];
  const byUrl = new Map();
  const byName = new Map();
  for (const q of Object.values(g.quests)) {
    const entry = {
      id: q.id,
      name: q.name?.fr ?? null,
      url: q.dplnUrl ?? null,
      level: q.optimalLevel ?? null,
      verified: !!q.verified,
      items: (q.items || []).map((it) => ({
        id: it.item?.id ?? null,
        name: it.item?.name?.fr ?? null,
        count: it.count ?? 1,
        ingredients: (it.item?.ingredientIds || []).map((iid, k) => ({
          id: iid,
          qty: (it.item?.quantities || [])[k] ?? 1,
        })),
      })),
      obstacles: (q.objectives || []).map((o) => o.type),
    };
    if (entry.url) byUrl.set(entry.url.replace(/\/$/, "").toLowerCase(), entry);
    if (entry.name) byName.set(normKey(entry.name), entry);
  }
  return { slug, byUrl, byName, items: Object.keys(g.items).length, dungeons: Object.keys(g.dungeons).length, objectives: g.guide.objectives.length };
}

/** Route Dofusyelle (`window.RUSH_DATA`) : 57 étapes, quêtes `{t,u}`. */
function parseYelle(file) {
  const raw = readFile(file);
  const at = raw.indexOf("window.RUSH_DATA");
  const start = raw.indexOf("{", at);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let p = start; p < raw.length; p++) {
    const c = raw[p];
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
      if (depth === 0) {
        const d = JSON.parse(raw.slice(start, p + 1));
        return {
          steps: d.steps?.length ?? 0,
          quests: (d.steps || []).flatMap((s) => s.quetes || []),
          alignSteps: (d.steps || []).filter((s) => /alignement/i.test(s.cat || "")).map((s) => s.n),
          dungeons: d.donjons?.length ?? 0,
          resources: d.resources?.length ?? 0,
          prep: d.prep?.length ?? 0,
        };
      }
    }
  }
  throw new Error("RUSH_DATA illisible");
}

// ── Sources ───────────────────────────────────────────────────────────────────
const bonta = parseAlignmentPage(BONTA_HTML, "bontarien");
const brak = parseAlignmentPage(BRAK_HTML, "brakmarien");
const tougli = parseTougli(TOUGLI_JSON);
const yelle = parseYelle(YELLE_JS);
const dataset = JSON.parse(readFile(DATASET));

const dsByTitle = new Map();
const dsByUrl = new Map();
let dsSeqTotal = 0;
for (const ms of dataset.milestones || []) {
  for (const seq of ms.sequences || []) {
    dsSeqTotal++;
    const key = normKey(seq.subGuideName || seq.subGuideRef || "");
    if (key) dsByTitle.set(key, { ms, seq });
    if (seq.dofuspourlesnoobsUrl) dsByUrl.set(String(seq.dofuspourlesnoobsUrl).replace(/\/$/, "").toLowerCase(), { ms, seq });
  }
}
const findInDataset = (q) =>
  !q ? null : dsByUrl.get(q.url.replace(/\/$/, "").toLowerCase()) || dsByTitle.get(normKey(q.title)) || null;

console.log(`Sources siphonnées (${SIPHON})`);
console.log(
  `  Dofusyelle   : ${yelle.steps} étapes · ${yelle.quests.length} quêtes · ${yelle.dungeons} donjons · ${yelle.resources} ressources · ${yelle.prep} prépa (étapes alignement : ${yelle.alignSteps.join(", ")})`,
);
console.log(
  `  Tougli (API) : « ${tougli.slug} » · ${tougli.byUrl.size} quêtes indexées par URL · ${tougli.items} items · ${tougli.dungeons} donjons · ${tougli.objectives} objectifs de structure`,
);
console.log(`  NOOBS Bonta  : ${bonta.slots.length} slots · ${bonta.slots.flat().length} quêtes · ${bonta.orders.length} ordres`);
console.log(`  NOOBS Brâkmar: ${brak.slots.length} slots · ${brak.slots.flat().length} quêtes · ${brak.orders.length} ordres`);
console.log(`  Dataset      : ${dsSeqTotal} quêtes`);

// Appariement par SLOT (position) : une entrée peut porter plusieurs quêtes (« et »).
const total = Math.max(bonta.slots.length, brak.slots.length);
let pairedSlots = 0;
let bontaInDs = 0;
let brakInDs = 0;
let bontaInTougli = 0;
let brakInTougli = 0;
const brakToCreate = [];
const bontaMissing = [];
const multiSlots = [];
const checkQuest = (q, side) => {
  if (!q) return null;
  const inDs = findInDataset(q);
  const inTougli = tougli.byUrl.get(q.url.replace(/\/$/, "").toLowerCase()) ?? null;
  if (side === "bonta") {
    if (inDs) bontaInDs++;
    else bontaMissing.push(q.title);
    if (inTougli) bontaInTougli++;
  } else {
    if (inDs) brakInDs++;
    if (inTougli) brakInTougli++;
    if (!inDs && inTougli) {
      brakToCreate.push({ title: q.title, url: q.url, items: inTougli.items.length, slot: inTougli });
    }
  }
  return inDs;
};
for (let i = 0; i < total; i++) {
  const bs = bonta.slots[i] ?? [];
  const ks = brak.slots[i] ?? [];
  if (bs.length && ks.length) pairedSlots++;
  if (bs.length > 1 || ks.length > 1) {
    multiSlots.push(`slot ${i + 1} : Bonta [${bs.map((q) => q.title).join(" + ")}] ⇄ Brâkmar [${ks.map((q) => q.title).join(" + ")}]`);
  }
  const twins = bs.map((q) => checkQuest(q, "bonta"));
  ks.forEach((q, idx) => checkQuest(q, "brak"));
  brakToCreate.slice(0, 0); // (le détail par quête est déjà tracé ci-dessus)
  if (twins.some((t) => t)) continue;
}

console.log(`\nAppariement par SLOT (position) : ${pairedSlots} / ${total}`);
console.log(`  quêtes déjà dans notre dataset : bonta ${bontaInDs} · brâkmar ${brakInDs}`);
console.log(`  détail technique Tougli : bonta ${bontaInTougli} · brâkmar ${brakInTougli}`);
console.log(`  slots portant PLUSIEURS quêtes (à faire ensemble) : ${multiSlots.length}`);
for (const s of multiSlots.slice(0, 6)) console.log(`    ${s}`);
console.log(`  à CRÉER (Brâkmar absentes + détail Tougli disponible) : ${brakToCreate.length}`);
for (const c of brakToCreate.slice(0, 12)) {
  console.log(`    « ${c.title} » — ${c.items} item(s) — ${c.url.replace("https://www.dofuspourlesnoobs.com/", "")}`);
}
if (brakToCreate.length > 12) console.log(`    … +${brakToCreate.length - 12}`);
if (bontaMissing.length) {
  console.log(`\n  ⚠️ Bonta absentes de notre dataset (${bontaMissing.length}) : ${bontaMissing.slice(0, 12).join(" · ")}`);
}

console.log("\nOrdres de cité (source NOOBS) :");
for (const o of [...bonta.orders, ...brak.orders]) {
  console.log(`  [${o.camp}] Ordre ${o.order} — ${o.ranks.length} rangs :`);
  for (const r of o.ranks) console.log(`     ${r.title} (> ${r.level})`);
}

if (!apply) {
  console.log("\nDRY-RUN — aucune écriture. (L'écriture dans le dataset viendra après validation du placement.)");
  process.exit(0);
}
throw new Error("--apply : le placement des blocs n'est pas encore branché (le rapport doit être relu d'abord).");

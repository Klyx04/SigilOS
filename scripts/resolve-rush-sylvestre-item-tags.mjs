#!/usr/bin/env node
/**
 * RÉSOLUTION DES TAGS « item » DU RUSH SYLVESTRE (Phase E).
 *
 * Pour chaque séquence, les `activityTags` de type `item` ne portent qu'un `name`
 * (texte issu du « à prévoir : … » DPLN). Ce script :
 *   1. DÉCODE les résidus d'entités HTML (DPLN encode parfois `&Eacute;`, `&OElig;`,
 *      `&Ecirc;`… qui n'ont pas été résolus par l'orchestrateur) → nom propre.
 *   2. CLASSE le tag : `resource` (vrai item) vs `instruction` (phrase d'action,
 *      condition, craft, « aller à… », « posséder… », « avoir… ») vs `unresolved`.
 *   3. RÉSOUT `id`, `imageUrl` et `url` (DofusDB `/items`) via un match EXACT
 *      `name.fr[$eq]` (fail-closed), avec replis (titre de casse, partie avant « ( »).
 *
 * NON destructif : ne modifie QUE les champs des tags `item` (jamais le reste de
 *   la séquence), ne remplace jamais un `id`/`imageUrl` déjà présent, ne supprime
 *   aucun tag. `name` n'est corrigé que si un résidu d'entité est décodé.
 *
 * Usage : node scripts/resolve-rush-sylvestre-item-tags.mjs [--apply]
 * Env   : RATE_MS (déf. 120) · CONCURRENCY (déf. 3)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/data/rush-sylvestre-guide.enriched.json");
const CACHE_DIR = path.join(ROOT, "src/temp/refonte-guide-sylvestre/enrich-cache");
const ITEM_CACHE = path.join(CACHE_DIR, "dofusdb-item-cache.json");

const RATE_MS = Number(process.env.RATE_MS ?? 400);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2));
const UA = "Mozilla/5.0 SigilOS";
const APPLY = process.argv.includes("--apply");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// getJson : timeout COURT (7s) + retries TRÈS limités, pour que le throttling DofusDB
// fasse échouer vite (→ unresolved) au lieu de bloquer le pipeline. On ne veut pas
// que chaque requête throttlée attende 20s.
async function getJson(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000) });
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(500); continue; }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (e.name === "AbortError" || i === retries - 1) throw e;
      await sleep(400);
    }
  }
  throw new Error("GET retries exhausted");
}

// ── Décodage des résidus d'entités HTML (DPLN) ───────────────────────────────
const ENT = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", "#039": "'",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
  yacute: "ý", yuml: "ÿ", ntilde: "ñ", ccedil: "ç",
  laquo: "«", raquo: "»", rsquo: "’", mdash: "—", ndash: "–", hellip: "…",
  // déclinaisons MAJUSCULES (non gérées par l'orchestrateur)
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  Ccedil: "Ç", Ntilde: "Ñ", OElig: "Œ", oelig: "œ", AElig: "Æ", aelig: "æ",
};

function decodeName(s = "") {
  let n = (s || "").replace(/<[^>]*>/g, " ");
  n = n.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  n = n.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  n = n.replace(/&([a-zA-Z]+);/g, (_, k) => (Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : k));
  n = n.replace(/Eacute/g, "É").replace(/Egrave/g, "È").replace(/Ecirc/g, "Ê")
    .replace(/Iacute/g, "Í").replace(/Oacute/g, "Ó").replace(/Uacute/g, "Ú")
    .replace(/Ccedil/g, "Ç").replace(/Ntilde/g, "Ñ")
    .replace(/OElig/g, "Œ").replace(/oelig/g, "œ").replace(/AElig/g, "Æ").replace(/aelig/g, "æ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

// ── Classification instruction vs ressource ─────────────────────────────────
const INSTRUCTION_RE = /\b(il vous faudra|il faudra|vous devez|vous pouvez|vous n['’]aurez|il vous suffit|il faut)\b/i;
const ACTION_RE = /\b(aller|posséder|posseder|avoir|prévoir|prevoir|se rendre|rendez-vous|accompagnement|être|etre|un ami|un métier|condition|tranche|réalisable|réaliser|récupérer|recuperer|fabriquer|craft|chasse au trésor|sort |succès|succes|artisanat|personnage|niveau)\b/i;

function classify(name, resolved) {
  if (resolved) return { kind: "resource" };
  const n = name.toLowerCase();
  if (INSTRUCTION_RE.test(n)) return { kind: "instruction" };
  if (/(,|\()/.test(n) && /(\b(avoir|posséder|aller|prévoir|être|etre|niveau|sort|succès|succes|métier|personnage))\b/.test(n)) return { kind: "instruction" };
  if (/^\s*(avoir|posséder|aller|prévoir|être|etre|un |une |des |la |le |les |il |elle|rien|aucune|\(|«)/.test(n)) return { kind: "instruction" };
  if (ACTION_RE.test(n)) return { kind: "instruction" };
  // Conditions économiques / récompenses en kamas (achat, « pour » ou « ou » + montant), ou précisions de drop à paliers.
  if (/[\d\s,.]+\s*kamas\b/.test(n) && /(\b(pour|ou|contre|moyennant)\b|kamas)/.test(n)) return { kind: "instruction" };
  if (/\b(palier\s+[ivx]+\b|\brêve\s+iii\b|\bou\s+\+\s+et\s+palier)/.test(n)) return { kind: "instruction" };
  if (/\b(tranches\s+horaires)\b/.test(n)) return { kind: "instruction" };
  if (/\b(ça peut être vous)\b/.test(n)) return { kind: "instruction" };
  if (/\b(avec altération idole de)\b/.test(n)) return { kind: "instruction" };
  // Entités mal décodées (résidu DPLN non résolu par l'orchestrateur).
  if (/eacutepice/i.test(name)) return { kind: "resource", override: "Épice" };
  return { kind: "unresolved" };
}

// ── Résolution DofusDB (nom → item) ─────────────────────────────────────────
// Alias manuels : nom tel que scanné par DPLN → nom exact DofusDB (casse/accents).
// Utile quand `name.fr[]` renvoie 0 pour la variante du guide mais 1 pour le nom officiel.
const ALIAS = {
  "Ebonite": "Ébonite",
  "Bois d'Erable": "Bois d'Érable",
  "Larme d’Eniripsa": "Larme d'Eniripsa",
  "Larme d'Eniripsa": "Larme d'Eniripsa",
  "Eacutepice": "Épice",
  "Bière d’Amakna": "Bière d'Amakna",
  "Bière d'Amakna": "Bière d'Amakna",
};

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

// Normalisation accent/ligature/apostrophe pour un repli de recherche insensible.
function stripAccents(s = "") {
  return (s || "")
    .replace(/œ/gi, "oe").replace(/æ/gi, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'");
}

async function searchEq(name) {
  try {
    // `name.fr[]` = filtre d'égalité exacte (l'opérateur `[$eq]` n'existe pas → 400).
    const u = `https://api.dofusdb.fr/items?${encodeURIComponent("name.fr[]")}=${encodeURIComponent(name)}&$limit=5`;
    const j = await getJson(u);
    const data = j.data || [];
    if (j.total === 0 || data.length === 0) return null;
    return { id: data[0].id, name: data[0].name?.fr || name, img: data[0].img || null, ambiguous: j.total > 1 };
  } catch {
    return null;
  }
}

// Repli : recherche par nom normalisé (accents/ligatures/apostrophes retirés) sur
// la liste renvoyée, car `name.fr[]` est strictement sensible à la casse/accents.
async function searchEqInsensitive(name) {
  const target = stripAccents(name).toLowerCase();
  if (!target || target.length < 2) return null;
  try {
    const u = `https://api.dofusdb.fr/items?${encodeURIComponent("name.fr[]")}=${encodeURIComponent(stripAccents(name))}&$limit=50`;
    const j = await getJson(u);
    const data = j.data || [];
    const found = data.find((d) => stripAccents(d.name?.fr || "").toLowerCase() === target);
    if (!found) return null;
    return { id: found.id, name: found.name?.fr || name, img: found.img || null, ambiguous: j.total > 1 };
  } catch {
    return null;
  }
}

async function resolveName(decoded) {
  // Ne pas requêter DofusDB pour des phrases manifestement « instruction ».
  const cls = classify(decoded, false);
  if (cls.kind === "instruction") return null;
  // Nom réel à chercher : override du classifier, alias manuel, sinon le nom tel quel.
  const target = ALIAS[decoded] || cls.override || decoded;
  // 1) match EXACT (le plus fiable — le guide recopie les noms du jeu).
  let r = await searchEq(target);
  if (r && target !== decoded) { r = { ...r, name: decoded }; }
  if (r) return r;
  // 1bis) match insensible aux accents/ligatures/apostrophes (ex. « Bois d'Erable » → « Bois d'Érable »).
  r = await searchEqInsensitive(target);
  if (r && target !== decoded) { r = { ...r, name: decoded }; }
  if (r) return r;
  // 2) repli : partie avant « ( » / « , » / « ou » (ex. « Diamant (craft…) »).
  const before = decoded.split(/[(:]/)[0].replace(/[\s,;:]+$/g, "").trim();
  if (before && before.length > 2 && before !== decoded) {
    r = await searchEq(before); if (r) return r;
    r = await searchEqInsensitive(before); if (r) return r;
  }
  // 3) repli : capitalisation (ex. « Eau potable » → « Eau Potable »), noms courts seulement.
  if (decoded.split(/\s+/).length <= 4) {
    const tc = titleCase(decoded);
    if (tc !== decoded) { r = await searchEq(tc); if (r) return r; }
  }
  return null;
}

// ── Pipeline ────────────────────────────────────────────────────────────────
function loadCache() {
  try { return JSON.parse(fs.readFileSync(ITEM_CACHE, "utf8")); } catch { return {}; }
}
function saveCache(c) {
  fs.mkdirSync(path.dirname(ITEM_CACHE), { recursive: true });
  fs.writeFileSync(ITEM_CACHE, JSON.stringify(c, null, 2) + "\n", "utf8");
}

async function main() {
  const guide = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const itemCache = loadCache();

  const unique = new Map(); // nomBru → decoded
  for (const q of guide.quests) {
    for (const t of q.activityTags || []) {
      if (t.type === "item" && t.name) {
        if (!unique.has(t.name)) unique.set(t.name, decodeName(t.name));
      }
    }
  }
  console.log(`Tags « item » uniques : ${unique.size} (cache ${Object.keys(itemCache).length} entrées)`);

  const queue = [...unique.entries()].filter(([bru]) => itemCache[bru] === undefined);
  const total = queue.length;
  let done = 0;

  async function worker() {
    while (queue.length) {
      const [bru, decoded] = queue.shift();
      if (itemCache[bru] === undefined) {
        const found = await resolveName(decoded);
        itemCache[bru] = found ? { id: found.id, name: found.name, img: found.img, ambiguous: found.ambiguous } : null;
        done++;
        if (done % 20 === 0) { saveCache(itemCache); console.log(`… ${done}/${total} « ${decoded.slice(0, 40)} »`); }
        await sleep(RATE_MS);
      } else {
        done++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveCache(itemCache);

  // Application (non destructive)
  let resolvedTags = 0, instructionTags = 0, unresolvedTags = 0, renamedTags = 0;
  for (const q of guide.quests) {
    for (const t of q.activityTags || []) {
      if (t.type !== "item" || !t.name) continue;
      const key = itemCache[t.name];
      if (key && key.id != null) {
        const decoded = decodeName(t.name);
        if (key.name && key.name !== t.name && decoded === key.name) {
          t.name = key.name; // correction d'encodage (ex. Eacutepée → Épée)
          renamedTags++;
        }
        if (t.id == null) t.id = key.id;
        if (t.imageUrl == null && key.img) t.imageUrl = key.img;
        if (t.url == null) t.url = `https://dofusdb.fr/database/item/${key.id}`;
        t.kind = "resource";
        if (key.ambiguous) t.ambiguous = true;
        resolvedTags++;
      } else {
        const c = classify(decodeName(t.name), false);
        // Correctif non-destructif de classification : on ne rétrograde jamais un
        // item déjà résolu en ressource, mais on écrase un `unresolved` mal classé
        // (phrases « pour kamas », « avec altération Idole », …) par `instruction`.
        if (c.kind === "instruction" && (!t.kind || t.kind === "unresolved")) t.kind = "instruction";
        else if (!t.kind) t.kind = c.kind;
        if (t.kind === "instruction") instructionTags++;
        else if (t.kind === "unresolved") unresolvedTags++;
      }
    }
  }

  console.log(`\nRésolution : resource=${resolvedTags} · instruction=${instructionTags} · unresolved=${unresolvedTags} · noms corrigés=${renamedTags}`);

  if (APPLY) {
    fs.writeFileSync(OUT, JSON.stringify(guide, null, 2) + "\n", "utf8");
    console.log(`→ ÉCRIT : ${OUT}`);
  } else {
    console.log(`→ DRY-RUN : passez --apply pour écrire (${OUT})`);
  }
}

main().catch((e) => { console.error("ERREUR :", e.message); process.exit(1); });


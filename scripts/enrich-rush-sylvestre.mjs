#!/usr/bin/env node
/**
 * ORCHESTRATEUR D'ENRICHISSEMENT — Rush Sylvestre (toutes les quêtes du guide).
 *
 * Pour CHAQUE séquence il assemble :
 *   - dofusdbUrl            : via l'API DofusDB (api.dofusdb.fr/quests) → id → /quest/{id}
 *   - dofuspourlesnoobsUrl  : slug DPLN réel (alignement prioritaire, sinon dérivation validée)
 *   - mapPositions          : « Position de lancement : {zone} [{x},{y}] » de la page DPLN
 *   - activityTags          : « à prévoir : … » (item / combat / donjon) + tag alignment_set
 *   - alignReq/alignOrderReq: quêtes d'alignement via ALIGNEMENT-dpln.json
 *
 * NON destructif : n'écrit QUE un JSON enrichi (`src/data/rush-sylvestre-guide.enriched.json`),
 *   jamais la base. Batch + cache disque + rate-limit + concurrency limitée.
 *
 * Usage : node scripts/enrich-rush-sylvestre.mjs [--limit N] [--reset-cache]
 *   --limit N      ne traite que les N premières séquences (test)
 *   --reset-cache  supprime le cache disque et re-scrape
 * Env : RATE_MS (pause entre requêtes, déf. 700) · CONCURRENCY (déf. 2)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATASET = path.join(ROOT, "src/data/rush-sylvestre-guide.json");
const ALIGN = path.join(ROOT, "src/temp/refonte-guide-sylvestre/ALIGNEMENT-dpln.json");
const CACHE_DIR = path.join(ROOT, "src/temp/refonte-guide-sylvestre/enrich-cache");
const DOFUSDB_CACHE = path.join(CACHE_DIR, "dofusdb.json");
const OUT = path.join(ROOT, "src/data/rush-sylvestre-guide.enriched.json");
const DOFUSDB_QUEST_INDEX = path.join(CACHE_DIR, "dofusdb-quests.json"); // index canonique id+nom (toutes les quêtes DofusDB)

const RATE_MS = Number(process.env.RATE_MS ?? 700);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2));
const UA = "Mozilla/5.0 SigilOS";

const args = process.argv.slice(2);
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const RESET = args.includes("--reset-cache");
const FORCE = args.includes("--force"); // re-résout tout (dont DofusDB), en réutilisant les caches DPLN + index

function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ────────────────────────────────────────────────────────────────────────────
function norm(s = "") {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Normalisation pour le mapping DofusDB : on étend les ligatures (œ→oe, æ→ae)
// PUIS on applique norm() (suppression des diacritiques + ponctuation → espaces).
// Ainsi « entrainement » ≈ « entraînement », « oeufs » ≈ « œufs ».
function normK(s = "") {
  return norm((s || "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/Œ/g, "oe")
    .replace(/Æ/g, "ae"));
}

// Encodage DPLN des accents dans l'URL (é→eacute, î→icirc, …)
const ACC = {
  "à": "agrave", "á": "aacute", "â": "acirc", "ã": "atilde", "ä": "auml", "å": "aring",
  "è": "egrave", "é": "eacute", "ê": "ecirc", "ë": "euml",
  "ì": "igrave", "í": "iacute", "î": "icirc", "ï": "iuml",
  "ò": "ograve", "ó": "oacute", "ô": "ocirc", "õ": "otilde", "ö": "ouml",
  "ù": "ugrave", "ú": "uacute", "û": "ucirc", "ü": "uuml",
  "ý": "yacute", "ÿ": "yuml", "ñ": "ntilde", "ç": "ccedil",
  "œ": "oelig", "æ": "aelig", "ß": "szlig",
};

// Slug DPLN réel : encodage des accents + ponctuation → tirets. `Brâkmar` → `bracirckmar`.
function dplnSlug(name) {
  let s = (name || "").normalize("NFC").toLowerCase().trim().replace(/[.!?]+$/, "");
  let out = "";
  for (const ch of s) {
    if (ACC[ch]) out += ACC[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === "'" || ch === "\u2019" || ch === "’") continue;
    else out += "-";
  }
  return out
    .replace(/bracircmar/g, "bracirckmar") // Brâkmar (quirk DPLN)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function dec(s = "") {
  const ENT = {
    nbsp: " ", amp: "&", quot: '"', apos: "'", "#039": "'",
    agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä",
    egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
    igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
    ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö",
    ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
    yacute: "ý", yuml: "ÿ", ntilde: "ñ", ccedil: "ç",
    laquo: "«", raquo: "»", rsquo: "’", mdash: "—", ndash: "–", hellip: "…",
  };
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&([a-zA-Z]+);/g, (_, k) => (Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : k))
    .replace(/\s+/g, " ")
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url) {
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}
function getText(url) {
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Caches disque
// ────────────────────────────────────────────────────────────────────────────
function loadCache(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function saveCache(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ────────────────────────────────────────────────────────────────────────────
// Résolveur DofusDB (id de quête → dofusdbUrl)
// ────────────────────────────────────────────────────────────────────────────
const dofusdbCache = (RESET || FORCE) ? {} : loadCache(DOFUSDB_CACHE, {});

function levenshtein(a, b) {
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[la][lb];
}
function similarity(a, b) {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// ── Index canonique DofusDB (toutes les quêtes) — source de précision ──
let questIndex = null; // [{ id, nameFr, slugFr, categoryId, levelMin, levelMax, type, _n }]

async function loadQuestIndex(force = false) {
  if (questIndex && !force) return questIndex;
  if (!force && fs.existsSync(DOFUSDB_QUEST_INDEX)) {
    try { questIndex = JSON.parse(fs.readFileSync(DOFUSDB_QUEST_INDEX, "utf8")); } catch { questIndex = null; }
  }
  if (!questIndex) {
    questIndex = [];
    let skip = 0, total = Infinity;
    while (skip < total) {
      await sleep(RATE_MS);
      const data = await getJson(`https://api.dofusdb.fr/quests?$skip=${skip}&$limit=50`);
      const rows = data.data || [];
      total = data.total ?? total;
      for (const it of rows) {
        questIndex.push({
          id: it.id,
          nameFr: it.name?.fr || "",
          slugFr: it.slug?.fr || "",
          categoryId: it.categoryId,
          levelMin: it.levelMin,
          levelMax: it.levelMax,
          type: it.type,
        });
      }
      if (rows.length < 50) break;
      skip += 50;
    }
    saveCache(DOFUSDB_QUEST_INDEX, questIndex);
    console.log(`Index DofusDB : ${questIndex.length} quêtes construites.`);
  }
  for (const q of questIndex) q._n = normK(q.nameFr);
  return questIndex;
}

// Matching fail-closed : un résultat n'est renvoyé QUE si le meilleur candidat
// est à la fois proche ET sans ambiguïté (garde anti-faux-positifs → précision 1.0).
function matchQuestInIndex(gn) {
  let best = null, second = null;
  for (const q of questIndex) {
    // Garde de performance : on ignore les noms de longueur trop éloignée.
    if (Math.abs(q._n.length - gn.length) > 8) continue;
    const sc = similarity(gn, q._n);
    if (!best || sc > best.score) { second = best; best = { ...q, score: sc }; }
    else if (!second || sc > second.score) second = { ...q, score: sc };
  }
  return { best, second };
}

function resolveFromIndex(gn) {
  if (!gn) return null;
  const { best, second } = matchQuestInIndex(gn);
  if (!best) return null;
  const score = Number(best.score.toFixed(3));
  const exact = best.score >= 0.97;
  // Deux quêtes dont LE MÊME nom normalisé existe → ambiguïté réelle → on refuse.
  const ambiguousExact = exact && second && second.score >= 0.97 && second.id !== best.id;
  // Une correspondance NORMALISÉE EXACTE est faisant autorité (sauf collision d'id).
  if (exact && !ambiguousExact) {
    return { id: best.id, url: `https://dofusdb.fr/database/quest/${best.id}`, name: best.nameFr, slug: best.slugFr, categoryId: best.categoryId, levelMin: best.levelMin, score };
  }
  // Sinon : score élevé + sans ambiguïté (la 2e meilleure doit être nettement plus loin).
  const unambiguous = !second || (best.score - second.score) >= 0.06;
  if (best.score >= 0.86 && unambiguous) {
    return { id: best.id, url: `https://dofusdb.fr/database/quest/${best.id}`, name: best.nameFr, slug: best.slugFr, categoryId: best.categoryId, levelMin: best.levelMin, score };
  }
  return null;
}

async function resolveDofusdb(name) {
  const key = normK(name);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(dofusdbCache, key)) return dofusdbCache[key];
  await loadQuestIndex();
  const clean = name.normalize("NFC").replace(/[’']/g, " ").replace(/[.!?\u00a0]+$/g, "");
  const rec = resolveFromIndex(normK(clean) || key);
  dofusdbCache[key] = rec;
  saveCache(DOFUSDB_CACHE, dofusdbCache);
  return rec;
}

// ────────────────────────────────────────────────────────────────────────────
// Extraction Phase C (page DPLN : position + « à prévoir »)
// ────────────────────────────────────────────────────────────────────────────
function extractPageData(html) {
  const out = { mapPositions: [], prevoir: [], title: "" };
  // Titre de la page (validation : le slug dérivé peut pointer vers une AUTRE quête).
  const tt = html.match(/<h3[^>]*class="secondTitle"[^>]*>([\s\S]*?)<\/h3>|<title>([\s\S]*?)<\/title>/i);
  if (tt) out.title = dec(tt[1] || tt[2] || "").replace(/\s*-\s*DofusPourLesNoobs.*$/i, "").trim();
  // Position de lancement : Zone [x,y].
  const pos = html.match(/Position de lancement\s*:\s*([^.[]+?)\s*\[(-?\d+)\s*,\s*(-?\d+)\]/i);
  if (pos) out.mapPositions = [{ x: +pos[2], y: +pos[3], label: dec(pos[1]) }];
  // à prévoir : … (les items sont séparés par <br> ; le § s'arrête au § suivant)
  const pv = html.match(/(?:à|&agrave;|a)\s+pr(?:&eacute;|é)voir\s*:\s*([\s\S]{0,2000}?)(?=NOTE\b|R(?:&eacute;|é)compenses|<\/div>|<\/head>|Aide\b|Conseils\b)/i);
  if (pv) {
    const lines = pv[1].split(/<br\s*\/?\s*>|<\s*\/?li\s*>|<\/?ul\s*>/gi).map((l) => dec(l)).filter(Boolean);
    for (const line of lines) {
      const m = line.trim().match(/^(\d+)\s*x\s*(.+)$/i);
      if (m) out.prevoir.push({ count: +m[1], name: m[2].trim() });
      else if (/^[A-ZÀ-ÖØ-Ý]/i.test(line.trim()) && line.trim().length > 1) out.prevoir.push({ count: 1, name: line.trim() });
    }
  }
  return out;
}

function cleanTagName(s = "") {
  return (s || "").replace(/[.!?\u00a0;:~<>"'`]+$/g, "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").trim();
}

function classifyPrevoir(list, align) {
  const tags = [];
  const seen = new Set();
  for (const p of list) {
    const name = cleanTagName(p.name);
    if (!name) continue;
    const n = name.toLowerCase();
    let type = "item";
    if (n.includes("combat") || n.includes("vague")) type = "combat_vagues";
    else if (n.includes("donjon")) type = "donjon";
    else if (n.includes("protecteur") || n.includes("groupe")) continue;
    const k = type + "|" + n;
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push({ type, name, count: p.count ?? 1 });
  }
  if (align) tags.push({ type: "alignment_set", name: align.camp, level: align.level });
  return tags;
}

// ────────────────────────────────────────────────────────────────────────────
// Alignement (source de vérité : ALIGNEMENT-dpln.json)
// ────────────────────────────────────────────────────────────────────────────
const alignCache = {};
function loadAlignment() {
  try {
    const a = JSON.parse(fs.readFileSync(ALIGN, "utf8"));
    for (const camp of ["bontarien", "brakmarien"]) {
      for (const q of (a[camp]?.quests || [])) {
        alignCache[norm(q.quest)] = { level: q.level, camp: camp === "bontarien" ? "Bonta" : "Brâkmar", slug: q.slug };
      }
    }
  } catch { /* alignement absent : on continue sans */ }
}
function matchAlignment(name) {
  const key = norm(name);
  if (alignCache[key]) return alignCache[key];
  for (const k of Object.keys(alignCache)) if (k.includes(key) || key.includes(k)) return alignCache[k];
  return null;
}


// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────
const META_NAMES = new Set(["métiers requis", "ressources à prévoir"]);

function loadSequences() {
  const ds = JSON.parse(fs.readFileSync(DATASET, "utf8"));
  const seqs = [];
  for (const ms of ds.milestones) {
    for (const s of ms.sequences) {
      if (META_NAMES.has(norm(s.name))) continue;
      seqs.push({ milestone: ms.title, name: s.name, dungeonIds: s.dungeonIds, succès: s.succès, notes: ms.notes });
    }
  }
  return seqs;
}

async function enrichOne(seq, dplnCache) {
  const align = matchAlignment(seq.name);
  const rec = {
    name: seq.name, milestone: seq.milestone,
    alignReq: null, alignOrderReq: null, alignment: null,
    dofusdbUrl: null, dofuspourlesnoobsUrl: null,
    questDbIds: [], dofusName: null, dofusScore: null,
    mapPositions: [], activityTags: [], dungeonIds: seq.dungeonIds,
  };
  if (align) { rec.alignReq = align.level; rec.alignOrderReq = align.level; rec.alignment = { camp: align.camp, level: align.level }; }

  // dofusdbUrl
  const db = await resolveDofusdb(seq.name);
  if (db?.url) {
    rec.dofusdbUrl = db.url;
    rec.questDbIds = [db.id];
    rec.dofusName = db.name ?? null;
    rec.dofusScore = db.score ?? null;
  }

  // dofuspourlesnoobsUrl : slug réel. Alignement = slug sûr (liste DPLN). Sinon slug dérivé
  //   → on valide le TITRE de la page (fail-closed) car un slug dérivé peut tomber sur une AUTRE quête.
  let slug = align?.slug || dplnSlug(seq.name);
  let page = dplnCache[slug];
  let verified = false; // true seulement si la page correspond bien à la quête
  if (page === undefined) {
    await sleep(RATE_MS);
    try {
      const html = await getText(`https://www.dofuspourlesnoobs.com/${slug}.html`);
      page = { ok: true, data: extractPageData(html) };
    } catch {
      page = { ok: false, data: null };
    }
    dplnCache[slug] = page;
    saveCache(path.join(CACHE_DIR, "dpln-pages.json"), dplnCache);
  }
  if (page?.ok) {
    if (align) verified = true; // slug réel = page correcte
    else if (page.data?.title) verified = similarity(norm(seq.name), norm(page.data.title)) >= 0.5;
    if (verified) {
      rec.dofuspourlesnoobsUrl = `https://www.dofuspourlesnoobs.com/${slug}.html`;
      rec.mapPositions = page.data.mapPositions || [];
      rec.activityTags = classifyPrevoir(page.data.prevoir || [], align);
    } else {
      rec.slugUnverified = true;
    }
  }
  return rec;
}

async function main() {
  if (RESET) fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  loadAlignment();
  // construit/charge l'index canonique DofusDB UNE fois, avant les workers (évite le double build sous concurrence)
  await loadQuestIndex();
  const dplnCache = loadCache(path.join(CACHE_DIR, "dpln-pages.json"), {});

  const seqs = loadSequences();
  const prev = (RESET || FORCE) ? {} : loadCache(OUT, {});
  const prevQuests = Array.isArray(prev.quests) ? prev.quests : [];
  const done = new Set(prevQuests.map((q) => norm(q.name)));
  const pending = seqs.filter((s) => !done.has(norm(s.name)));
  const target = pending.slice(0, LIMIT);
  console.log(`Séquences : ${seqs.length} · déjà fait : ${done.size} · à traiter : ${target.length} (CONCURRENCY ${CONCURRENCY}, RATE ${RATE_MS}ms)`);

  const results = prevQuests; // résumable
  const baseLen = prevQuests.length;
  let idx = 0;
  const queue = [...target];
  async function worker() {
    while (queue.length) {
      const seq = queue.shift();
      results.push(await enrichOne(seq, dplnCache));
      idx++;
      if (idx % 10 === 0) console.log(`… ${idx}/${target.length} « ${seq.name.slice(0, 42)} »`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await sleep(50);

  const out = {
    meta: {
      source: "enrich-rush-sylvestre (DPLN + DofusDB)", count: results.length,
      generatedAt: new Date().toISOString(),
      note: "dofusdbUrl issu d'un index canonique (1976 quêtes) avec matching diacritique-insensible fail-closed (score+ambiguïté contrôlés). questDbIds rempli avec dofusdbUrl. activityTags: id/imageUrl des items à résoudre via game-data en aval.",
    },
    quests: results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const doneThisRun = results.slice(baseLen);
  const withUrl = doneThisRun.filter((r) => r.dofusdbUrl).length;
  const withSlug = doneThisRun.filter((r) => r.dofuspourlesnoobsUrl).length;
  const withPos = doneThisRun.filter((r) => r.mapPositions.length).length;
  const withAlign = doneThisRun.filter((r) => r.alignReq).length;
  const exact = doneThisRun.filter((r) => r.dofusScore && r.dofusScore >= 0.97).length;
  console.log(`\n→ ${OUT} (total ${results.length}/${seqs.length})`);
  console.log(`dofusdbUrl ${withUrl}/${doneThisRun.length} (dont exact ${exact}) · DPLN slug ${withSlug}/${doneThisRun.length} · position ${withPos}/${doneThisRun.length} · alignement ${withAlign}`);
}

main().catch((e) => { console.error("ERREUR :", e.message); process.exit(1); });


#!/usr/bin/env node
/**
 * Scrape les 100 quêtes d'alignement DPLN (Bontarien / Brakmarien).
 * Cible la section « Les quêtes d'alignement » = liste ordonnée <ol> dans
 *   <div class="ali-col">. La position dans la liste = niveau d'alignement
 *   (Ali 1 → Ali 100).
 *
 * IMPORTANT (slug) : DPLN a parfois renommé une quête tout en gardant son ancien
 *   slug d'URL (ex. « La serveuse Dame Cloude. » → slug `la-tenanciegravere-dame-cloude`).
 *   On capture donc le slug RÉEL du <a href> (et non un slug dérivé du nom) sinon on
 *   fabrique des URLs 404 pour dofuspourlesnoobsUrl (§6.2 du prompt-next).
 *
 * Sortie : src/temp/refonte-guide-sylvestre/ALIGNEMENT-dpln.json
 *
 * Usage : node scripts/scrape-dpln-alignment.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.dofuspourlesnoobs.com";
const OUT = path.resolve("src/temp/refonte-guide-sylvestre/ALIGNEMENT-dpln.json");

// Entités HTML (Latin-1 + ponctuation courante) — le reste passe en numérique.
const ENT = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#039": "'",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
  yacute: "ý", yuml: "ÿ", ntilde: "ñ", ccedil: "ç",
  AElig: "Æ", aelig: "æ", OElig: "Œ", oelig: "œ", szlig: "ß",
  deg: "°", times: "×", divide: "÷", plusmn: "±",
  laquo: "«", raquo: "»", hellip: "…", mdash: "—", ndash: "–",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", euro: "€",
};

function decode(s = "") {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&([a-zA-Z]+);/g, (_, k) => (Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : k))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(slug, timeoutMs = 15000) {
  const url = `${BASE}/${slug}.html`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SigilOS" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) return null;
  return res.text();
}

// Slug réel d'une quête : basename de l'<a href> (sans extension ni slash initial).
function slugFromHref(href) {
  return href.replace(/^https?:\/\/[^/]+/i, "").replace(/\.html.*$/i, "").replace(/^\//, "");
}

/**
 * Extrait la liste ordonnée des 100 quêtes d'alignement.
 * Cible : <div class="ali-col"><ol><li><a href="…">Nom.</a></li>…</ol></div>
 */
function extractAlignmentQuests(html) {
  const start = html.indexOf('<div class="ali-col">');
  if (start === -1) return [];
  const zone = html.slice(start);
  const ol = zone.match(/<ol>([\s\S]*?)<\/ol>/i);
  if (!ol) return [];
  const items = [...ol[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)];
  const quests = [];
  items.forEach((li, i) => {
    const a = li[1].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) return;
    const name = decode(a[2].replace(/<[^>]*>/g, " "));
    if (!name) return;
    quests.push({ level: i + 1, quest: name, slug: slugFromHref(a[1]) });
  });
  return quests;
}

async function scrape(camp) {
  // slugs candidats (variantes connues — §4.5 du prompt-next : Brakmarien = "bracirckmarien")
  const candidates = camp === "bontarien"
    ? ["alignement-bontarien"]
    : ["alignement-bracirckmarien", "alignement-brakmarien", "alignement-brackmarien"];
  let html = null, used = null;
  for (const slug of candidates) {
    html = await fetchPage(slug);
    if (html) { used = slug; break; }
  }
  if (!html) return { camp, error: "404", used };

  const quests = extractAlignmentQuests(html);
  return { camp, used, count: quests.length, quests };
}

const b = await scrape("bontarien");
const br = await scrape("brakmarien");
const result = {
  meta: {
    source: "DPLN — section « Les quêtes d'alignement » (liste ordonnée ali-col)",
    note: "level = position dans la liste (Ali 1..100) ; slug = URL réelle DPLN",
    scrapedAt: new Date().toISOString(),
  },
  bontarien: b,
  brakmarien: br,
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(`Bontarien : ${b.error ?? `${b.count} quêtes (${b.used})`}`);
console.log(`Brakmarien : ${br.error ?? `${br.count} quêtes (${br.used})`}`);
console.log(`-> ${OUT}`);

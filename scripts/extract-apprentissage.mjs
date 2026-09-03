#!/usr/bin/env node
/**
 * EXTRACTION des quêtes « Apprentissage » (Ordres) depuis la page DPLN
 * `alignement-bontarien.html` (section `#ordres-et-quetes`).
 *
 * Produit `src/temp/refonte-guide-sylvestre/APPRENTISSAGE-dpln.json` :
 *   { orders: [{ order, camp, quests: [{ name, slug, alignLevel, dofusdbUrl, dofusName, dovusId }] }] }
 *
 * Le niveau d'alignement requis est extrait de « (Alignement &gt; N) ».
 * Le `dofusdbUrl` est mappé par nom exact depuis l'index canonique DofusDB
 * (`enrich-cache/dofusdb-quests.json`).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGE = path.join(ROOT, "ang-bontarien.html");
const OUT = path.join(ROOT, "src/temp/refonte-guide-sylvestre/APPRENTISSAGE-dpln.json");
const QINDEX = path.join(ROOT, "src/temp/refonte-guide-sylvestre/enrich-cache/dofusdb-quests.json");

// décodage HTML + entités DPLN
const ENT = { nbsp: " ", amp: "&", quot: '"', apos: "'", "#039": "'", agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï", ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", yuml: "ÿ", ntilde: "ñ", ccedil: "ç", laquo: "«", raquo: "»", rsquo: "’", mdash: "—", ndash: "–", hellip: "…", OElig: "Œ", oelig: "œ", AElig: "Æ", aelig: "æ", gt: ">", lt: "<", Eacute: "É", Egrave: "È", Ecirc: "Ê" };
function dec(s = "") {
  let n = (s || "").replace(/<[^>]*>/g, " ");
  n = n.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  n = n.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  n = n.replace(/&([a-zA-Z]+);/g, (_, k) => (Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : k));
  n = n.replace(/\s+/g, " ").trim();
  return n;
}
function normK(s = "") {
  return (s || "")
    .replace(/œ/gi, "oe").replace(/æ/gi, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function similarity(a, b) {
  if (!a || !b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

const CAMP_BY_ORDER = {
  "ordre du coeur vaillant": "Bontarien",
  "ordre de l oeil attentif": "Brâkmarien",
  "ordre de l esprit salvateur": "Neutre",
};

function matchQuest(name) {
  const gn = normK(name);
  let best = null;
  for (const q of questIndex) {
    if (Math.abs(q._n.length - gn.length) > 6) continue;
    const sc = similarity(gn, q._n);
    if (!best || sc > best.score) best = { ...q, score: sc };
  }
  if (best && best.score >= 0.85) return best;
  return null;
}

function main() {
  questIndex = JSON.parse(fs.readFileSync(QINDEX, "utf8"));
  for (const q of questIndex) q._n = normK(q.nameFr);

  const html = fs.readFileSync(PAGE, "utf8");
  const idxA = html.indexOf('id="ordres-et-quetes"');
  // La section `#ordres-et-quetes` vient APRÈS `ali-col` ; on part de l'ancre.
  const sec = idxA >= 0 ? html.slice(idxA) : html;
  // découpage en blocs d'ordre
  const orders = [];
  const orderBlocks = sec.split(/<div class="order-title">/).slice(1);
  for (const block of orderBlocks) {
    const rest = block.split("</div>");
    const titleRaw = rest.shift();
    const bodyRaw = rest.join("</div>"); // réassemble tout ce qui suit le titre
    const order = dec(titleRaw);
    const quests = [];
    const liRe = /<li><a href="([^"]+)">([\s\S]*?)<\/a>(?:\s*\(Alignement\s*&gt;\s*(\d+)\))?/gi;
    let m;
    while ((m = liRe.exec(bodyRaw)) !== null) {
      quests.push({
        name: dec(m[2]).replace(/&gt;/g, ">").trim(),
        slug: m[1].replace(/^\//, "").replace(/\.html$/, ""),
        alignLevel: +m[3] || null,
      });
    }
    if (quests.length) orders.push({ order, camp: CAMP_BY_ORDER[normK(order)] || null, quests });
  }

  const out = {
    meta: { source: "DPLN alignement-bontarien.html — section #ordres-et-quetes", scrapedAt: new Date().toISOString(), note: "alignLevel = niveau d'alignement requis (20/40/60/80/100)" },
    orders: orders.map((o) => ({
      ...o,
      quests: o.quests.map((q) => {
        const d = matchQuest(q.name);
        return { ...q, dofusName: d?.nameFr || null, dofusScore: d ? +d.score.toFixed(3) : null, dofusdbUrl: d ? `https://dofusdb.fr/database/quest/${d.id}` : null };
      }),
    })),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  const total = out.orders.reduce((s, o) => s + o.quests.length, 0);
  const withUrl = out.orders.reduce((s, o) => s + o.quests.filter((q) => q.dofusdbUrl).length, 0);
  console.log(`Ordres=${out.orders.length} · quêtes=${total} · dofusdbUrl=${withUrl}`);
  for (const o of out.orders) console.log(`- ${o.order} [${o.camp}] : ${o.quests.length} quêtes (${o.quests.filter((q) => q.dofusdbUrl).length} dofusdbUrl)`);
}
let questIndex = [];
main();

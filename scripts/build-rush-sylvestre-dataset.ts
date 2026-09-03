#!/usr/bin/env node
/**
 * Génère le jeu de données CURÉ du guide Rush Sylvestre (Laniyelle).
 * Combine : timeline (phases) + résolution game-data (donjons/objets → nos IDs)
 * + métiers + ressources. DRY-RUN : n'écrit PAS en base.
 * Sortie : src/data/rush-sylvestre-guide.json
 *
 * Usage : npx tsx scripts/build-rush-sylvestre-dataset.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

const TIMELINE = JSON.parse(fs.readFileSync(path.resolve("src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-timeline.json"), "utf8"));
const GUIDE_DATA = JSON.parse(fs.readFileSync(path.resolve("src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-guide-data.json"), "utf8"));
const OUT = path.resolve("src/data/rush-sylvestre-guide.json");

function norm(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
  const la = a.length, lb = b.length;
  if (!la) return lb; if (!lb) return la;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) for (let j = 1; j <= lb; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[la][lb];
}
function similarity(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

function resolveDungeon(name, index) {
  const key = norm(name);
  let d = index.byName.get(key) || index.byBoss.get(key);
  if (!d) d = index.list.find((x) => norm(x.name).includes(key) || key.includes(norm(x.name)));
  if (!d) d = index.list.find((x) => { const bn = norm(x.bossName || ""); return bn && (bn.startsWith(key) || key.startsWith(bn) || bn.includes(key) || key.includes(bn)); });
  if (!d) {
    let best = null, bs = 0;
    for (const x of index.list) { const s = Math.max(similarity(name, x.name), similarity(name, x.bossName || "")); if (s > bs) { bs = s; best = x; } }
    if (best && bs >= 0.5) d = best;
  }
  return d ? { id: d.id, name: d.name, imageUrl: d.imageUrl, resolved: true } : { id: null, name, imageUrl: null, resolved: false };
}

async function main() {
  const [dungeons, gameItems] = await Promise.all([
    db.dungeon.findMany({ select: { id: true, name: true, bossName: true, imageUrl: true } }),
    db.gameItem.findMany({ where: { isDeprecated: false }, select: { ankamaId: true, name: true, iconUrl: true } }),
  ]);

  const dIndex = {
    list: dungeons,
    byName: new Map(dungeons.map((d) => [norm(d.name), d])),
    byBoss: new Map(dungeons.flatMap((d) => (d.bossName ? [[norm(d.bossName), d]] : []))),
  };
  const iIndex = new Map();
  for (const gi of gameItems) iIndex.set(norm(gi.name), gi);
  const resolveItem = (name) => {
    const gi = iIndex.get(norm(name)) || iIndex.get(norm(name.replace(/\(.*?\)/g, "").trim()));
    return gi ? { ankamaId: gi.ankamaId, imageUrl: gi.iconUrl, resolved: true, name: gi.name } : { ankamaId: null, name, imageUrl: null, resolved: false };
  };

  const milestones = [];
  const unresolved = { dungeons: new Set(), items: new Set() };
  for (const p of TIMELINE.phases) {
    if (/^(lancer eternelle moisson)/i.test(p.title)) continue; // note globale, pas un milestone
    const dungeons = p.dungeons
      .filter((d) => d.name && d.name !== "-" && norm(d.name).length > 0)
      .map((d) => {
        const r = resolveDungeon(d.name, dIndex);
        if (!r.resolved) unresolved.dungeons.add(d.name);
        return { name: r.name, id: r.id, imageUrl: r.imageUrl, totem: d.totem, note: d.note || (d.totem ? "drope une totem (Maimane)" : undefined) };
      });
    const succès = p.succès === "-" ? "" : p.succès;
    milestones.push({
      title: p.title,
      notes: p.notes || null,
      succès,
      aide: p.aide || "",
      dungeons,
      sequences: p.quests.map((q) => ({ name: q, dungeonIds: dungeons.map((x) => x.id).filter(Boolean), succès })),
    });
  }

  const metiers = (GUIDE_DATA.metiers.find((m) => m.source === "main")?.metiers || []);
  const itemsMap = new Map();
  for (const it of GUIDE_DATA.items) {
    if (/kamas/i.test(it.name)) continue;
    if (it.quantity == null || it.quantity === "") continue;
    const r = resolveItem(it.name);
    if (!r.resolved) unresolved.items.add(it.name);
    const key = r.ankamaId ?? it.name;
    const cur = itemsMap.get(key);
    if (cur) cur.quantity += it.quantity || 0;
    else itemsMap.set(key, { name: r.name || it.name, ankamaId: r.ankamaId, imageUrl: r.imageUrl, quantity: it.quantity });
  }

  const dataset = {
    meta: { source: "Route Sylvestre (Laniyelle) — curé + résolution game-data", milestones: milestones.length, items: itemsMap.size, metiers: metiers.length },
    preparation: { metiers, items: [...itemsMap.values()] },
    milestones,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2) + "\n", "utf8");

  console.log(`Dataset curé : ${milestones.length} milestones · ${itemsMap.size} objets · ${metiers.length} métiers`);
  console.log(`  Donjons non résolus (${unresolved.dungeons.size}) : ${[...unresolved.dungeons].slice(0, 20).join(", ")}`);
  console.log(`  Objets non résolus (${unresolved.items.size}) : ${[...unresolved.items].slice(0, 20).join(", ")}`);
  console.log(`\nExemple milestone[0]:`);
  console.log(JSON.stringify(dataset.milestones[0], null, 2));
  console.log(`\n-> ${OUT}`);
}

main().catch((e) => { console.error("ERREUR :", e.message); process.exit(1); }).finally(() => db.$disconnect());

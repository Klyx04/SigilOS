#!/usr/bin/env node
/**
 * PHASE 0 — Preuve de faisabilité du mapping game-data (LECTURE SEULE).
 * Résout les noms d'objets (Ressource) et de donjons (matrice) du guide
 * Laniyelle vers le catalogue local GameItem / Dungeon.
 *
 * Rien n'est écrit. Produit un rapport de correspondance (match / unmatched).
 *
 * Usage : npx tsx scripts/map-rush-sylvestre-game-data.ts
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
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const EXTRACTED = path.resolve("src/temp/refonte-guide-sylvestre/extracted");
const JSON_FILE = path.resolve("src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-guide-data.json");

/** Normalisation accent/casse pour matching robuste. */
function norm(s = "") {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distance d'édition (Levenshtein) — pour détecter les fautes d'orthographe. */
function levenshtein(a, b) {
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[la][lb];
}
/** Similarité 0..1 (proche de 1 = quasi identique), tolérante aux accents/casse. */
function similarity(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/** Parse les noms de donjons de la feuille « Donjon » (col 1). */
function parseDungeonNames() {
  const html = fs.readFileSync(path.join(EXTRACTED, "Liste des donjons.html"), "utf8");
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const decode = (s) =>
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&eacute;/g, "é")
      .replace(/&egrave;/g, "è")
      .replace(/&agrave;/g, "à")
      .replace(/&ccedil;/g, "ç")
      .replace(/&uuml;/g, "ü")
      .replace(/&ocirc;/g, "ô")
      .replace(/&slash;/g, "/")
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  const names = [];
  const HEADERS = new Set(["donjon", "dofus", "save", "commentaire", "check"]);
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cm) => decode(cm[1]));
    // Le nom de donjon est en colonne 2 (l'export a un 1er <td> "Save"/checkbox vide).
    const name = (cells[1] || "").trim() ? cells[1] : (cells[2] || "").trim();
    if (name && !HEADERS.has(norm(name))) names.push(name);
  }
  return Array.from(new Set(names));
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  const items = dataset.items || [];
  const dungeons = parseDungeonNames();

  console.log(`Catalogue à mapper : ${items.length} objets · ${dungeons.length} donjons\n`);

  // 1) Charger le catalogue game-data
  const [gameItems, dbDungeons] = await Promise.all([
    db.gameItem.findMany({
      where: { isDeprecated: false },
      select: { name: true, ankamaId: true, iconUrl: true, category: true },
    }),
    db.dungeon.findMany({ select: { name: true, bossName: true, imageUrl: true, dofusdbId: true } }),
  ]);

  const itemIndex = new Map();
  for (const gi of gameItems) {
    const k = norm(gi.name);
    if (!itemIndex.has(k)) itemIndex.set(k, gi);
  }
  const dungeonIndex = new Map();
  for (const d of dbDungeons) {
    dungeonIndex.set(norm(d.name), d);
    if (d.bossName) dungeonIndex.set(norm(d.bossName), d);
  }

  // 2) Matching objets (exact puis sous-chaîne après nettoyage des parenthèses)
  let itemMatched = 0;
  const itemUnmatched = [];
  for (const it of items) {
    const key = norm(it.name);
    let gi = itemIndex.get(key);
    if (!gi) {
      // nettoyage : retire les qualificatifs entre parenthèses
      const cleaned = norm(it.name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim());
      gi = itemIndex.get(cleaned);
    }
    if (!gi) {
      // sous-chaîne : un item du catalogue dont le nom est contenu
      gi = gameItems.find((g) => {
        const gk = norm(g.name);
        return gk && (key.includes(gk) || gk.includes(key));
      });
    }
    if (gi) itemMatched++;
    else itemUnmatched.push(it.name);
  }

  // 3) Matching donjons (exact, bossName, sous-chaîne, puis fuzzy Levenshtein)
  let dungeonMatched = 0;
  const dungeonUnmatched = [];
  const dungeonByName = new Map(dbDungeons.map((d) => [norm(d.name), d]));
  for (const n of dungeons) {
    const key = norm(n);
    let d = dungeonByName.get(key) || dungeonIndex.get(key);
    // 1) sous-chaîne sur le nom du donjon
    if (!d) {
      d = dbDungeons.find((x) => norm(x.name).includes(key) || key.includes(norm(x.name)));
    }
    // 2) sous-chaîne / préfixe sur le NOM DU BOSS (le guide liste souvent le boss)
    if (!d) {
      d = dbDungeons.find((x) => {
        const bn = norm(x.bossName || "");
        return bn && (bn.startsWith(key) || key.startsWith(bn) || bn.includes(key) || key.includes(bn));
      });
    }
    // 3) fuzzy Levenshtein (nom + bossName), seuil abaissé à 0.5
    if (!d) {
      let best = null, bestScore = 0;
      for (const x of dbDungeons) {
        const s = Math.max(similarity(n, x.name), similarity(n, x.bossName || ""));
        if (s > bestScore) { bestScore = s; best = x; }
      }
      if (best && bestScore >= 0.5) d = best;
    }
    if (d) dungeonMatched++;
    else dungeonUnmatched.push(n);
  }

  console.log("=== RAPPORT DE CORRESPONDANCE ===");
  console.log(
    `  Objets : ${itemMatched}/${items.length} matchés (${Math.round((itemMatched / items.length) * 100)}%)`
  );
  console.log(`  — non matchés (${itemUnmatched.length}) : ${itemUnmatched.slice(0, 25).join(", ")}`);
  console.log(
    `\n  Donjons : ${dungeonMatched}/${dungeons.length} matchés (${Math.round((dungeonMatched / dungeons.length) * 100)}%)`
  );
  console.log(`  — non matchés (${dungeonUnmatched.length}) : ${dungeonUnmatched.join(", ")}`);

  // Candidats les plus proches pour les donjons non-matchés (détection de fautes)
  if (dungeonUnmatched.length) {
    console.log("\n=== CANDIDATS (donjons non-matchés → meilleur match DB) ===");
    for (const n of dungeonUnmatched) {
      const sorted = [...dbDungeons]
        .map((x) => ({ x, s: Math.max(similarity(n, x.name), similarity(n, x.bossName || "")) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3);
      const top = sorted
        .filter((e) => e.s > 0.45)
        .map((e) => `${e.x.name} (${Math.round(e.s * 100)}%)`)
        .join(" | ");
      console.log(`  ${top ? n + " -> " + top : n + " -> (aucun candidat>45%)"}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("ERREUR :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

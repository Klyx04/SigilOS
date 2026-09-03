#!/usr/bin/env node
/**
 * Construit la timeline Rush Sylvestre depuis « Sylvestre Optimisés.html »
 * (feuille « Quêtes des Dofus »). Chaque cellule col2 = une phase (milestone).
 * DRY-RUN : ne touche pas la base, écrit un JSON de structure.
 *
 * Usage : node scripts/build-rush-sylvestre-timeline.mjs
 */
import fs from "node:fs";
import path from "node:path";

const EXTRACTED = path.resolve("src/temp/refonte-guide-sylvestre/extracted");
const OUT = path.resolve("src/temp/refonte-guide-sylvestre/RUSH-SYLESTRE-timeline.json");

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&uuml;/g, "ü")
    .replace(/&ocirc;/g, "ô")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[^\S\n]+/g, " ") // effondre espaces/tabs, GARDE les retours à la ligne
    .trim();

const html = fs.readFileSync(path.join(EXTRACTED, "Sylvestre Optimisés.html"), "utf8");
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
const cellsOf = (row) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1]));

const splitList = (s) =>
  (s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

// Mots-clés d'instruction = début des « notes » (après le titre de phase)
const NOTE_KEYWORDS =
  /(^|\s)(préparer|s'arrêter|s arreter|opter|lancer|fini|finir|terminer|esquiver|nécessite|necessite|monologue|ne pas|opti|check|récupérer|recuperer|toutes les quêtes|tas de|auto|sauvegarder|enchaîner|dès que|pour que|si |faire|aller|commencer|attention|utiliser|prendre|ouvrir|utiliser un|save|parchotter|sorts communs)/i;

// Détermine le type de milestone à partir du titre de phase
function detectType(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("alignement") || t.includes("ordre")) return "ALIGNEMENT";
  if (t.includes("prérequis") || t.includes("pré-recquis") || t.includes("prerequis")) return "PREREQUIS";
  if (t.includes("dofus ")) return "DOFUS";
  if (t.includes("récupérer") || t.includes("recuperer")) return "ZONE";
  return "QUETE_SERIE";
}

const phases = [];
let prevIdx = -1;
for (let ri = 0; ri < rows.length; ri++) {
  const c = cellsOf(rows[ri]);
  const main = c[2] || "";
  if (!main) continue;
  if (/^↓$/.test(main)) continue; // séparateurs visuels
  if (/^(quêtes des dofus)$/i.test(main)) continue; // header
  if (/^0$/.test(main) && /^%$/.test(c[4])) continue; // footer 0 | %

  // ── Séparer titre / notes (titre = 1re ligne, notes = lignes suivantes) ──
  const lines = main.split("\n").map((x) => x.trim()).filter(Boolean);
  const title = lines.shift() || "";
  const notes = lines.join(" ");

  // ── Donjons : nettoyer les annotations (Totem / +Totem / Pas le boss) ──
  const dungeons = splitList(c[4] || "")
    .map((d) => {
      const totem = /\(?\s*\+?\s*totem\s*\)?/i.test(d);
      const off = /\(?\s*pas le boss\s*\)?/i.test(d);
      const name = d.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
      return { name, totem, note: off ? "ne pas faire le boss" : totem ? "drope une totem" : undefined };
    })
    .filter((d) => d.name);

  // ── Succès / quêtes / aide ──
  const succès = splitList(c[6] || "").join(" · ");
  const aide = (c[10] || "").replace(/\.$/g, "").trim();
  const quests = splitList(c[8] || "").filter((q) => q !== ".");
  const rawDungeons = (c[4] || "");

  prevIdx = ri;
  phases.push({ row: ri, title, notes, dungeons, succès, aide, quests, questCount: quests.length });
}

const timeline = { meta: { source: "Sylvestre Optimisés.html — feuille Quêtes des Dofus", phases: phases.length }, phases };
fs.writeFileSync(OUT, JSON.stringify(timeline, null, 2) + "\n", "utf8");

console.log(`Phases extraites : ${phases.length}\n`);
for (const p of phases) {
  console.log(`[${p.row}] ${p.title}  (${p.questCount} quêtes)`);
  console.log(`    dons: ${p.dungeons.map((d) => d.name + (d.totem ? " (totem)" : "")).join(", ") || "-"}`);
  console.log(`    succès: ${p.succès || "-"}  | aide: ${p.aide || "-"}`);
}
console.log(`\n-> ${OUT}`);

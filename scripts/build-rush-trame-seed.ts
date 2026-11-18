#!/usr/bin/env node
/**
 * Générateur de **seed Rush Sylvestre** depuis la Trame locale.
 *
 * La Trame (`src/temp/trame-rush/data.json`, hors dépôt) contient la corrélation
 * Tougli × Dofusyelle. Ce script la transforme en **payload d'import God** typé
 * (`importRushGuide`, dry-run par défaut côté God) et en **rapport** des textes à
 * réécrire / quêtes non appariées.
 *
 * Aucune écriture en base, aucun appel réseau : deux fichiers dans `src/temp/`
 * (zone volatile, jamais commitée).
 *
 * Usage :
 *   npx tsx scripts/build-rush-trame-seed.ts --spine tougli
 *   npx tsx scripts/build-rush-trame-seed.ts --spine tougli --enrich-yelle
 *   npx tsx scripts/build-rush-trame-seed.ts --spine yelle --no-resources
 *   npx tsx scripts/build-rush-trame-seed.ts --trame src/temp/trame-rush/data.json
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  buildRushSeedFromTrame,
  type RushDofusDex,
  type RushTrameSpine,
  type TrameInput,
} from "../src/lib/rush-trame-seed";

const args = process.argv.slice(2);
const valueOf = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const has = (flag: string): boolean => args.includes(flag);

const spine = (valueOf("--spine", "tougli") === "yelle" ? "yelle" : "tougli") as RushTrameSpine;
const tramePath = path.resolve(valueOf("--trame", "src/temp/trame-rush/data.json"));
const yelleRawPath = path.resolve(
  valueOf("--yelle", "src/temp/archive/siphon-align/dofusyelle-com-assets-js-rush-sylvestre-data-js.js")
);
const dofusDexPath = path.resolve(valueOf("--dofusdex", "public/game-data/dofusdex.json"));
const achievementsPath = path.resolve(valueOf("--achievements", "public/game-data/achievements.json"));
const outDir = path.resolve(valueOf("--out-dir", "src/temp/rush-seed"));
const enrichYelle = has("--enrich-yelle");
const defaultSeedName = spine === "tougli" && enrichYelle ? "tougli-enriched" : spine;
const outPath = path.resolve(valueOf("--out", path.join(outDir, `${defaultSeedName}.json`)));
const reportPath = path.resolve(
  valueOf("--report", path.join(outDir, `${defaultSeedName}-rapport.md`))
);

if (!fs.existsSync(tramePath)) {
  console.error(`Trame introuvable : ${tramePath}`);
  console.error("Lance d'abord l'outil local `src/temp/trame-rush/build-data.mjs`.");
  process.exit(1);
}

type LooseStep = {
  id?: number;
  n?: number;
  cat?: string;
  category?: string;
  title?: string;
  body?: unknown[];
  donjons?: unknown[];
  succes?: unknown[];
  quetes?: unknown[];
};
type LooseTrame = {
  dofusyelle?: { steps?: LooseStep[]; correlation?: unknown[] };
} & Record<string, unknown>;

const trame = JSON.parse(fs.readFileSync(tramePath, "utf8")) as LooseTrame;

/**
 * La Trame ne conserve pas toujours `succes` / `donjons` / `quetes` par étape (le
 * build local les a aplatis). La **Yelle brute** est la source de ces listes : on la
 * fusionne par numéro d'étape, sans toucher aux quêtes ni aux conditions.
 */
if (fs.existsSync(yelleRawPath)) {
  const sandbox: { window: { RUSH_DATA?: { steps?: LooseStep[] } } } = { window: {} };
  vm.runInNewContext(fs.readFileSync(yelleRawPath, "utf8"), sandbox, { timeout: 5000 });
  const rawSteps = sandbox.window.RUSH_DATA?.steps ?? [];
  const rawById = new Map<number, LooseStep>();
  for (const step of rawSteps) {
    if (typeof step.id === "number") rawById.set(step.id, step);
  }

  const steps = trame.dofusyelle?.steps ?? [];
  for (const step of steps) {
    const raw = rawById.get(Number(step.n));
    if (!raw) continue;
    if (!step.donjons?.length) step.donjons = raw.donjons ?? [];
    if (!step.succes?.length) step.succes = raw.succes ?? [];
    if (!step.quetes?.length) step.quetes = raw.quetes ?? [];
    if (!step.body?.length) step.body = raw.body ?? [];
  }
  const known = new Set(steps.map((step) => step.n));
  for (const raw of rawSteps) {
    if (typeof raw.id !== "number" || known.has(raw.id)) continue;
    steps.push({
      n: raw.id,
      category: raw.cat,
      title: raw.title,
      body: raw.body ?? [],
      donjons: raw.donjons ?? [],
      succes: raw.succes ?? [],
      quetes: raw.quetes ?? [],
    });
  }
  trame.dofusyelle = { ...(trame.dofusyelle ?? {}), steps };
  const mergedDonjons = steps.filter((step) => (step.donjons ?? []).length > 0).length;
  const mergedSucces = steps.reduce(
    (count, step) => count + (Array.isArray(step.succes) ? step.succes.length : 0),
    0
  );
  console.log(
    `Yelle brute fusionnée : ${rawSteps.length} étapes (${mergedDonjons} avec donjons, ${mergedSucces} succès).`
  );
} else {
  console.warn(`Yelle brute absente : ${yelleRawPath} (succès/donjons non fusionnés).`);
}

let dofusdex: RushDofusDex | null = null;
if (fs.existsSync(dofusDexPath)) {
  dofusdex = JSON.parse(fs.readFileSync(dofusDexPath, "utf8")) as RushDofusDex;
  console.log(`DofusDex : ${dofusdex.dofus?.length ?? 0} progression(s) officielle(s).`);
} else {
  console.warn(`DofusDex absent : ${dofusDexPath} (blocs DOFUS non enrichis).`);
}

let achievements: Array<{ id: number; name: string; iconId?: number | null; questIds?: number[] }> = [];
if (fs.existsSync(achievementsPath)) {
  const raw = JSON.parse(fs.readFileSync(achievementsPath, "utf8")) as {
    achievements?: Array<{ id: number; name: string; iconId?: number | null; questIds?: number[] }>;
  };
  achievements = (raw.achievements ?? []).filter((row) => (row.questIds ?? []).length > 0);
  console.log(`Succès officiels : ${achievements.length} avec des quêtes.`);
} else {
  console.warn(`Succès absents : ${achievementsPath} (aucune pastille de succès).`);
}

const { payload, report } = buildRushSeedFromTrame(trame as unknown as TrameInput, {
  spine,
  includeResources: !has("--no-resources"),
  includeClasses: !has("--no-classes"),
  includeSuccesses: has("--successes"),
  maxSequencesPerBlock: Number(valueOf("--max", "120")) || 120,
  dofusdex,
  achievements,
  enrichFromYelle: enrichYelle,
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

const lines = [
  `# Seed Rush Sylvestre — spine \`${report.spine}\``,
  "",
  `Généré le ${new Date().toISOString()} depuis \`${path.relative(process.cwd(), tramePath)}\`.`,
  "",
  "## Compteurs",
  "",
  "| Indicateur | Valeur |",
  "|---|---:|",
  `| Blocs | ${report.blocks} |`,
  `| Séquences | ${report.sequences} |`,
  `| Quêtes avec id DofusDB | ${report.questsWithIds} |`,
  `| Ressources (tags item) | ${report.resources} |`,
  `| Succès | ${report.successes} |`,
  `| Prérequis (prereq_text) | ${report.prereqTags} |`,
  `| Prérequis d'ordre (route) | ${report.routePrereqs} |`,
  `| Succès officiels attachés | ${report.successAchievements} |`,
  `| Tags succes posés | ${report.successTags} (sur ${report.successQuests} quêtes) |`,
  `| Arêtes de prérequis écartées | ${report.prereqSkipped} |`,
  `| Succès Yelle fusionnés | ${report.yelleSuccesses} |`,
  `| Conseils Yelle fusionnés | ${report.yelleTipsMerged} |`,
  `| Blocs DofusDex Yelle | ${report.yelleDofusDexMerged} |`,
  `| Blocs avec donjons Yelle | ${report.yelleDungeonBlocks} |`,
  `| Blocs enrichis DofusDex | ${report.dofusDexTagged} |`,
  `| Quêtes non appariées | ${report.unmatched.length} |`,
  `| Conseils à rédiger | ${report.tipsToWrite.length} |`,
  "",
  "## Types de blocs",
  "",
  ...Object.entries(report.blockTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `- **${type}** : ${count}`),
  "",
  "## Quêtes non appariées (à relier dans le studio)",
  "",
  ...(report.unmatched.length
    ? report.unmatched.slice(0, 80).map((item) => `- étape ${item.step ?? "?"} · ${item.title} — ${item.reason}`)
    : ["_Aucune._"]),
  "",
  "## Conseils à rédiger (texte source non recopié)",
  "",
  ...(report.tipsToWrite.length
    ? report.tipsToWrite
        .slice(0, 80)
        .map((item) => `- étape ${item.step ?? "?"} · ${item.title} (${item.category}) — ${item.lines} ligne(s)`)
    : ["_Aucun._"]),
  "",
  "## Avertissements",
  "",
  ...(report.warnings.length ? report.warnings.slice(0, 80).map((warning) => `- ${warning}`) : ["_Aucun._"]),
  "",
];

fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

console.log(`[${report.spine}] ${report.blocks} bloc(s) · ${report.sequences} séquence(s)`);
console.log(
  `  quêtes avec id : ${report.questsWithIds} · ressources : ${report.resources} · succès : ${report.successes} · DofusDex : ${report.dofusDexTagged}`
);
console.log(
  `  Yelle : ${report.yelleSuccesses} succès fusionné(s) · ${report.yelleTipsMerged} conseil(s) · ${report.yelleDofusDexMerged} bloc(s) DofusDex · ${report.yelleDungeonBlocks} bloc(s) avec donjons`
);
console.log(
  `  prérequis : ${report.prereqTags} posé(s) · ${report.prereqSkipped} écartée(s) · ${report.routePrereqs} verrou(s) d'ordre`
);
console.log(
  `  succès : ${report.successAchievements} attaché(s) · ${report.successTags} tag(s) sur ${report.successQuests} quête(s)`
);
console.log(`  non appariées : ${report.unmatched.length} · conseils à rédiger : ${report.tipsToWrite.length}`);
console.log(`  payload : ${path.relative(process.cwd(), outPath)}`);
console.log(`  rapport : ${path.relative(process.cwd(), reportPath)}`);
console.log("  → importer dans God ▸ Rush Sylvestre ▸ JSON (dry-run d'abord).");

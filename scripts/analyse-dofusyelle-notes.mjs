#!/usr/bin/env node
/**
 * Analyse des **notes Dofusyelle** — guide strictement autonome (aucun lien avec Tougli).
 *
 * Mesure du 03/11/2026 : Dofusyelle n'a ni la même structure ni les mêmes quêtes que Tougli
 * (353 quêtes listées, 57 étapes). Son rattachement propre est **l'étape** : chaque étape liste
 * ses `quetes[]`, ses `donjons[]`, son `body` et son `aide`. Les 45 notes de donjon, elles, sont
 * rattachées au donjon — on les résout par le **slug** de l'étape, jamais par Tougli.
 *
 * Sortie : `src/temp/archive/siphon-align/dofusyelle-notes.json` — **zone volatile**.
 *
 * Usage : `node scripts/analyse-dofusyelle-notes.mjs [--source <fichier>]`
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE = "src/temp/archive/siphon-align/dofusyelle-rush-data.json";
const OUT_FILE = "src/temp/archive/siphon-align/dofusyelle-notes.json";

const valueOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const sourcePath = path.resolve(valueOf("--source", DEFAULT_SOURCE));
let data;
try {
  data = JSON.parse(readFileSync(sourcePath, "utf8"));
} catch {
  throw new Error(
    `source Dofusyelle introuvable (${sourcePath}) — lancer d'abord scripts/siphon-dofusyelle-rush.mjs`,
  );
}

const steps = Array.isArray(data.steps) ? data.steps : [];
const donjons = Array.isArray(data.donjons) ? data.donjons : Object.values(data.donjons ?? {});

/** Une étape = son texte, ses quêtes listées et ses donjons (slug + libellé). */
const outSteps = steps.map((step) => ({
  n: step.n,
  title: step.title ?? "",
  cat: step.cat ?? "",
  body: String(step.body ?? "").trim(),
  aide: String(step.aide ?? "").trim(),
  remark: String(step.remark ?? "").trim(),
  quetes: (step.quetes ?? [])
    .map((q) => (typeof q === "string" ? q : q && q.t))
    .filter((title) => typeof title === "string" && title.trim())
    .map((title) => title.trim()),
  donjons: (step.donjons ?? []).flatMap((group) =>
    (group?.items ?? []).map((item) => ({
      label: group?.label ?? null,
      name: item?.t ?? "",
      slug: item?.s ?? "",
    })),
  ),
}));

/** Notes portées par un donjon (le slug est la clé stable de Dofusyelle). */
const outDungeonNotes = donjons
  .filter((donjon) => donjon && String(donjon.note ?? "").trim())
  .map((donjon) => ({
    name: donjon.name ?? donjon.nom ?? "",
    slug: donjon.slug ?? donjon.id ?? "",
    note: String(donjon.note).trim(),
  }));

const out = {
  meta: {
    source: sourcePath,
    generatedAt: new Date().toISOString(),
    steps: outSteps.length,
    dungeonNotes: outDungeonNotes.length,
  },
  steps: outSteps,
  dungeonNotes: outDungeonNotes,
};

const outPath = path.resolve(OUT_FILE);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

const withQuetes = outSteps.filter((step) => step.quetes.length).length;
const withDonjons = outSteps.filter((step) => step.donjons.length).length;
console.log(`sortie : ${path.relative(process.cwd(), outPath)}`);
console.log(
  `étapes = ${outSteps.length} · avec quêtes = ${withQuetes} · avec donjons = ${withDonjons} · notes de donjon = ${outDungeonNotes.length}`,
);

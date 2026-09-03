#!/usr/bin/env node
/**
 * CLI — Applique l'ENRICHISSEMENT du guide Rush Sylvestre en base, NON destructif.
 * - Lit `src/data/rush-sylvestre-guide.enriched.json`.
 * - Pour chaque quête enrichie, retrouve la `GuideSequence` correspondante
 *   (clé = `subGuideRef` normalisé) et ne remplit QUE les champs vides.
 * - N'écrase JAMAIS un champ déjà renseigné (retouche GOD préservée) et ne
 *   supprime jamais rien.
 * - DRY-RUN par défaut ; `--apply` pour écrire réellement en base.
 *
 * Usage : node scripts/seed-rush-sylvestre-enriched-cli.mjs [--apply]
 * Env   : DATABASE_URL ou POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB (localhost:5433)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const apply = process.argv.includes("--apply");
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

const enriched = JSON.parse(fs.readFileSync(path.resolve("src/data/rush-sylvestre-guide.enriched.json"), "utf8"));

function norm(s = "") {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function normK(s = "") {
  return norm((s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae"));
}
const clean = (s = "") => (s || "").replace(/[.!?\u00a0]+$/g, "");

function tagKey(t = {}) {
  return `${t.type || ""}|${t.name || ""}|${t.level ?? ""}|${t.count ?? ""}`;
}
function mergeTags(existing = [], incoming = []) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(out.map(tagKey));
  for (const t of incoming) {
    const k = tagKey(t);
    if (!seen.has(k)) {
      out.push(t);
      seen.add(k);
    }
  }
  return out;
}

// Construit l'update SANS écraser un champ non vide (non destructif).
function buildUpdate(seq, q) {
  const data = {};
  if (q.dofusdbUrl && !seq.dofusdbUrl) data.dofusdbUrl = q.dofusdbUrl;
  if (q.dofuspourlesnoobsUrl && !seq.dofuspourlesnoobsUrl) data.dofuspourlesnoobsUrl = q.dofuspourlesnoobsUrl;
  if (q.questDbIds && q.questDbIds.length && (!seq.questDbIds || !seq.questDbIds.length)) data.questDbIds = q.questDbIds;
  if (q.mapPositions && q.mapPositions.length && (!Array.isArray(seq.mapPositions) || !seq.mapPositions.length)) data.mapPositions = q.mapPositions;
  if (q.alignReq != null && seq.alignReq == null) data.alignReq = String(q.alignReq);
  if (q.alignOrderReq != null && seq.alignOrderReq == null) data.alignOrderReq = q.alignOrderReq;
  if (q.dungeonIds && q.dungeonIds.length && (!seq.dungeonIds || !seq.dungeonIds.length)) data.dungeonIds = q.dungeonIds;
  // Positions GPS : mapPositions (structuré x,y) -> tag « pos_tags » (lu par GOD/Dashboard/Overlay).
  // L'UI ne consomme que activityTags[pos_tags], jamais mapPositions directement.
  const incomingTags = Array.isArray(q.activityTags) ? [...q.activityTags] : [];
  const hasPosTag = Array.isArray(seq.activityTags) && seq.activityTags.some((t) => t.type === "pos_tags");
  if (!hasPosTag && Array.isArray(q.mapPositions) && q.mapPositions.length) {
    incomingTags.push({ type: "pos_tags", name: q.mapPositions.map((p) => `${p.x}, ${p.y}`).join(" ; "), worldId: 1 });
  }
  if (incomingTags.length) {
    const merged = mergeTags(seq.activityTags || [], incomingTags);
    if (merged.length !== (Array.isArray(seq.activityTags) ? seq.activityTags.length : 0)) data.activityTags = merged;
  }
  return data;
}

async function main() {
  const guide = await db.optimizedGuide.findUnique({
    where: { slug: "rush-sylvestre" },
    include: { milestones: { include: { sequences: true } } },
  });
  if (!guide) {
    console.log("⚠️ Guide « rush-sylvestre » introuvable en base (seed initial non fait ?).");
    return;
  }

  // Index des séquences par subGuideRef normalisé (peut y avoir plusieurs).
  const byRef = new Map();
  let totalSeqs = 0;
  for (const ms of guide.milestones) {
    for (const s of ms.sequences) {
      totalSeqs++;
      const k = normK(clean(s.subGuideRef));
      if (!byRef.has(k)) byRef.set(k, []);
      byRef.get(k).push(s);
    }
  }

  const plan = { matched: 0, unmatched: 0, updates: 0 };
  const fieldsCount = { dofusdbUrl: 0, dofuspourlesnoobsUrl: 0, questDbIds: 0, mapPositions: 0, activityTags: 0, alignReq: 0, alignOrderReq: 0, dungeonIds: 0 };
  const toWrite = [];

  let unmatchedNames = [];
  for (const q of enriched.quests) {
    const k = normK(clean(q.name));
    const matches = byRef.get(k) || [];
    if (!matches.length) {
      plan.unmatched++;
      unmatchedNames.push(q.name);
      continue;
    }
    plan.matched++;
    for (const seq of matches) {
      const data = buildUpdate(seq, q);
      const keys = Object.keys(data);
      if (keys.length) {
        toWrite.push({ id: seq.id, name: q.name, data, fields: keys });
        plan.updates++;
        for (const f of keys) fieldsCount[f] = (fieldsCount[f] || 0) + 1;
      }
    }
  }

  console.log(`[${apply ? "APPLY" : "DRY-RUN"}] Guide « ${guide.name} » (${guide.id}) — ${guide.milestones.length} jalons · ${totalSeqs} séquences`);
  console.log(`  Quêtes enrichies : ${enriched.quests.length} · matchees : ${plan.matched} · non matchees : ${plan.unmatched} · séquences à mettre à jour : ${plan.updates}`);
  console.log("  Champs à remplir (non destructif) : " + Object.entries(fieldsCount).map(([k, v]) => `${k}=${v}`).join(" · "));
  if (unmatchedNames.length) console.log("  ⚠️ Quêtes sans séquence DB (subGuideRef introuvable) : " + unmatchedNames.slice(0, 20).join(" | "));

  if (!apply) return;

  let updated = 0;
  for (const w of toWrite) {
    await db.guideSequence.update({ where: { id: w.id }, data: w.data });
    updated++;
  }
  console.log(`  ✔ Séquences mises à jour : ${updated}`);
}

main()
  .catch((e) => { console.error("ERREUR :", e.message); process.exit(1); })
  .finally(() => db.$disconnect());

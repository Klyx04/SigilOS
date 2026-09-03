#!/usr/bin/env node
/**
 * CLI standalone — seed du guide Rush Sylvestre depuis le dataset curé.
 * Même logique que `seedRushSylvestreFromGuide` (mais sans garde d'auth).
 * DRY-RUN par défaut ; `--apply` pour écrire en base.
 * Usage : npx tsx scripts/seed-rush-sylvestre-cli.mjs [--apply]
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

const data = JSON.parse(fs.readFileSync(path.resolve("src/data/rush-sylvestre-guide.json"), "utf8"));

const detectType = (t) => {
  t = (t || "").toLowerCase();
  if (t.includes("alignement") || t.includes("ordre")) return "ALIGNEMENT";
  if (t.includes("prérequis") || t.includes("pré-recquis") || t.includes("prerequis")) return "PREREQUIS";
  if (t.includes("récupérer") || t.includes("recuperer") || t.includes("zone")) return "ZONE";
  if (t.includes("dofus")) return "DOFUS";
  return "QUETE_SERIE";
};

async function main() {
  let guide = await db.optimizedGuide.findUnique({ where: { slug: "rush-sylvestre" } });
  if (!guide) {
    guide = await db.optimizedGuide.create({ data: { slug: "rush-sylvestre", name: "Rush Sylvestre", description: "Guide communautaire de rush Dofus Sylvestre", displayMode: "TIMELINE", isActive: true, isUnderConstruction: true } });
  }
  const existingMs = await db.guideMilestone.findMany({ where: { guideId: guide.id }, select: { id: true, title: true } });
  const existingTitles = new Set(existingMs.map((m) => m.title.trim().toLowerCase()));

  const toCreate = [];
  const prepMilestone = existingMs.find((m) => m.title.trim().toLowerCase() === "préparation");
  if (!prepMilestone) {
    toCreate.push({ title: "Préparation", type: "PREREQUIS", chapter: 0, chapterLabel: "Préparation", order: -1, tips: "Métiers & ressources à préparer avant le rush.", sequences: [{ name: "Métiers requis" }, { name: "Ressources à prévoir" }], metiers: data.preparation.metiers, items: data.preparation.items });
  }
  data.milestones.forEach((ms, i) => {
    if (existingTitles.has(ms.title.trim().toLowerCase())) return;
    toCreate.push({ title: ms.title, type: detectType(ms.title), chapter: i + 1, chapterLabel: ms.title.slice(0, 42), order: i, tips: [ms.notes, ms.succès ? `Succès : ${ms.succès}` : "", ms.aide ? `Aide : ${ms.aide}` : ""].filter(Boolean).join(" · ") || null, sequences: ms.sequences.map((s) => ({ name: s.name })), dungeons: ms.dungeons.filter((d) => d.id), aide: ms.aide });
  });

  const plan = { milestones: toCreate.length, sequences: toCreate.reduce((a, m) => a + m.sequences.length, 0), metiers: data.preparation.metiers.length, items: data.preparation.items.length, dungeons: toCreate.reduce((a, m) => a + (m.dungeons?.length || 0), 0) };
  console.log(`[${apply ? "APPLY" : "DRY-RUN"}] « ${guide.name} » (${guide.id})`);
  console.log(`  À créer : ${plan.milestones} jalons · ${plan.sequences} quêtes · ${plan.metiers} métiers · ${plan.items} objets · ${plan.dungeons} donjons`);
  console.log(`  Existant : ${existingMs.length} jalons (conservés, non écrasés)`);
  if (!apply) return;

  const created = { milestones: 0, sequences: 0 };
  await db.$transaction(async (tx) => {
    for (const ms of toCreate) {
      const m = await tx.guideMilestone.create({ data: { guideId: guide.id, type: ms.type, chapter: ms.chapter, chapterLabel: ms.chapterLabel, title: ms.title, tips: ms.tips, order: ms.order } });
      created.milestones++;
      for (let i = 0; i < ms.sequences.length; i++) {
        const s = ms.sequences[i];
        let activityTags = [];
        if (ms.title === "Préparation" && s.name === "Métiers requis") activityTags = ms.metiers.map((x) => ({ type: "metier", name: x.name, level: x.level }));
        else if (ms.title === "Préparation" && s.name === "Ressources à prévoir") activityTags = ms.items.map((x) => ({ type: "item", name: x.name, count: x.quantity, imageUrl: x.imageUrl, id: x.ankamaId ? String(x.ankamaId) : undefined }));
        else activityTags = (ms.dungeons || []).map((d) => ({ type: "donjon", name: d.name, id: d.id }));
        await tx.guideSequence.create({ data: { milestoneId: m.id, order: i, subGuideRef: s.name, subGuideName: s.name, dungeonIds: (ms.dungeons || []).map((d) => d.id).filter(Boolean), tips: ms.title === "Préparation" ? undefined : (ms.tips ?? undefined), note: ms.aide || null, activityTags } });
        created.sequences++;
      }
    }

    // ── Idempotence « Préparation » existante ──
    // Si le milestone « Préparation » existait déjà (base antérieure) mais sans
    // la séquence « Ressources à prévoir » (ou « Métiers requis »), on l'ajoute
    // avec les objets/métiers du dataset curé. Non destructif (insert seul).
    if (prepMilestone) {
      const existing = await tx.guideSequence.findMany({
        where: { milestoneId: prepMilestone.id },
        select: { subGuideName: true, subGuideRef: true, order: true },
      });
      const names = new Set(existing.map((s) => s.subGuideName || s.subGuideRef));
      let nextOrder = existing.length ? Math.max(...existing.map((s) => s.order ?? 0)) + 1 : 1;
      if (!names.has("Métiers requis")) {
        await tx.guideSequence.create({
          data: {
            milestoneId: prepMilestone.id,
            order: nextOrder++,
            subGuideRef: "Métiers requis",
            subGuideName: "Métiers requis",
            dungeonIds: [],
            activityTags: data.preparation.metiers.map((x) => ({ type: "metier", name: x.name, level: x.level })),
          },
        });
        created.sequences++;
      }
      if (!names.has("Ressources à prévoir")) {
        await tx.guideSequence.create({
          data: {
            milestoneId: prepMilestone.id,
            order: nextOrder++,
            subGuideRef: "Ressources à prévoir",
            subGuideName: "Ressources à prévoir",
            dungeonIds: [],
            activityTags: data.preparation.items.map((x) => ({ type: "item", name: x.name, count: x.quantity, imageUrl: x.imageUrl, id: x.ankamaId ? String(x.ankamaId) : undefined })),
          },
        });
        created.sequences++;
      }
    }
  });
  console.log(`  ✔ Créés : ${created.milestones} jalons · ${created.sequences} quêtes`);
}

main().catch((e) => { console.error("ERREUR :", e.message); process.exit(1); }).finally(() => db.$disconnect());

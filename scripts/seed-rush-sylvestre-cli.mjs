#!/usr/bin/env node
/**
 * CLI standalone — seed du guide Rush Sylvestre depuis le dataset unifié.
 * Même logique que `seedRushSylvestreFromGuide` (mais sans garde d'auth).
 * DRY-RUN par défaut ; `--apply` pour écrire en base.
 * Usage : npx tsx scripts/seed-rush-sylvestre-cli.mjs [--apply]
 */
// `dotenv` n'est PAS dans l'image *standalone* (le serveur ne l'importe pas) : en
// conteneur, l'environnement vient de Docker ⇒ chargement TOLÉRANT, jamais bloquant.
try {
  process.env.NODE_ENV ||= "development";
  await import("dotenv/config");
} catch {}
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";
import { normKey } from "./lib/rush-guide-keys.mjs";

const apply = process.argv.includes("--apply");
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

const data = JSON.parse(fs.readFileSync(path.resolve("src/data/rush-sylvestre-guide.json"), "utf8"));

async function main() {
  let guide = await db.optimizedGuide.findUnique({ where: { slug: "rush-sylvestre" } });
  if (!guide) {
    guide = await db.optimizedGuide.create({
      data: {
        slug: "rush-sylvestre",
        name: "Rush Sylvestre",
        description: "Guide communautaire de rush Dofus Sylvestre",
        displayMode: "TIMELINE",
        isActive: true,
        isUnderConstruction: false,
      },
    });
  }
  const existingMs = await db.guideMilestone.findMany({
    where: { guideId: guide.id },
    include: { sequences: { select: { id: true, subGuideName: true, subGuideRef: true } } },
  });

  // `normKey` vient de `./lib/rush-guide-keys.mjs` (source unique partagée avec les
  // scripts de maintenance : une règle d'appariement, un seul endroit).
  const existingMsMap = new Map(existingMs.map((m) => [normKey(m.title), m]));

  const allDbDungeons = await db.dungeon.findMany({
    select: { id: true, name: true, bossName: true, slug: true, dofusdbId: true },
  });
  const dungeonByName = new Map();
  const dungeonByBoss = new Map();
  allDbDungeons.forEach((d) => {
    dungeonByName.set(normKey(d.name), d);
    dungeonByBoss.set(normKey(d.bossName), d);
  });

  const resolveDungeonId = async (djTag) => {
    const nName = normKey(djTag.name);
    const nBoss = normKey(djTag.bossName);
    const found = dungeonByName.get(nName) || dungeonByBoss.get(nBoss);
    if (found) return found.id;
    if (!apply) return "dry-run-id";
    try {
      const boss = djTag.bossName || djTag.name || "Boss";
      const baseSlug = boss.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let slug = baseSlug;
      let counter = 1;
      while (await db.dungeon.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }
      const created = await db.dungeon.create({
        data: {
          name: djTag.name || "Donjon",
          bossName: boss,
          slug,
          level: Number(djTag.level) || 100,
          imageUrl: djTag.imageUrl || null,
        },
      });
      dungeonByName.set(normKey(created.name), created);
      return created.id;
    } catch {
      return null;
    }
  };

  const plan = {
    milestones: data.meta?.milestonesCount ?? data.milestones.length,
    sequences: data.meta?.sequencesCount ?? 0,
    items: data.meta?.itemsTaggedCount ?? 0,
    dungeons: data.meta?.dungeonMatchesCount ?? 0,
    coords: data.meta?.coordsCount ?? 0,
    prereqs: data.meta?.prereqLinksCount ?? 0,
  };

  console.log(`[${apply ? "APPLY" : "DRY-RUN"}] Guide « ${guide.name} » (${guide.id})`);
  console.log(`  Source : ${data.meta?.source || "Dataset unifié"}`);
  console.log(`  Total dans le dataset : ${plan.milestones} jalons · ${plan.sequences} quêtes · ${plan.items} tags d'objets · ${plan.dungeons} donjons · ${plan.coords} positions GPS`);
  console.log(`  Existant en DB : ${existingMs.length} jalons (seront enrichis et synchronisés sans perte)`);

  if (!apply) return;

  // ── Phase 0 : Nettoyage des milestones orphelins et doublons de séquences ──
  const jsonTitleKeys = new Set(data.milestones.map((ms) => normKey(ms.title)));

  const orphanMilestones = existingMs.filter((m) => !jsonTitleKeys.has(normKey(m.title)));
  if (orphanMilestones.length > 0) {
    console.log(`  🧹 Suppression de ${orphanMilestones.length} jalons orphelins…`);
    await db.guideSequence.deleteMany({ where: { milestoneId: { in: orphanMilestones.map((m) => m.id) } } });
    await db.guideMilestone.deleteMany({ where: { id: { in: orphanMilestones.map((m) => m.id) } } });
    orphanMilestones.forEach((m) => existingMsMap.delete(normKey(m.title)));
  }

  let totalDuplicatesDeleted = 0;
  for (const m of existingMs) {
    if (!jsonTitleKeys.has(normKey(m.title))) continue;
    const seenNames = new Map();
    const toDelete = [];
    for (const s of (m.sequences || [])) {
      const k = normKey(s.subGuideName);
      if (!k) continue;
      if (seenNames.has(k)) {
        toDelete.push(s.id);
      } else {
        seenNames.set(k, s.id);
      }
    }
    if (toDelete.length > 0) {
      await db.guideSequence.deleteMany({ where: { id: { in: toDelete } } });
      totalDuplicatesDeleted += toDelete.length;
      m.sequences = m.sequences.filter((s) => !toDelete.includes(s.id));
    }
  }
  if (totalDuplicatesDeleted > 0) {
    console.log(`  🧹 ${totalDuplicatesDeleted} séquences dupliquées supprimées en DB.`);
  }

  let createdMs = 0, updatedMs = 0, createdSeq = 0, updatedSeq = 0;

  for (let mIdx = 0; mIdx < data.milestones.length; mIdx++) {
    const ms = data.milestones[mIdx];
    const msKey = normKey(ms.title);
    let milestoneRecord = existingMsMap.get(msKey);

    if (!milestoneRecord) {
      milestoneRecord = await db.guideMilestone.create({
        data: {
          guideId: guide.id,
          type: ms.type || "QUETE_SERIE",
          chapter: ms.chapter ?? (mIdx + 1),
          chapterLabel: ms.chapterLabel || ms.title.slice(0, 48),
          title: ms.title,
          description: ms.description || null,
          tips: ms.tips || null,
          order: ms.order ?? mIdx,
          dofusId: ms.dofusId || null,
          accentColor: ms.accentColor || "#64748b",
          imageUrl: ms.imageUrl || null,
        },
        include: { sequences: true },
      });
      createdMs++;
      existingMsMap.set(msKey, milestoneRecord);
    } else {
      await db.guideMilestone.update({
        where: { id: milestoneRecord.id },
        data: {
          type: ms.type || milestoneRecord.type,
          chapter: ms.chapter !== undefined ? ms.chapter : milestoneRecord.chapter,
          chapterLabel: ms.chapterLabel || milestoneRecord.chapterLabel,
          description: ms.description !== undefined ? ms.description : milestoneRecord.description,
          tips: ms.tips !== undefined ? ms.tips : milestoneRecord.tips,
          order: ms.order !== undefined ? ms.order : milestoneRecord.order,
          dofusId: ms.dofusId || milestoneRecord.dofusId,
          accentColor: ms.accentColor || milestoneRecord.accentColor,
          imageUrl: ms.imageUrl || milestoneRecord.imageUrl,
        },
      });
      updatedMs++;
    }

    const existingSeqMap = new Map();
    (milestoneRecord.sequences || []).forEach((s) => {
      existingSeqMap.set(normKey(s.subGuideName), s);
      existingSeqMap.set(normKey(s.subGuideRef), s);
    });

    for (let sIdx = 0; sIdx < (ms.sequences || []).length; sIdx++) {
      const s = ms.sequences[sIdx];
      const seqName = s.subGuideName || s.subGuideRef || s.name || "Quête";
      const sKey = normKey(seqName);

      const resolvedDungeonIds = [];
      const updatedActivityTags = await Promise.all(
        (s.activityTags || []).map(async (tag) => {
          if (tag.type === "donjon") {
            const cuid = await resolveDungeonId(tag);
            if (cuid) {
              resolvedDungeonIds.push(cuid);
              return { ...tag, id: cuid };
            }
          }
          return tag;
        })
      );

      const seqData = {
        subGuideRef: seqName,
        subGuideName: seqName,
        dofuspourlesnoobsUrl: s.dofuspourlesnoobsUrl || null,
        dofusdbUrl: s.dofusdbUrl || null,
        alignReq: s.alignReq || null,
        alignOrderReq: s.alignOrderReq || null,
        dungeonId: resolvedDungeonIds[0] ?? null,
        dungeonIds: resolvedDungeonIds,
        mapPositions: s.mapPositions || undefined,
        activityTags: updatedActivityTags,
        tips: s.tips || null,
        note: s.note || null,
        order: s.order ?? sIdx,
      };

      const existingSeq = existingSeqMap.get(sKey);
      if (existingSeq) {
        await db.guideSequence.update({
          where: { id: existingSeq.id },
          data: seqData,
        });
        updatedSeq++;
      } else {
        await db.guideSequence.create({
          data: {
            ...seqData,
            milestoneId: milestoneRecord.id,
          },
        });
        createdSeq++;
      }
    }
  }

  console.log(`  ✔ Succès total : ${createdMs} créés / ${updatedMs} mis à jour (jalons) · ${createdSeq} créées / ${updatedSeq} enrichies (quêtes)`);
}

main()
  .catch((e) => {
    console.error("ERREUR :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());


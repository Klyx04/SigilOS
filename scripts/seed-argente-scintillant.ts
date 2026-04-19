import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
  if (!val) return '';
  return val.replace(/^['"]|['"]$/g, '').trim();
};

const getConnectionString = () => {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
  const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
  const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5433'; // Default dev port in local.yml is 5433
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

async function main() {
  const connectionString = getConnectionString();
  console.log(`📡 Connecting to: ${connectionString.split('@')[1]}`); // Log only host/port for security
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🚀 Starting CLI Seed for Dofus Argenté Scintillant...");

  try {
    // Load items list
    const itemsPath = path.resolve(process.cwd(), "prisma/seed-data/dofus-quests/dofus-items.json");
    const items: any[] = JSON.parse(fs.readFileSync(itemsPath, "utf-8"));

    const createdItems: Record<string, string> = {};

    // 1. Upsert DofusItems
    console.log(`📦 Seeding Dofus items...`);
    for (const item of items) {
      const record = await prisma.dofusItem.upsert({
        where: { slug: item.slug },
        update: {
          name: item.name,
          nameShort: item.nameShort,
          isMeta: item.isMeta ?? false,
          levelRecommended: item.levelRecommended,
          imageUrl: item.imageUrl,
          color: item.color,
          displayOrder: item.displayOrder,
          description: item.description,
          successName: item.successName,
        },
        create: {
          slug: item.slug,
          name: item.name,
          nameShort: item.nameShort,
          isMeta: item.isMeta ?? false,
          levelRecommended: item.levelRecommended,
          imageUrl: item.imageUrl,
          color: item.color,
          displayOrder: item.displayOrder,
          description: item.description,
          successName: item.successName,
          filterCategory: item.filterCategory ?? "AUTRES",
        },
      });
      createdItems[item.slug] = record.id;
    }

    // 2. Seed compiled chains for Argenté Scintillant
    const slug = "argente-scintillant";
    const filePath = "prisma/seed-data/dofus-quests/argente-scintillant-compiled.json";
    const dofusId = createdItems[slug];
    
    if (dofusId) {
      console.log(`🔗 Seeding chains for ${slug}...`);
      const chainData = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf-8"));

      // Clean existing
      await prisma.dofusQuestChain.deleteMany({ where: { dofusId } });

      for (const section of chainData.chains ?? []) {
        const chainRecord = await prisma.dofusQuestChain.create({
          data: {
            dofusId,
            sectionType: section.sectionType ?? "MAIN_CHAIN",
            sectionName: section.sectionName,
            description: section.description ?? null,
            chainOrder: section.chainOrder ?? 0,
          },
        });

        console.log(`  📝 Chain: ${section.sectionName} (${section.entries?.length ?? 0} entries)`);

        for (const entry of section.entries ?? []) {
          await prisma.dofusQuestEntry.create({
            data: {
              chainId: chainRecord.id,
              name: typeof entry.name === "string" ? entry.name : (entry.name?.name || String(entry.name)),
              zone: entry.zone ?? null,
              questType: entry.questType ?? "QUEST",
              stepOrder: entry.stepOrder ?? 0,
              isOptional: entry.isOptional ?? false,
              isLast: entry.isLast ?? false,
              isDungeon: entry.isDungeon ?? false,
              dofusdbId: entry.dofusdbId ?? null,
              npcName: entry.npcName ?? null,
              npcSubArea: entry.npcSubArea ?? null,
              requirements: entry.requirements ?? null,
              itemsRequired: entry.itemsRequired ?? null,
              dungeonsRequired: entry.dungeonsRequired ?? null,
              objectives: entry.objectives ?? null,
              coords: entry.coords ?? null,
              level: entry.level ?? null,
              weight: entry.weight ?? 1,
              externalRef: entry.externalRef ?? null,
            },
          });
        }
      }
    }

    console.log("✅ Seed completed successfully!");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

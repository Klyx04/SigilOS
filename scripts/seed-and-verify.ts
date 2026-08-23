import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@127.0.0.1:5433/sigilos?schema=public';
  console.log(`📡 Connecting to: ${connectionString}`);
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const slug = "du-cauchemar";
  const filePath = path.resolve(process.cwd(), "prisma/seed-data/dofus-quests/du-cauchemar-compiled.json");
  const chainData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const item = await prisma.dofusItem.findFirst({ where: { slug } });
  if (!item) throw new Error("Item not found");
  
  const dofusId = item.id;
  console.log(`Found item ${item.name} with ID ${dofusId}`);

  console.log("Deleting old chains...");
  const deleteResult = await prisma.dofusQuestChain.deleteMany({ where: { dofusId } });
  console.log(`Deleted ${deleteResult.count} chains.`);

  for (const section of chainData.chains ?? []) {
    const chainRecord = await prisma.dofusQuestChain.create({
      data: {
        dofusId,
        sectionType: section.sectionType ?? "MAIN_CHAIN",
        sectionName: section.sectionName,
        chainOrder: section.chainOrder ?? 0,
      },
    });
    console.log(`Created chain: ${section.sectionName}`);

    for (const entry of section.entries ?? []) {
      await prisma.dofusQuestEntry.create({
        data: {
          chainId: chainRecord.id,
          name: entry.name,
          dofusdbId: entry.dofusdbId,
          stepOrder: entry.stepOrder ?? 0,
          externalRef: entry.externalRef ?? null,
        },
      });
    }
  }

  console.log("Verifying immediately...");
  const verifiedChains = await prisma.dofusQuestChain.findMany({
    where: { dofusId },
    include: { entries: true }
  });
  
  for (const c of verifiedChains) {
    console.log(`Chain in DB: ${c.sectionName} (${c.entries.length} entries)`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

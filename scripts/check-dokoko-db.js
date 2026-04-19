const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const item = await prisma.dofusItem.findFirst({
    where: { slug: 'dokoko' }
  });

  if (!item) {
    console.log("Dokoko not found!");
    return;
  }

  console.log(`Dofus: ${item.name} (${item.slug})`);
  const chains = await prisma.dofusQuestChain.findMany({
    where: { dofusId: item.id },
    include: { entries: { 
        orderBy: { stepOrder: 'asc' }
    } }
  });

  for (const c of chains) {
    console.log(`\nChain: ${c.sectionName} (Type: ${c.sectionType})`);
    for (const e of c.entries) {
      console.log(`  - [${e.stepOrder}] ${e.name} (DB ID: ${e.dofusdbId}) | Lvl: ${e.level}`);
      if (e.dungeonsRequired && Array.isArray(e.dungeonsRequired)) {
        console.log(`    🏰 Dungeons: ${e.dungeonsRequired.map(d => d.name).join(', ')}`);
      }
    }
  }

  await prisma.$disconnect();
}

main();

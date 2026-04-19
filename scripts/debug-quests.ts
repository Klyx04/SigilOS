import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://sigiluser:sigilpass@localhost:5433/sigilos?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const item = await prisma.dofusItem.findFirst({
    where: { slug: 'argente' }
  });



  if (!item) {
    console.log("Item not found!");
    return;
  }

  console.log(`Item: ${item.name} (${item.id})`);
  const chains = await prisma.dofusQuestChain.findMany({
    where: { dofusId: item.id },
    include: { entries: { orderBy: { stepOrder: 'asc' } } }
  });

  for (const c of chains) {
    console.log(`\nChain: ${c.sectionName}`);
    for (const e of c.entries) {
      console.log(`  - [${e.stepOrder}] ${e.name} (DB ID: ${e.dofusdbId})`);
    }
  }

  await prisma.$disconnect();
}

main();

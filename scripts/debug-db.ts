import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://sigiluser:sigilpass@localhost:5433/sigilos?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Checking Dofus items...");
  const items = await prisma.dofusItem.findMany({
    where: { slug: { contains: 'cauchemar', mode: 'insensitive' } },
    select: { id: true, slug: true, name: true }
  });
  console.log(JSON.stringify(items, null, 2));

  for (const item of items) {
    const chains = await prisma.dofusQuestChain.findMany({
        where: { dofusId: item.id },
        include: { entries: true }
    });
    console.log(`\nChains for ${item.slug}: ${chains.length}`);
    for (const c of chains) {
        console.log(`  - ${c.sectionName} (${c.entries.length} entries)`);
    }
  }

  await prisma.$disconnect();
}

main();

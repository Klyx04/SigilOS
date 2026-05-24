import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { legendaryItems } from './seed-data/legendary-items';

async function main() {
  console.log('Seeding legendary items...');
  for (const item of legendaryItems) {
    await prisma.legendaryItem.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

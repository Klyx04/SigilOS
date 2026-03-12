
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const dungeons = await prisma.dungeon.findMany({
    take: 10,
    select: { id: true, name: true, bossName: true }
  })
  console.log(JSON.stringify(dungeons, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const counts = await db.godNotification.groupBy({
    by: ['type'],
    _count: {
      id: true
    }
  })
  console.log('GOD NOTIFICATION COUNTS:', JSON.stringify(counts, null, 2))

  const latest = await db.godNotification.findFirst({
    where: { type: 'BACKUP' },
    orderBy: { createdAt: 'desc' }
  })
  console.log('LATEST BACKUP NOTIFICATION:', JSON.stringify(latest, null, 2))
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())

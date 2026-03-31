import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Initialisation de PlatformConfig...')
  
  const config = await prisma.platformConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
    },
  })
  
  console.log('✅ PlatformConfig initialisée :', config)
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

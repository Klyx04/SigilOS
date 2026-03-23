import { PrismaClient } from '@prisma/client';

async function checkConfig() {
  const prisma = new PrismaClient();
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: "singleton" } });
    console.log('--- Platform Config ---');
    console.log(JSON.stringify(config, null, 2));
    
    if (config?.serviceStatusChannelId) {
        console.log('\n--- Testing Discord Permissions (Pseudo-check) ---');
        console.log('Channel ID found:', config.serviceStatusChannelId);
    } else {
        console.log('\n❌ serviceStatusChannelId is NOT set in PlatformConfig.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();

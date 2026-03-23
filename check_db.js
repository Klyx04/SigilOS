const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const guildId = '1290442961380835451';
  const guild = await prisma.guildConfig.findFirst({
    where: {
      OR: [
        { id: guildId },
        { discordGuildId: guildId }
      ]
    },
    include: { modules: true }
  });
  console.log('--- GUILD MODULES ---');
  console.log(JSON.stringify(guild?.modules, null, 2));
  
  const profile = await prisma.userProfile.findFirst({
    where: { guildId: guild?.id, pseudoDofus: { not: null } }
  });
  console.log('--- USER PROFILE EXAMPLE ---');
  console.log(JSON.stringify({ 
    userId: profile?.userId, 
    pseudo: profile?.pseudoDofus,
    points: profile?.successPoints 
  }, null, 2));
}

main().catch(e => console.error('BIG ERROR:', e)).finally(() => prisma.$disconnect());

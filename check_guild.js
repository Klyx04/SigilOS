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
  console.log(JSON.stringify(guild, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

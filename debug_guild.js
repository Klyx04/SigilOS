
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const guild = await prisma.guildConfig.findUnique({
    where: { discordGuildId: '1290442961380835451' },
    include: { modules: true }
  });
  console.log(JSON.stringify(guild, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

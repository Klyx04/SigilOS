const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
    const guilds = await db.guildConfig.findMany({
        select: { discordGuildId: true, rolesMapping: true, name: true }
    });
    console.log(JSON.stringify(guilds, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function check() {
    console.log('Dungeons:', await db.dungeon.count());
    console.log('Guilds:', await db.allowedGuild.count());
    console.log('GuildConfigs:', await db.guildConfig.count());

    const dungeons = await db.dungeon.findMany({ take: 3 });
    console.log('Sample Dungeons:', dungeons.map(d => d.name));
}

check().catch(console.error).finally(() => db.$disconnect());

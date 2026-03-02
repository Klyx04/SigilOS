import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

async function check() {
    const prisma = new PrismaClient();
    try {
        const allowed = await prisma.allowedGuild.findMany();
        console.log('Allowed Guilds:', JSON.stringify(allowed, null, 2));

        const configs = await prisma.guildConfig.findMany();
        console.log('Guild Configs:', JSON.stringify(configs, null, 2));

        const profiles = await prisma.userProfile.findMany();
        console.log('User Profiles:', JSON.stringify(profiles, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();

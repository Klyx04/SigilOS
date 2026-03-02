import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Script de rescue local — Usage : DATABASE_URL="..." npx ts-node scripts/rescue.ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL est requis pour ce script de rescue");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function rescue() {
    const guildId = "1290442961380835451";

    await db.allowedGuild.upsert({
        where: { discordGuildId: guildId },
        update: { isActive: true },
        create: {
            discordGuildId: guildId,
            addedBy: "RescueScript",
            isActive: true,
            name: "Local Dev Guild"
        }
    });

    await db.guildConfig.upsert({
        where: { discordGuildId: guildId },
        update: { name: "Local Dev Guild" },
        create: {
            id: guildId,
            discordGuildId: guildId,
            name: "Local Dev Guild",
            ownerId: "403000342167420929"
        }
    });

    const count = await db.allowedGuild.count();
    console.log("✅ Accès local restauré pour la guilde " + guildId + ". Total AllowedGuild: " + count);
}

rescue().catch(console.error).finally(() => db.$disconnect());

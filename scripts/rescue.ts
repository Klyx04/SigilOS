import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Script de rescue local — Usage : DATABASE_URL="..." GUILD_ID="..." OWNER_ID="..." npx ts-node scripts/rescue.ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL est requis pour ce script de rescue");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const db = new PrismaClient({ adapter });

async function rescue() {
    // ⚠️ Aucun identifiant Discord en dur dans le dépôt PUBLIC (cf. docs/RULES.md §Sécurité).
    const guildId = process.env.GUILD_ID;
    const ownerId = process.env.OWNER_ID;
    if (!guildId || !ownerId) {
        throw new Error("GUILD_ID et OWNER_ID sont requis (ex. GUILD_ID=<id> OWNER_ID=<id> npx ts-node scripts/rescue.ts)");
    }

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
            ownerId
        }
    });

    const count = await db.allowedGuild.count();
    console.log("✅ Accès local restauré pour la guilde " + guildId + ". Total AllowedGuild: " + count);
}

rescue().catch(console.error).finally(() => db.$disconnect());

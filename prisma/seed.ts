import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

// URL construction logic
const getConnectionString = () => {
    // If DATABASE_URL is provided, use it directly as the primary source of truth
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }

    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-beta' : 'localhost');

    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SeedData {
    version: string;
    exportedAt: string;
    exportedBy?: string;
    data: {
        zones: Array<{
            id: string;
            name: string;
            level: number;
            dpnlUrl?: string | null;
        }>;
        families: Array<{
            id: string;
            name: string;
            description?: string | null;
            imageUrl?: string | null;
            zoneIds: string[];
        }>;
        challenges: Array<{
            id: string;
            slug: string;
            name: string;
            description?: string | null;
            iconUrl?: string | null;
            conditions?: any;
        }>;
        dungeons: Array<{
            id: string;
            name: string;
            bossName: string;
            level: number;
            dpnlUrl?: string | null;
            imageUrl?: string | null;
            isExpedition: boolean;
            expeditionModes?: any;
            expeditionMechanics?: string | null;
            achievements: Array<{
                id: string;
                dungeonId: string;
                challengeId: string;
                points: number;
            }>;
        }>;
    };
}

async function seed() {
    console.error('🌱 Starting database seed...');

    const seedFilePath = path.join(process.cwd(), 'prisma', 'seed-data', 'game-data.json');

    if (!fs.existsSync(seedFilePath)) {
        console.error('⚠️  No seed file found at:', seedFilePath);
        return;
    }

    const seedData: SeedData = JSON.parse(fs.readFileSync(seedFilePath, 'utf-8'));

    console.error('📊 Seed file metadata:');
    console.error('  - Exported:', seedData.exportedAt);
    console.error('  - Version:', seedData.version);
    console.error('');

    // 0. Seed Dev Allowed Guilds & Configs (Prevent lockouts after reset)
    console.error('🛡️  Seeding Dev environment...');
    const testGuildId = '1290442961380835451'; // From .env DISCORD_GUILD_ID
    const superAdminDiscordId = '403000342167420929'; // From .env SUPER_ADMIN_IDS

    // 0.1 Seed Whitelist
    await prisma.allowedGuild.upsert({
        where: { discordGuildId: testGuildId },
        update: { isActive: true },
        create: {
            discordGuildId: testGuildId,
            name: 'SigilOS Test Guild',
            isActive: true,
            tier: 'LEGACY_PREMIUM',
            addedBy: 'SYSTEM_SEED'
        }
    });

    // 0.2 Seed Guild Config (Mark as onboarded)
    const guildConfig = await prisma.guildConfig.upsert({
        where: { discordGuildId: testGuildId },
        update: { isActive: true },
        create: {
            discordGuildId: testGuildId,
            name: 'SigilOS Test Guild',
            isActive: true,
        }
    });

    // 0.3 Ensure Super Admin account exists in DB (User + Account)
    // This allows the session to link correctly even after a hard reset
    let account = await prisma.account.findFirst({
        where: { provider: 'discord', providerAccountId: superAdminDiscordId }
    });

    let userId: string;

    if (!account) {
        console.error('🛠️ Seeding Super Admin user/account...');
        const newUser = await prisma.user.create({
            data: {
                name: 'Wylan (Dev)',
                image: 'https://cdn.discordapp.com/embed/avatars/0.png',
                accounts: {
                    create: {
                        provider: 'discord',
                        type: 'oauth',
                        providerAccountId: superAdminDiscordId,
                    }
                }
            }
        });
        userId = newUser.id;
    } else {
        userId = account.userId;
    }

    // 0.4 Link profile for immediate dashboard access
    await prisma.userProfile.upsert({
        where: {
            userId_guildId: {
                userId: userId,
                guildId: guildConfig.id
            }
        },
        update: { status: 'ACTIVE' },
        create: {
            userId: userId,
            guildId: guildConfig.id,
            status: 'ACTIVE',
            discordNickname: 'Wylan (Dev)',
            discordRoleName: 'Boss / Dev',
            discordRoleColor: 0xF59E0B
        }
    });

    console.error(`✅ Dev environment authorized and configured`);

    // Maps for ID resolution
    const zoneIdMap = new Map<string, string>();
    const challengeIdMap = new Map<string, string>();

    // 1. Seed Zones
    console.error('🗺️  Seeding Zones...');
    for (const zone of seedData.data.zones) {
        const upserted = await prisma.zone.upsert({
            where: { name: zone.name },
            update: {
                level: zone.level,
                dpnlUrl: zone.dpnlUrl,
            },
            create: {
                name: zone.name,
                level: zone.level,
                dpnlUrl: zone.dpnlUrl,
            },
        });
        zoneIdMap.set(zone.id, upserted.id);
    }
    console.error(`✅ ${seedData.data.zones.length} zones seeded`);

    // 2. Seed Monster Families
    console.error('👾 Seeding Monster Families...');
    for (const mf of seedData.data.families) {
        await prisma.monsterFamily.upsert({
            where: { name: mf.name },
            update: {
                description: mf.description,
                imageUrl: mf.imageUrl,
                zones: mf.zoneIds ? {
                    set: mf.zoneIds
                        .map(id => zoneIdMap.get(id))
                        .filter((id): id is string => !!id)
                        .map(id => ({ id }))
                } : undefined
            },
            create: {
                name: mf.name,
                description: mf.description,
                imageUrl: mf.imageUrl,
                zones: mf.zoneIds ? {
                    connect: mf.zoneIds
                        .map(id => zoneIdMap.get(id))
                        .filter((id): id is string => !!id)
                        .map(id => ({ id }))
                } : undefined
            },
        });
    }
    console.error(`✅ ${seedData.data.families.length} monster families seeded`);

    // 3. Seed Challenges
    console.error('🏆 Seeding Challenges...');
    for (const challenge of seedData.data.challenges) {
        const upserted = await prisma.challenge.upsert({
            where: { slug: challenge.slug },
            update: {
                name: challenge.name,
                description: challenge.description,
                iconUrl: challenge.iconUrl,
                conditions: challenge.conditions,
            },
            create: {
                slug: challenge.slug,
                name: challenge.name,
                description: challenge.description,
                iconUrl: challenge.iconUrl,
                conditions: challenge.conditions,
            },
        });
        challengeIdMap.set(challenge.id, upserted.id);
    }
    console.error(`✅ ${seedData.data.challenges.length} challenges seeded`);

    // 4. Seed Dungeons
    console.error('🏰 Seeding Dungeons...');
    for (const dungeon of seedData.data.dungeons) {
        const upsertedDungeon = await prisma.dungeon.upsert({
            where: {
                name_bossName: {
                    name: dungeon.name,
                    bossName: dungeon.bossName
                }
            },
            update: {
                bossName: dungeon.bossName,
                level: dungeon.level,
                dpnlUrl: dungeon.dpnlUrl,
                imageUrl: dungeon.imageUrl,
                isExpedition: dungeon.isExpedition,
                expeditionModes: dungeon.expeditionModes || null,
                expeditionMechanics: dungeon.expeditionMechanics,
            },
            create: {
                name: dungeon.name,
                bossName: dungeon.bossName,
                level: dungeon.level,
                dpnlUrl: dungeon.dpnlUrl,
                imageUrl: dungeon.imageUrl,
                isExpedition: dungeon.isExpedition,
                expeditionModes: dungeon.expeditionModes || null,
                expeditionMechanics: dungeon.expeditionMechanics,
            },
        });

        // Seed achievements
        if (dungeon.achievements && Array.isArray(dungeon.achievements)) {
            for (const ach of dungeon.achievements) {
                const dbChallengeId = challengeIdMap.get(ach.challengeId);
                if (!dbChallengeId) continue;

                await prisma.dungeonAchievement.upsert({
                    where: {
                        dungeonId_challengeId: {
                            dungeonId: upsertedDungeon.id,
                            challengeId: dbChallengeId
                        }
                    },
                    update: { points: ach.points },
                    create: {
                        dungeonId: upsertedDungeon.id,
                        challengeId: dbChallengeId,
                        points: ach.points
                    }
                });
            }
        }
    }
    console.error(`✅ ${seedData.data.dungeons.length} dungeons seeded`);

    console.error('');
    console.error('🎉 Database seeding completed successfully!');
}

seed()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

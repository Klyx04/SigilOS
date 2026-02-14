import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

// URL construction logic
const getConnectionString = () => {
    if (process.env.DATABASE_URL && !process.env.POSTGRES_USER) {
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
            where: { name: dungeon.name },
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

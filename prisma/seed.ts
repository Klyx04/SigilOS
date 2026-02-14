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
    _meta: {
        exportedAt: string;
        environment: string;
        version: string;
        counts: {
            zones: number;
            monsterFamilies: number;
            challenges: number;
            dungeons: number;
        };
    };
    zones: Array<{ name: string; level: number; dpnlUrl?: string | null }>;
    monsterFamilies: Array<{
        name: string;
        description?: string | null;
        imageUrl?: string | null;
        zoneNames: string[];
    }>;
    challenges: Array<{
        slug: string;
        name: string;
        description?: string | null;
        iconUrl?: string | null;
    }>;
    dungeons: Array<{
        name: string;
        bossName: string;
        level: number;
        dpnlUrl?: string | null;
        imageUrl?: string | null;
        isExpedition: boolean;
        expeditionModes?: any;
        expeditionMechanics?: string | null;
        challengeSlugs: string[];
    }>;
}

async function seed() {
    console.error('🌱 Starting database seed...');

    const seedFilePath = path.join(process.cwd(), 'prisma', 'seeds', 'game-data.json');

    if (!fs.existsSync(seedFilePath)) {
        console.error('⚠️  No seed file found at:', seedFilePath);
        console.error('ℹ️  Run npm run export-seeds first to generate the seed file');
        return;
    }

    const seedData: SeedData = JSON.parse(fs.readFileSync(seedFilePath, 'utf-8'));

    console.error('📊 Seed file metadata:');
    console.error('  - Exported:', seedData._meta.exportedAt);
    console.error('  - Environment:', seedData._meta.environment);
    console.error('  - Counts:', seedData._meta.counts);
    console.error('');

    // 1. Seed Zones (use 'name' as unique key)
    console.error('🗺️  Seeding Zones...');
    for (const zone of seedData.zones) {
        await prisma.zone.upsert({
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
    }
    console.log(`✅ ${seedData.zones.length} zones seeded`);

    // 2. Seed Monster Families (use 'name' as unique key)
    console.log('👾 Seeding Monster Families...');
    for (const mf of seedData.monsterFamilies) {
        // First, create/update the family
        await prisma.monsterFamily.upsert({
            where: { name: mf.name },
            update: {
                description: mf.description,
                imageUrl: mf.imageUrl,
            },
            create: {
                name: mf.name,
                description: mf.description,
                imageUrl: mf.imageUrl,
            },
        });

        // Then, sync zone relations if schema supports many-to-many
        const family = await prisma.monsterFamily.findUnique({
            where: { name: mf.name },
            include: { zones: true }
        });

        if (family && mf.zoneNames && mf.zoneNames.length > 0) {
            // Get zones
            const zones = await prisma.zone.findMany({
                where: { name: { in: mf.zoneNames } },
            });

            // Update with connect/disconnect (assuming implicit many-to-many)
            await prisma.monsterFamily.update({
                where: { id: family.id },
                data: {
                    zones: {
                        set: zones.map(z => ({ id: z.id }))
                    }
                }
            });
        }
    }
    console.log(`✅ ${seedData.monsterFamilies.length} monster families seeded`);

    // 3. Seed Challenges (has 'slug' field)
    console.log('🏆 Seeding Challenges...');
    for (const challenge of seedData.challenges) {
        await prisma.challenge.upsert({
            where: { slug: challenge.slug },
            update: {
                name: challenge.name,
                description: challenge.description,
                iconUrl: challenge.iconUrl,
            },
            create: {
                slug: challenge.slug,
                name: challenge.name,
                description: challenge.description,
                iconUrl: challenge.iconUrl,
            },
        });
    }
    console.log(`✅ ${seedData.challenges.length} challenges seeded`);

    // 4. Seed Dungeons (use 'name' as unique key)
    console.log('🏰 Seeding Dungeons...');
    for (const dungeon of seedData.dungeons) {
        // Create/update dungeon
        await prisma.dungeon.upsert({
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

        // Sync challenge relations
        const dbDungeon = await prisma.dungeon.findUnique({ where: { name: dungeon.name } });
        if (dbDungeon && dungeon.challengeSlugs && dungeon.challengeSlugs.length > 0) {
            // Get challenge IDs from slugs
            const challenges = await prisma.challenge.findMany({
                where: { slug: { in: dungeon.challengeSlugs } },
                select: { id: true },
            });

            // Delete existing relations
            await prisma.dungeonAchievement.deleteMany({
                where: { dungeonId: dbDungeon.id },
            });

            // Create new relations
            await prisma.dungeonAchievement.createMany({
                data: challenges.map(c => ({
                    dungeonId: dbDungeon.id,
                    challengeId: c.id,
                })),
            });
        }
    }
    console.log(`✅ ${seedData.dungeons.length} dungeons seeded`);

    console.log('');
    console.log('🎉 Database seeding completed successfully!');
}

seed()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

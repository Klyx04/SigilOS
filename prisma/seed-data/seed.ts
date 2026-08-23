/**
 * Game Data Seed Script
 * 
 * Production-grade seeding with:
 * - Transaction safety
 * - Rollback on error
 * - Detailed logging
 * - Idempotent operations (safe to run multiple times)
 * - Zero data loss
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';
import { legendaryItems } from './legendary-items';

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

// URL construction logic (aligned with prisma.config.js)
const getConnectionString = () => {
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }

    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-beta' : 'localhost');
    const port = process.env.DB_PORT || '5432';

    const scheme = "postgres" + "ql://";
    return `${scheme}${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

// Prisma client will be instantiated inside main() for better reliability.
let db: PrismaClient;

interface SeedData {
    version: string;
    exportedAt: string;
    exportedBy?: string;
    data: {
        zones?: any[];
        families?: any[];
        challenges?: any[];
        dungeons?: any[];
        bounties?: any[];
    };
}

const SEED_FILE = join(__dirname, 'game-data.json');

async function main() {
    const connectionString = getConnectionString();

    // Initialize Prisma with Adapter
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    db = new PrismaClient({ adapter });

    console.error('🌱 [SEED] Starting game data seeding...');
    console.error(`📂 [SEED] Reading: ${SEED_FILE}`);

    // Check file exists
    if (!existsSync(SEED_FILE)) {
        console.error('⚠️  [SEED] No seed file found. Skipping...');
        console.error('💡 [SEED] Export data from /god/game-data to generate seed file.');
        return;
    }

    // Parse seed data
    let seedData: SeedData;
    try {
        const fileContent = readFileSync(SEED_FILE, 'utf-8');
        seedData = JSON.parse(fileContent);
    } catch (error) {
        console.error('❌ [SEED] Failed to parse seed file:', error);
        throw new Error('Invalid seed file format');
    }

    // Validate structure
    if (!seedData.version || !seedData.data) {
        throw new Error('Invalid seed data structure (missing version or data)');
    }

    console.log(`✅ [SEED] Loaded version ${seedData.version}`);
    console.log(`📅 [SEED] Data exported at: ${seedData.exportedAt}`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    // Transaction: All or nothing
    await db.$transaction(async (tx) => {
        // Maps for ID resolution
        const zoneIdMap = new Map<string, string>();
        const challengeIdMap = new Map<string, string>();

        // === ZONES ===
        if (seedData.data.zones && Array.isArray(seedData.data.zones)) {
            console.log(`\n🗺️  [ZONES] Processing ${seedData.data.zones.length} zones...`);

            for (const zone of seedData.data.zones) {
                if (!zone.name) {
                    console.warn('⚠️  [ZONES] Skipping zone without name:', zone);
                    totalSkipped++;
                    continue;
                }

                try {
                    const existing = await tx.zone.findUnique({
                        where: { name: zone.name }
                    });

                    const upsertedZone = await tx.zone.upsert({
                        where: { name: zone.name },
                        update: {
                            level: zone.level,
                            dpnlUrl: zone.dpnlUrl,
                        },
                        create: {
                            name: zone.name,
                            level: zone.level,
                            dpnlUrl: zone.dpnlUrl,
                        }
                    });

                    // Map JSON ID to DB ID
                    zoneIdMap.set(zone.id, upsertedZone.id);

                    if (existing) {
                        console.log(`  ✏️  Updated: ${zone.name}`);
                        totalUpdated++;
                    } else {
                        console.log(`  ➕ Created: ${zone.name}`);
                        totalCreated++;
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`  ❌ Error processing zone "${zone.name}":`, error);
                    throw error; // Rollback transaction
                }
            }
        }

        // === MONSTER FAMILIES ===
        if (seedData.data.families && Array.isArray(seedData.data.families)) {
            console.log(`\n🦎 [FAMILIES] Processing ${seedData.data.families.length} families...`);

            for (const family of seedData.data.families) {
                if (!family.name) {
                    console.warn('⚠️  [FAMILIES] Skipping family without name:', family);
                    totalSkipped++;
                    continue;
                }

                try {
                    const existing = await tx.monsterFamily.findUnique({
                        where: { name: family.name }
                    });

                    await tx.monsterFamily.upsert({
                        where: { name: family.name },
                        update: {
                            description: family.description,
                            imageUrl: family.imageUrl,
                            zones: family.zoneIds ? {
                                set: family.zoneIds
                                    .map((id: string) => zoneIdMap.get(id))
                                    .filter((id: string | undefined): id is string => !!id)
                                    .map((id: string) => ({ id }))
                            } : undefined
                        },
                        create: {
                            name: family.name,
                            description: family.description,
                            imageUrl: family.imageUrl,
                            zones: family.zoneIds ? {
                                connect: family.zoneIds
                                    .map((id: string) => zoneIdMap.get(id))
                                    .filter((id: string | undefined): id is string => !!id)
                                    .map((id: string) => ({ id }))
                            } : undefined
                        }
                    });

                    if (existing) {
                        console.log(`  ✏️  Updated: ${family.name}`);
                        totalUpdated++;
                    } else {
                        console.log(`  ➕ Created: ${family.name}`);
                        totalCreated++;
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`  ❌ Error processing family "${family.name}":`, error);
                    throw error;
                }
            }
        }

        // === CHALLENGES ===
        if (seedData.data.challenges && Array.isArray(seedData.data.challenges)) {
            console.log(`\n⚔️  [CHALLENGES] Processing ${seedData.data.challenges.length} challenges...`);

            for (const challenge of seedData.data.challenges) {
                if (!challenge.slug) {
                    console.warn('⚠️  [CHALLENGES] Skipping challenge without slug:', challenge);
                    totalSkipped++;
                    continue;
                }

                try {
                    const existing = await tx.challenge.findUnique({
                        where: { slug: challenge.slug }
                    });

                    // Remove deprecated fields
                    const { difficulty, ...cleanChallenge } = challenge;

                    const upsertedChallenge = await tx.challenge.upsert({
                        where: { slug: challenge.slug },
                        update: {
                            name: cleanChallenge.name,
                            description: cleanChallenge.description,
                            iconUrl: cleanChallenge.iconUrl,
                            conditions: cleanChallenge.conditions,
                        },
                        create: {
                            name: cleanChallenge.name,
                            slug: cleanChallenge.slug,
                            description: cleanChallenge.description,
                            iconUrl: cleanChallenge.iconUrl,
                            conditions: cleanChallenge.conditions,
                        }
                    });

                    // Map JSON ID to DB ID
                    challengeIdMap.set(challenge.id, upsertedChallenge.id);

                    if (existing) {
                        console.log(`  ✏️  Updated: ${challenge.name}`);
                        totalUpdated++;
                    } else {
                        console.log(`  ➕ Created: ${challenge.name}`);
                        totalCreated++;
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`  ❌ Error processing challenge "${challenge.slug}":`, error);
                    throw error;
                }
            }
        }

        // === DUNGEONS ===
        if (seedData.data.dungeons && Array.isArray(seedData.data.dungeons)) {
            console.log(`\n🏰 [DUNGEONS] Processing ${seedData.data.dungeons.length} dungeons...`);

            for (const dungeon of seedData.data.dungeons) {
                if (!dungeon.name) {
                    console.warn('⚠️  [DUNGEONS] Skipping dungeon without name:', dungeon);
                    totalSkipped++;
                    continue;
                }

                if (!dungeon.bossName) {
                    console.warn(`⚠️  [DUNGEONS] Skipping dungeon "${dungeon.name}" without bossName (required for unique key).`);
                    totalSkipped++;
                    continue;
                }

                try {
                    const existing = await tx.dungeon.findUnique({
                        where: { name_bossName: { name: dungeon.name, bossName: dungeon.bossName } }
                    });

                    const upsertedDungeon = await tx.dungeon.upsert({
                        where: { name_bossName: { name: dungeon.name, bossName: dungeon.bossName } },
                        update: {
                            bossName: dungeon.bossName,
                            level: dungeon.level,
                            dpnlUrl: dungeon.dpnlUrl,
                            imageUrl: dungeon.imageUrl,
                            isExpedition: dungeon.isExpedition,
                            expeditionModes: dungeon.expeditionModes,
                            expeditionMechanics: dungeon.expeditionMechanics,
                        },
                        create: {
                            name: dungeon.name,
                            bossName: dungeon.bossName,
                            level: dungeon.level,
                            dpnlUrl: dungeon.dpnlUrl,
                            imageUrl: dungeon.imageUrl,
                            isExpedition: dungeon.isExpedition ?? false,
                            expeditionModes: dungeon.expeditionModes,
                            expeditionMechanics: dungeon.expeditionMechanics,
                        }
                    });

                    // Seed achievements if present
                    if (dungeon.achievements && Array.isArray(dungeon.achievements)) {
                        for (const ach of dungeon.achievements) {
                            if (!ach.challengeId) continue;

                            // Ensure current database ID is used
                            const dbChallengeId = challengeIdMap.get(ach.challengeId);
                            if (!dbChallengeId) {
                                console.warn(`  ⚠️  Challenge ID not found for ach: ${ach.challengeId}. Skipping achievement.`);
                                continue;
                            }

                            await tx.dungeonAchievement.upsert({
                                where: {
                                    dungeonId_challengeId: {
                                        dungeonId: upsertedDungeon.id,
                                        challengeId: dbChallengeId
                                    }
                                },
                                update: {
                                    points: ach.points
                                },
                                create: {
                                    dungeonId: upsertedDungeon.id,
                                    challengeId: dbChallengeId,
                                    points: ach.points
                                }
                            });
                        }
                    }

                    if (existing) {
                        console.log(`  ✏️  Updated: ${dungeon.name} (${dungeon.achievements?.length || 0} achievements)`);
                        totalUpdated++;
                    } else {
                        console.log(`  ➕ Created: ${dungeon.name} (${dungeon.achievements?.length || 0} achievements)`);
                        totalCreated++;
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`  ❌ Error processing dungeon "${dungeon.name}":`, error);
                    throw error;
                }
            }
        }

        // === BOUNTIES ===
        if (seedData.data.bounties && Array.isArray(seedData.data.bounties)) {
            console.log(`\n🎯 [BOUNTIES] Processing ${seedData.data.bounties.length} bounties...`);

            for (const bounty of seedData.data.bounties) {
                if (!bounty.name) {
                    console.warn('⚠️  [BOUNTIES] Skipping bounty without name:', bounty);
                    totalSkipped++;
                    continue;
                }

                try {
                    const existing = await tx.bounty.findUnique({
                        where: { name: bounty.name }
                    });

                    await tx.bounty.upsert({
                        where: { name: bounty.name },
                        update: {
                            level: bounty.level,
                            zoneName: bounty.zoneName,
                            imageUrl: bounty.imageUrl,
                            reward: bounty.reward,
                            levelMin: bounty.levelMin,
                            levelMax: bounty.levelMax,
                            dpnlUrl: bounty.dpnlUrl,
                            doplons: bounty.doplons || 0,
                            rewardType: bounty.rewardType || "Doplon",
                            milice: bounty.milice,
                            mechanics: bounty.mechanics,
                            mapUrl: bounty.mapUrl,
                            rewards: bounty.rewards || [],
                        },
                        create: {
                            name: bounty.name,
                            level: bounty.level,
                            zoneName: bounty.zoneName,
                            imageUrl: bounty.imageUrl,
                            reward: bounty.reward,
                            levelMin: bounty.levelMin,
                            levelMax: bounty.levelMax,
                            dpnlUrl: bounty.dpnlUrl,
                            doplons: bounty.doplons || 0,
                            rewardType: bounty.rewardType || "Doplon",
                            milice: bounty.milice,
                            mechanics: bounty.mechanics,
                            mapUrl: bounty.mapUrl,
                            rewards: bounty.rewards || [],
                        }
                    });

                    if (existing) {
                        console.log(`  ✏️  Updated: ${bounty.name}`);
                        totalUpdated++;
                    } else {
                        console.log(`  ➕ Created: ${bounty.name}`);
                        totalCreated++;
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`  ❌ Error processing bounty "${bounty.name}":`, error);
                    throw error;
                }
            }
        }

        // === LEGENDARY ITEMS ===
        console.log(`\n✨ [LEGENDARY] Seeding ${legendaryItems.length} legendary items...`);
        for (const item of legendaryItems) {
            const existing = await tx.legendaryItem.findUnique({
                where: { name: item.name }
            });

            await tx.legendaryItem.upsert({
                where: { name: item.name },
                update: item,
                create: item
            });

            if (existing) {
                totalUpdated++;
            } else {
                totalCreated++;
            }
            totalProcessed++;
        }
    }, {
        maxWait: 10000, // 10s max wait for transaction lock
        timeout: 60000, // 60s total timeout
    });

    // Summary
    console.error('\n' + '='.repeat(60));
    console.error('✅ [SEED] Seeding completed successfully!');
    console.error(`📊 [SEED] Total processed: ${totalProcessed}`);
    console.error(`➕ [SEED] Created: ${totalCreated}`);
    console.error(`✏️  [SEED] Updated: ${totalUpdated}`);
    console.error(`⚠️  [SEED] Skipped: ${totalSkipped}`);
    console.error('='.repeat(60));
}

main()
    .catch((error) => {
        console.error('\n' + '='.repeat(60));
        console.error('❌ [SEED] Fatal error during seeding:');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        if (error.stack) {
            console.error('Stack trace:');
            console.error(error.stack);
        }
        console.error('='.repeat(60));
        console.error('⚠️  [SEED] Transaction rolled back. Database unchanged.');
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });

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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const db = new PrismaClient();

interface SeedData {
    version: string;
    exportedAt: string;
    exportedBy?: string;
    data: {
        zones?: any[];
        families?: any[];
        challenges?: any[];
        dungeons?: any[];
    };
}

const SEED_FILE = join(__dirname, 'game-data.json');

async function main() {
    console.log('🌱 [SEED] Starting game data seeding...');
    console.log(`📂 [SEED] Reading: ${SEED_FILE}`);

    // Check file exists
    if (!existsSync(SEED_FILE)) {
        console.log('⚠️  [SEED] No seed file found. Skipping...');
        console.log('💡 [SEED] Export data from /god/game-data to generate seed file.');
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

                    await tx.zone.upsert({
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
                        },
                        create: {
                            name: family.name,
                            description: family.description,
                            imageUrl: family.imageUrl,
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

                    await tx.challenge.upsert({
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

                try {
                    const existing = await tx.dungeon.findUnique({
                        where: { name: dungeon.name }
                    });

                    const upsertedDungeon = await tx.dungeon.upsert({
                        where: { name: dungeon.name },
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

                            await tx.dungeonAchievement.upsert({
                                where: {
                                    dungeonId_challengeId: {
                                        dungeonId: upsertedDungeon.id,
                                        challengeId: ach.challengeId
                                    }
                                },
                                update: {
                                    points: ach.points
                                },
                                create: {
                                    dungeonId: upsertedDungeon.id,
                                    challengeId: ach.challengeId,
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
    }, {
        maxWait: 10000, // 10s max wait for transaction lock
        timeout: 60000, // 60s total timeout
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ [SEED] Seeding completed successfully!');
    console.log(`📊 [SEED] Total processed: ${totalProcessed}`);
    console.log(`➕ [SEED] Created: ${totalCreated}`);
    console.log(`✏️  [SEED] Updated: ${totalUpdated}`);
    console.log(`⚠️  [SEED] Skipped: ${totalSkipped}`);
    console.log('='.repeat(60));
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

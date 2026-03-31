/**
 * Seed script — Module Quêtes Dofus
 * Peuple DofusItem, DofusQuestChain, DofusQuestEntry depuis les JSONs curatés.
 * Usage: npx ts-node --esm scripts/seed-dofus-quests.ts
 *        OR: npx tsx scripts/seed-dofus-quests.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const db = new PrismaClient();

async function main() {
    console.log("🎯 Seeding Dofus Quest Module...");

    // 1. Load JSON files
    const itemsPath = path.join(process.cwd(), "prisma/seed-data/dofus-quests/dofus-items.json");
    const chainsPath = path.join(process.cwd(), "prisma/seed-data/dofus-quests/quest-chains.json");

    const items: any[] = JSON.parse(fs.readFileSync(itemsPath, "utf-8"));
    const chainsData: any = JSON.parse(fs.readFileSync(chainsPath, "utf-8"));

    // 2. Upsert DofusItem records
    console.log(`📦 Upserting ${items.length} Dofus items...`);
    const createdItems: Record<string, string> = {}; // slug -> id

    for (const item of items) {
        const record = await db.dofusItem.upsert({
            where: { slug: item.slug },
            update: {
                name: item.name,
                nameShort: item.nameShort,
                element: item.element,
                rarity: item.rarity,
                isPrimordial: item.isPrimordial,
                levelRecommended: item.levelRecommended,
                imageUrl: item.imageUrl,
                color: item.color,
                displayOrder: item.displayOrder,
                description: item.description,
                successName: item.successName,
            },
            create: {
                slug: item.slug,
                name: item.name,
                nameShort: item.nameShort,
                element: item.element,
                rarity: item.rarity,
                isPrimordial: item.isPrimordial,
                levelRecommended: item.levelRecommended,
                imageUrl: item.imageUrl,
                color: item.color,
                displayOrder: item.displayOrder,
                description: item.description,
                successName: item.successName,
            },
        });
        createdItems[item.slug] = record.id;
        console.log(`  ✅ ${item.name}`);
    }

    // 3. For each Dofus that has a chain defined, seed chains + entries
    const dofusSlugs = Object.keys(chainsData.dofus);
    console.log(`\n🔗 Seeding quest chains for ${dofusSlugs.length} Dofus...`);

    for (const slug of dofusSlugs) {
        const chain = chainsData.dofus[slug];
        const dofusId = createdItems[slug];

        if (!dofusId) {
            console.warn(`  ⚠️ No DofusItem found for slug: ${slug}`);
            continue;
        }

        // Delete existing chains for this Dofus (full replacement on re-seed)
        await db.dofusQuestChain.deleteMany({ where: { dofusId } });

        let chainOrder = 0;

        // Seed prerequisite sections
        for (const prereq of chain.prerequisites || []) {
            const chainRecord = await db.dofusQuestChain.create({
                data: {
                    dofusId,
                    sectionType: "PREREQUISITE",
                    sectionName: prereq.name,
                    description: prereq.description,
                    chainOrder: chainOrder++,
                },
            });

            // Seed quest entries for this prereq section
            let stepOrder = 0;
            for (const quest of prereq.quests || []) {
                await db.dofusQuestEntry.create({
                    data: {
                        chainId: chainRecord.id,
                        name: quest.name,
                        zone: quest.zone,
                        questType: quest.type || "QUEST",
                        stepOrder: stepOrder++,
                        isOptional: quest.isOptional || false,
                        notes: quest.note,
                        requirements: quest.requirements || undefined,
                    },
                });
            }
        }

        // Seed main quest chain
        if (chain.questChain && chain.questChain.length > 0) {
            const mainChain = await db.dofusQuestChain.create({
                data: {
                    dofusId,
                    sectionType: "MAIN_CHAIN",
                    sectionName: "Les quêtes",
                    description: `Quêtes directement requises pour obtenir le ${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
                    chainOrder: chainOrder++,
                },
            });

            for (const quest of chain.questChain) {
                await db.dofusQuestEntry.create({
                    data: {
                        chainId: mainChain.id,
                        name: quest.name,
                        zone: quest.zone,
                        questType: quest.type || "QUEST",
                        stepOrder: quest.stepOrder || 0,
                        isOptional: quest.isOptional || false,
                        isLast: quest.isLast || false,
                        notes: quest.note,
                        requirements: quest.requirements || undefined,
                    },
                });
            }
        }

        const totalEntries = (chain.prerequisites || []).reduce(
            (acc: number, p: any) => acc + (p.quests?.length || 0), 0
        ) + (chain.questChain?.length || 0);

        console.log(`  ✅ ${slug}: ${totalEntries} entrées dans ${chainOrder} sections`);
    }

    console.log("\n✨ Seed terminé avec succès !");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });

/**
 * seed-v3-compiled.ts
 * Seed direct depuis les fichiers *-compiled.json V3
 * Usage: npx tsx scripts/seed-v3-compiled.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

import { db } from "../src/lib/prisma";
const DATA_DIR = path.join(process.cwd(), "prisma/seed-data/dofus-quests");

const CHAIN_FILES = [
    { slug: "emeraude",            file: "emeraude-compiled.json" },
    { slug: "turquoise",           file: "turquoise-compiled.json" },
    { slug: "ivoire",              file: "ivoire-compiled.json" },
    { slug: "ebene",               file: "ebene-compiled.json" },
    { slug: "ocre",                file: "ocre-compiled.json" },
    { slug: "pourpre",             file: "pourpre-compiled.json" },
    { slug: "vulbis",              file: "vulbis-compiled.json" },
    { slug: "tacheté",             file: "tachete-compiled.json" },
    { slug: "argenté",             file: "argent-compiled.json" },
    { slug: "dom-de-pin",          file: "dom-de-pin-compiled.json" },
    { slug: "des-glaces",          file: "glace-compiled.json" },
    { slug: "domakuro",            file: "domakuro-compiled.json" },
    { slug: "dorigami",            file: "dorigami-compiled.json" },
    { slug: "du-cauchemar",        file: "cauchemar-compiled.json" },
    { slug: "abyssal",             file: "abyssal-compiled.json" },
    { slug: "nebuleux",            file: "nebuleux-compiled.json" },
    { slug: "forgelave",           file: "forgelave-compiled.json" },
    { slug: "cacao",               file: "cacao-compiled.json" },
    { slug: "dokoko",              file: "dokoko-compiled.json" },
    { slug: "veilleur",            file: "veilleurs-compiled.json" },
    { slug: "argente-scintillant", file: "argent-scint-compiled.json" },
    { slug: "sylvestre",           file: "sylvestre-compiled.json" },
    { slug: "cawotte",             file: "cawotte-compiled.json" },
    { slug: "dolmanax",            file: "dolmanax-compiled.json" },
    { slug: "dokille",             file: "dokille-compiled.json" },
];

async function main() {
    console.log("🌱 Seed V3 — Compiled JSON → Database\n");
    let totalChains = 0, totalEntries = 0, skipped = 0;

    for (const { slug, file } of CHAIN_FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.log(`  ⏭  SKIP (no file): ${slug}`);
            skipped++;
            continue;
        }

        const item = await db.dofusItem.findFirst({ where: { slug } });
        if (!item) {
            console.log(`  ⏭  SKIP (no DofusItem): ${slug}`);
            skipped++;
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const chainCount = (data.chains ?? []).length;
        const entryCount = (data.chains ?? []).flatMap((c: any) => c.entries ?? []).length;

        // Delete existing chains for full replacement
        await db.dofusQuestChain.deleteMany({ where: { dofusId: item.id } });

        for (const section of data.chains ?? []) {
            const chain = await db.dofusQuestChain.create({
                data: {
                    dofusId: item.id,
                    sectionType: section.sectionType ?? "MAIN_CHAIN",
                    sectionName: section.sectionName,
                    description: section.description ?? null,
                    chainOrder: section.chainOrder ?? 0,
                },
            });
            totalChains++;

            for (const entry of section.entries ?? []) {
                await (db as any).dofusQuestEntry.create({
                    data: {
                        chainId: chain.id,
                        name: entry.name,
                        zone: entry.zone ?? null,
                        questType: "QUEST",
                        stepOrder: entry.stepOrder ?? 0,
                        isOptional: false,
                        isLast: entry.isLast ?? false,
                        isDungeon: entry.isDungeon ?? false,
                        dofusdbId: entry.dofusdbId ?? null,
                        npcName: entry.npcName ?? null,
                        npcSubArea: entry.npcSubArea ?? null,
                        requirements: entry.requirements ?? null,
                        itemsRequired: entry.itemsRequired ?? null,
                        dungeonsRequired: entry.dungeonsRequired ?? null,
                        objectives: entry.objectives ?? null,
                        coords: entry.coords ?? null,
                        level: entry.level ?? null,
                        isSynergyCandidate: entry.isSynergyCandidate ?? false,
                        weight: 1,
                    },
                });
                totalEntries++;
            }
        }

        console.log(`  ✅ ${slug.padEnd(25)} → ${chainCount} sections, ${entryCount} quêtes`);
    }

    console.log(`\n${"═".repeat(50)}`);
    console.log(`✨ Seed terminé !`);
    console.log(`   ${totalChains} sections | ${totalEntries} quêtes | ${skipped} skipped`);
    console.log("═".repeat(50));
}

main()
    .catch(e => { console.error("💥", e); process.exit(1); })
    .finally(() => db.$disconnect());

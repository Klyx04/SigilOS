/**
 * ============================================================
 * DOFUS QUEST SEEDER V2 — Generic Multi-Dofus
 * ============================================================
 * Usage:
 *   npx tsx scripts/seed-argent-tree.ts --dofus argent
 *   npx tsx scripts/seed-argent-tree.ts --dofus ebene
 *
 * Reads:  prisma/seed-data/dofus-quests/<slug>-compiled.json
 * Writes: DB via Prisma (DofusItem + DofusQuestChain + DofusQuestEntry)
 * ============================================================
 */

import "dotenv/config";
import { db } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

// ─── CLI args ───────────────────────────────────────────────
const args = process.argv.slice(2);
const dofusSlug = args.find(a => a.startsWith("--dofus="))?.split("=")[1]
    ?? args[args.indexOf("--dofus") + 1]
    ?? "argent";

const compiledPath = path.join(process.cwd(), `prisma/seed-data/dofus-quests/${dofusSlug}-compiled.json`);
if (!fs.existsSync(compiledPath)) {
    console.error(`❌ Compiled JSON not found: ${compiledPath}`);
    console.error(`   Run first: npx tsx scripts/dofus-compiler.ts --dofus ${dofusSlug}`);
    process.exit(1);
}

const configPath = path.join(process.cwd(), `scripts/dofus-configs/${dofusSlug}.json`);
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf-8")) : {};

// ─── Layout engine ──────────────────────────────────────────
// Group chains by zone for 2D canvas placement
const INCARNAM_ZONES = ["incarnam"];
const COL_GAP_X = 240;
const ROW_GAP_Y  = 130;

function computeLayout(chains: any[]) {
    const incarnam = chains.filter(c => INCARNAM_ZONES.includes(c.zone ?? "incarnam") || !c.zone);
    const others   = chains.filter(c => !INCARNAM_ZONES.includes(c.zone ?? "incarnam") && c.zone);

    const positions: Map<number, { baseX: number; baseY: number }> = new Map();

    incarnam.forEach((c, i) => {
        positions.set(c.chainOrder, { baseX: 80 + i * COL_GAP_X, baseY: 100 });
    });

    others.forEach((c, i) => {
        positions.set(c.chainOrder, { baseX: 80 + i * COL_GAP_X, baseY: 1100 });
    });

    return positions;
}

// ─── Main ───────────────────────────────────────────────────
async function seedDofus() {
    const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  SEEDING — ${compiled.displayName ?? dofusSlug.toUpperCase()}`);
    console.log(`${"═".repeat(60)}\n`);

    try {
        // 1. Upsert DofusItem
        const imageUrl = compiled.imageUrl ? compiled.imageUrl : (compiled.iconId ? `https://api.dofusdb.fr/img/items/${compiled.iconId}.png` : (compiled.dofusItemId ? `https://api.dofusdb.fr/img/items/${compiled.dofusItemId}.png` : `https://api.dofusdb.fr/img/items/${dofus_slug_to_icon(dofusSlug)}.png`));
        const name = compiled.displayName ?? dofus_slug_to_name(dofusSlug);
        const nameShort = dofus_slug_to_short(dofusSlug);
        const color = compiled.color ?? "#aaaaaa";
        const description = compiled.successDescription ?? null;

        const dofus = await (db as any).dofusItem.upsert({
            where: { slug: dofusSlug },
            update: {
                name,
                nameShort,
                imageUrl,
                color,
                description,
                successName: compiled.successName ?? null,
                levelRecommended: compiled.recommendedLevel ?? 20,
            },
            create: {
                slug: dofusSlug,
                name,
                nameShort,
                rarity: "MAJEUR",
                isPrimordial: false,
                levelRecommended: compiled.recommendedLevel ?? 20,
                color,
                imageUrl,
                successName: compiled.successName ?? null,
                description,
            },
        });
        console.log(`✅ DofusItem synced: ${dofus.name} (id: ${dofus.id})\n`);

        // 2. Purge existing chains
        const deleted = await db.dofusQuestChain.deleteMany({ where: { dofusId: dofus.id } });
        console.log(`🗑  Purged ${deleted.count} existing chains.\n`);

        // 3. Compute 2D layout
        const layout = computeLayout(compiled.chains);

        // 4. Seed chains + entries
        for (const chainData of compiled.chains) {
            if (chainData.sectionType === "PREREQUISITE") {
                console.log(`⏩ Skipping prerequisite chain: ${chainData.sectionName}`);
                continue;
            }

            const pos = layout.get(chainData.chainOrder) ?? { baseX: 80, baseY: 100 };

            const chain = await db.dofusQuestChain.create({
                data: {
                    dofusId: dofus.id,
                    sectionType: chainData.sectionType ?? "MAIN_CHAIN",
                    sectionName: chainData.sectionName,
                    description: chainData.description ?? null,
                    chainOrder:  chainData.chainOrder,
                },
            });

            console.log(`📦 ${chainData.sectionName} [${chainData.zone ?? "?"}]`);

            let currentY = pos.baseY;

            for (let i = 0; i < chainData.entries.length; i++) {
                const entry = chainData.entries[i];
                const xJitter = (i % 2 === 0) ? -15 : 15;

                // Normalize name: can be a string OR { name: "...", id: N } when the config had pre-defined IDs
                const entryName: string = typeof entry.name === "string"
                    ? entry.name
                    : (entry.name as any)?.name ?? String(entry.name);

                // Build a stable ID: slug-dofusdbId or slug-name
                const stableId = entry.dofusdbId
                    ? `${dofusSlug}-${entry.dofusdbId}`
                    : `${dofusSlug}-${entryName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

                await db.dofusQuestEntry.create({
                    data: {
                        id: stableId,
                        name: entryName,
                        chainId: chain.id,
                        dofusdbId: entry.dofusdbId ?? null,
                        stepOrder: entry.stepOrder,

                        // Canvas position
                        posX: pos.baseX + xJitter,
                        posY: currentY,

                        // Enriched data
                        level:        entry.level ?? null,
                        npcName:      entry.npcName ?? null,
                        zone:         entry.zone ?? chainData.zone ?? null,
                        npcSubArea:   entry.npcSubArea ?? null,
                        coords:       entry.coords ?? null,
                        isDungeon:    entry.isDungeon ?? false,
                        itemsRequired: entry.itemsRequired ?? null,
                        dungeonsRequired: entry.dungeonsRequired ?? null,
                        objectives:    entry.objectives ?? null,
                        requirements: (entry.requirements ?? []).map((r: any) => ({
                            ...r,
                            id: r.dofusdbId ?? r.id,
                        })),

                        questType: entry.isDungeon ? "DUNGEON" : "QUEST",
                        isOptional: entry.isOptional ?? false,
                        isLast: false,
                        isSynergyCandidate: entry.isSynergyCandidate ?? false,
                    },
                });

                const flags = [
                    entry.isDungeon ? "🏰" : "",
                    entry.coords ? `📍[${entry.coords.x},${entry.coords.y}]` : "",
                    (entry.itemsRequired?.length ?? 0) > 0 ? `📦×${entry.itemsRequired.length}` : "",
                    entry.level != null ? `Lvl${entry.level}` : "",
                ].filter(Boolean).join(" ");

                console.log(`  ✓ ${entryName} ${flags}`);
                currentY += ROW_GAP_Y;
            }

            console.log();
        }

        const total = compiled.chains.reduce((n: number, c: any) => n + c.entries.length, 0);
        console.log(`${"═".repeat(60)}`);
        console.log(`🎉 Seeding complete — ${compiled.chains.length} succès / ${total} quêtes`);
        console.log(`${"═".repeat(60)}\n`);

    } catch (err: any) {
        console.error("\n💥 SEEDING FAILED:");
        console.error(err.message ?? err);
        console.error(err.stack ?? "");
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
}

// ─── Helpers ────────────────────────────────────────────────
function dofus_slug_to_name(slug: string): string {
    const map: Record<string, string> = {
        argent: "Dofus Argenté",
        ebene: "Dofus Ébène",
        pourpre: "Dofus Pourpre",
        ivoire: "Dofus Ivoire",
        ocre: "Dofus Ocre",
        emeraude: "Dofus Émeraude",
        turquoise: "Dofus Turquoise",
        vulbis: "Dofus Vulbis",
        crimson: "Dofus Crimson",
        dokoko: "Dokoko",
    };
    return map[slug] ?? `Dofus ${slug.charAt(0).toUpperCase() + slug.slice(1)}`;
}

function dofus_slug_to_short(slug: string): string {
    const map: Record<string, string> = {
        argent: "Argenté",
        ebene: "Ébène",
        pourpre: "Pourpre",
        ivoire: "Ivoire",
        ocre: "Ocre",
        emeraude: "Émeraude",
        turquoise: "Turquoise",
        vulbis: "Vulbis",
    };
    return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

function dofus_slug_to_icon(slug: string): string {
    // DofusDB item IDs for the Dofus gems
    const map: Record<string, string> = {
        argent: "19000",
        ebene: "18997",
        pourpre: "18998",
        ivoire: "18999",
        ocre: "7841",
        emeraude: "18993",
        turquoise: "18994",
        vulbis: "11557",
    };
    return map[slug] ?? "19000";
}

seedDofus();

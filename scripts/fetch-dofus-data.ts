import fs from "fs";
import path from "path";
import axios from "axios";

const ITEMS_PATH = path.join(process.cwd(), "prisma/seed-data/dofus-quests/dofus-items.json");

async function run() {
    console.log("Reading dofus-items.json...");
    const rawData = fs.readFileSync(ITEMS_PATH, "utf-8");
    const items = JSON.parse(rawData);

    let updated = 0;

    for (const item of items) {
        if (!item.dofusDbItemId) {
            console.log(`Skipping ${item.name} (no ID)`);
            continue;
        }

        try {
            console.log(`Fetching DofusDB data for ID ${item.dofusDbItemId}...`);
            const res = await axios.get(`https://api.dofusdb.fr/items/${item.dofusDbItemId}`);
            const dbData = res.data;

            // 1. Vraie image
            if (dbData.iconId) {
                const newImg = `https://api.dofusdb.fr/img/items/${dbData.iconId}.png`;
                if (item.imageUrl !== newImg) {
                    console.log(`  [IMAGE] Updated: ${item.imageUrl} -> ${newImg}`);
                    item.imageUrl = newImg;
                    updated++;
                }
            } else {
                console.log(`  [WARNING] No iconId for ${item.name}`);
            }

            // 2. Vraie description 100% Ankama
            if (dbData.description && dbData.description.fr) {
                if (item.description !== dbData.description.fr) {
                    console.log(`  [DESC] Updated pour ${item.name}`);
                    item.description = dbData.description.fr;
                    updated++;
                }
            } else {
                console.log(`  [WARNING] No description for ${item.name}`);
            }

            // Clean slug accents and mismatched letters to prevent duplication
            const newSlug = item.slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (item.slug !== newSlug) {
                console.log(`  [SLUG] Cleaned: ${item.slug} -> ${newSlug}`);
                item.slug = newSlug;
                updated++;
            }

        } catch (e: any) {
            console.error(`  [ERROR] Failed to fetch data for ${item.name} (ID: ${item.dofusDbItemId}): ${e.message}`);
        }

        // Delay to respect API
        await new Promise(r => setTimeout(r, 200));
    }

    if (updated > 0) {
        // Enforce cleanup on specific slugs based on the user screenshot
        for (const item of items) {
             if (item.nameShort === "Tacheté") item.slug = "tachete";
             if (item.nameShort === "Argenté") item.slug = "argente";
             if (item.nameShort === "Argent") item.slug = "argente"; // In case older version persists
        }
        
        fs.writeFileSync(ITEMS_PATH, JSON.stringify(items, null, 2), "utf-8");
        console.log(`\nSuccess: Saved ${updated} changes to dofus-items.json!`);
    } else {
        console.log("\nNo changes needed.");
    }
}

run().catch(console.error);

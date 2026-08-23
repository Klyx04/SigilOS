/**
 * ============================================================
 * DOFUS ASSET SIPHONER
 * ============================================================
 * Purpose: Downloads DofusDB images (items, npcs) to local storage
 * to avoid external dependencies and improve performance.
 * 
 * Usage: npx tsx scripts/dofus-asset-siphoner.ts
 * ============================================================
 */

import * as fs from "fs";
import * as path from "path";
import { finished } from "stream/promises";

const SEED_DATA_DIR = path.join(process.cwd(), "prisma/seed-data/dofus-quests");
const ASSETS_BASE = path.join(process.cwd(), "public/assets/dofus");

// ─── Setup directories ───────────────────────────────────────────────────────
if (!fs.existsSync(ASSETS_BASE)) fs.mkdirSync(ASSETS_BASE, { recursive: true });
const dirs = ["items", "npcs", "dungeons"];
dirs.forEach(d => {
    const p = path.join(ASSETS_BASE, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

async function downloadImage(url: string, dest: string) {
    if (fs.existsSync(dest)) return; // Skip if already exists
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fileStream = fs.createWriteStream(dest);
        await finished(Readable.fromWeb(res.body as any).pipe(fileStream));
        console.log(`  ✅ Downloaded: ${path.basename(dest)}`);
    } catch (e: any) {
        console.error(`  ❌ Failed to download ${url}: ${e.message}`);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
import { Readable } from "stream";

async function run() {
    console.log("🚀 Dofus Asset Siphoner — Starting...");

    // 1. Find all compiled JSONs
    const files = fs.readdirSync(SEED_DATA_DIR).filter(f => f.endsWith("-compiled.json"));
    if (files.length === 0) {
        console.error("❌ No compiled quets found in prisma/seed-data/dofus-quests/");
        return;
    }

    const itemsToDownload = new Map<number, string>(); // id -> url
    const npcsToDownload  = new Map<number, string>(); // id -> url

    // 2. Scan for URLs
    for (const file of files) {
        console.log(`🔍 Scanning ${file}...`);
        const data = JSON.parse(fs.readFileSync(path.join(SEED_DATA_DIR, file), "utf-8"));
        
        for (const chain of data.chains || []) {
            for (const entry of chain.entries || []) {
                // NPCs (from our new V3 compiler)
                if (entry.npcId && entry.npcImg) {
                    npcsToDownload.set(entry.npcId, entry.npcImg);
                }
                
                // Items
                for (const item of entry.itemsRequired || []) {
                    if (item.id && item.img) {
                        itemsToDownload.set(item.id, item.img);
                    }
                }
            }
        }
    }

    console.log(`📦 Found ${itemsToDownload.size} items and ${npcsToDownload.size} NPCs to SIPHON.\n`);

    // 3. Download Items
    let count = 0;
    for (const [id, url] of itemsToDownload.entries()) {
        const ext = url.split(".").pop() || "png";
        const dest = path.join(ASSETS_BASE, "items", `${id}.${ext}`);
        await downloadImage(url, dest);
        if (++count % 5 === 0) await new Promise(r => setTimeout(r, 100)); // Rate limit
    }

    // 4. Download NPCs
    count = 0;
    for (const [id, url] of npcsToDownload.entries()) {
        const ext = url.split(".").pop() || "png";
        const dest = path.join(ASSETS_BASE, "npcs", `${id}.${ext}`);
        await downloadImage(url, dest);
        if (++count % 5 === 0) await new Promise(r => setTimeout(r, 100));
    }

    console.log("\n✨ Asset Siphoning complete!");
}

run().catch(console.error);

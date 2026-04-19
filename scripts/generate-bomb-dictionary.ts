/**
 * ============================================================
 * SIGIL-BOMB DICTIONARY GENERATOR
 * ============================================================
 * Extracts words from Dofus maps, items, monsters, and quests
 * to build the ultimate Lore-sensitive database for Sigil-Bomb.
 * 
 * Usage: npx tsx scripts/generate-bomb-dictionary.ts
 * ============================================================
 */

import * as fs from "fs";
import * as path from "path";

const WORLDMAP_PATH = path.join(process.cwd(), "public/game-data/worldmap.json");
const MONSTERS_PATH = path.join(process.cwd(), "public/game-data/monsters");
const QUESTS_DIR = path.join(process.cwd(), "prisma/seed-data/dofus-quests");
const OUTPUT_PATH = path.join(process.cwd(), "public/game-data/bomb-dictionary.json");

const words = new Set<string>();

// 1. Static Core Words (Classes, terms, etc.)
const staticWords = [
    "Iop", "Cra", "Ecaflip", "Eniripsa", "Enutrof", "Feca", "Sacrieur", "Sadida", 
    "Sram", "Xelor", "Osamodas", "Pandawa", "Roublard", "Zobal", "Steamer", 
    "Eliotrope", "Huppermage", "Ouginak", "Forgelance", "Kama", "Dofus", "Goultard",
    "Amakna", "Bonta", "Brakmar", "Sufokia", "Pandala", "Frigost", "Otomaï"
];

staticWords.forEach(w => words.add(w.trim().toUpperCase()));

// 2. Extract from World Map (Subareas & Dungeons)
if (fs.existsSync(WORLDMAP_PATH)) {
    console.log("🔍 Extracting from WorldMap...");
    const data = JSON.parse(fs.readFileSync(WORLDMAP_PATH, "utf-8"));
    
    (data.subareas || []).forEach((s: any) => {
        if (s.name) s.name.split(/[\s'-/]+/).forEach((w: string) => {
            if (w.length >= 3) words.add(w.toUpperCase());
        });
        // Also add full names if valid (no spaces)
        if (s.name && !s.name.includes(" ") && s.name.length >= 3) words.add(s.name.toUpperCase());
    });
    
    (data.dungeons || []).forEach((d: any) => {
        if (d.name) d.name.split(/[\s'-/]+/).forEach((w: string) => {
            if (w.length >= 3) words.add(w.toUpperCase());
        });
    });
}

// 3. Extract from Monster Image names
if (fs.existsSync(MONSTERS_PATH)) {
    console.log("🔍 Extracting from Monsters...");
    const files = fs.readdirSync(MONSTERS_PATH).filter(f => f.endsWith(".webp"));
    files.forEach(f => {
        const name = f.replace(".webp", "");
        name.split(/[\s'-/]+/).forEach((w: string) => {
            if (w.length >= 3) words.add(w.toUpperCase());
        });
    });
}

// 4. Extract from Compiled Quests
if (fs.existsSync(QUESTS_DIR)) {
    console.log("🔍 Extracting from Quests...");
    const files = fs.readdirSync(QUESTS_DIR).filter(f => f.endsWith("-compiled.json"));
    files.forEach(file => {
        const data = JSON.parse(fs.readFileSync(path.join(QUESTS_DIR, file), "utf-8"));
        
        // NPC names
        (data.chains || []).forEach((chain: any) => {
            (chain.entries || []).forEach((entry: any) => {
                if (entry.npcName) {
                    entry.npcName.split(/[\s'-/]+/).forEach((w: string) => {
                        if (w.length >= 3) words.add(w.toUpperCase());
                    });
                }
                if (entry.name) {
                    entry.name.split(/[\s'-/]+/).forEach((w: string) => {
                        if (w.length >= 3) words.add(w.toUpperCase());
                    });
                }
                // Item names from requirements
                (entry.itemsRequired || []).forEach((item: any) => {
                    if (item.name) {
                        item.name.split(/[\s'-/]+/).forEach((w: string) => {
                            if (w.length >= 3) words.add(w.toUpperCase());
                        });
                    }
                });
            });
        });
    });
}

// Filter out common small words that aren't lore-specific or too generic
const stopWords = new Set(["LES", "DES", "AUX", "SUR", "DANS", "PAR", "POUR", "AVEC", "SOUS", "VERS"]);
const finalWords = Array.from(words)
    .filter(w => !stopWords.has(w))
    .filter(w => /^[A-ZÉÀÈÎÏÔÛÙÇ-]+$/.test(w)) // Only letters and hyphens
    .sort();

const output = {
    updatedAt: new Date().toISOString(),
    count: finalWords.length,
    words: finalWords
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(`✅ Dictionary generated: ${finalWords.length} words saved to ${OUTPUT_PATH}!`);

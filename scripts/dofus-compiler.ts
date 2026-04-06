/**
 * ============================================================
 * DOFUS QUEST COMPILER V2 — Generic Multi-Dofus Enricher
 * ============================================================
 * Usage:
 *   npx tsx scripts/dofus-compiler.ts --dofus argent
 *   npx tsx scripts/dofus-compiler.ts --dofus ebene
 *
 * Data sources:
 *   - DofusDB API (api.dofusdb.fr) → IDs, levels, coords, items, dungeons
 *   - Objective texts → real NPC/item references
 *
 * 2-pass approach:
 *   Pass 1 — Fetch all quests, collect raw item IDs
 *   Pass 2 — Batch resolve item names, build final enriched output
 * ============================================================
 */

import * as fs from "fs";
import * as path from "path";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dofusArg = args.find(a => a.startsWith("--dofus="))?.split("=")[1]
    ?? args[args.indexOf("--dofus") + 1]
    ?? "argent";

const configPath = path.join(process.cwd(), `scripts/dofus-configs/${dofusArg}.json`);
if (!fs.existsSync(configPath)) {
    console.error(`❌ Config not found: ${configPath}`);
    console.error(`   Create scripts/dofus-configs/${dofusArg}.json first.`);
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
console.log(`🚀 Compiler V2 — ${config.displayName} (${config.slug})`);

// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE = "https://api.dofusdb.fr";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function apiFetch(path_: string, params: Record<string, string> = {}): Promise<any> {
    const p = new URLSearchParams({ lang: "fr", ...params });
    const url = `${API_BASE}/${path_}?${p}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
}

// ─── Cache systems ──────────────────────────────────────────────────────────
const itemCache = new Map<number, { name: string; img: string | null; level: number | null }>();
const npcCache  = new Map<number, { name: string; img: string | null; subarea?: string }>();
const dungeonCache = new Map<number, { name: string; bossIds?: number[] }>();

async function resolveNpcById(id: number): Promise<{ name: string; img: string | null; subarea?: string }> {
    if (npcCache.has(id)) return npcCache.get(id)!;
    try {
        await sleep(100);
        const d = await apiFetch(`npcs/${id}`);
        const result = {
            name: d.name?.fr ?? `PNJ #${id}`,
            img: d.img ?? null,
            subarea: d.subArea?.name?.fr ?? null,
        };
        npcCache.set(id, result);
        return result;
    } catch {
        const fallback = { name: `PNJ #${id}`, img: null };
        npcCache.set(id, fallback);
        return fallback;
    }
}

async function resolveNpcsBatch(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)].filter(id => id > 0 && !npcCache.has(id));
    if (unique.length === 0) return;
    console.log(`\n👥 Résolution de ${unique.length} PNJ uniques...`);
    for (let i = 0; i < unique.length; i += 50) {
        const chunk = unique.slice(i, i + 50);
        try {
            const params = new URLSearchParams({ lang: "fr", "$limit": "50" });
            chunk.forEach(id => params.append("id[$in][]", id.toString()));
            const url = `${API_BASE}/npcs?${params}`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            for (const npc of (json.data ?? [])) {
                npcCache.set(npc.id, {
                    name: npc.name?.fr ?? `PNJ #${npc.id}`,
                    img: npc.img ?? null,
                    subarea: npc.subArea?.name?.fr ?? null,
                });
            }
            await sleep(300);
        } catch (e: any) {
            for (const id of chunk) await resolveNpcById(id);
        }
    }
    console.log(`  ✅ ${npcCache.size} PNJ en cache`);
}

async function resolveItemById(id: number): Promise<{ name: string; img: string | null; level: number | null }> {
    if (itemCache.has(id)) return itemCache.get(id)!;
    try {
        await sleep(100);
        const d = await apiFetch(`items/${id}`);
        const result = {
            name: d.name?.fr ?? `Item #${id}`,
            img: d.img ?? null,
            level: d.level ?? null,
        };
        itemCache.set(id, result);
        return result;
    } catch {
        const fallback = { name: `Item #${id}`, img: null, level: null };
        itemCache.set(id, fallback);
        return fallback;
    }
}

/** Batch resolve many item IDs (with rate limiting) */
async function resolveItemsBatch(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)].filter(id => !itemCache.has(id));
    if (unique.length === 0) return;

    console.log(`\n📚 Résolution de ${unique.length} items uniques...`);

    // DofusDB supports batch fetch: /items?id[$in][]=1&id[$in][]=2...
    // Max ~50 per request to be safe
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));

    for (const chunk of chunks) {
        try {
            // Build params: id[$in][]=1&id[$in][]=2...
            const params = new URLSearchParams({ lang: "fr", "$limit": "50" });
            chunk.forEach(id => params.append("id[$in][]", id.toString()));
            const url = `${API_BASE}/items?${params}`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const items: any[] = json.data ?? [];

            for (const item of items) {
                itemCache.set(item.id, {
                    name: item.name?.fr ?? `Item #${item.id}`,
                    img: item.img ?? null,
                    level: item.level ?? null,
                });
            }
            await sleep(300);
        } catch (e: any) {
            console.warn(`  ⚠ Batch fetch failed, falling back individually: ${e.message}`);
            // Fallback: fetch individually
            for (const id of chunk) {
                await resolveItemById(id);
            }
        }
    }

    console.log(`  ✅ ${itemCache.size} items en cache`);
}

async function resolveDungeonsBatch(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)].filter(id => id > 0 && !dungeonCache.has(id));
    if (unique.length === 0) return;
    console.log(`\n🏰 Résolution de ${unique.length} donjons uniques...`);
    for (let i = 0; i < unique.length; i += 20) {
        const chunk = unique.slice(i, i + 20);
        try {
            const params = new URLSearchParams({ lang: "fr", "$limit": "20" });
            chunk.forEach(id => params.append("id[$in][]", id.toString()));
            const url = `${API_BASE}/dungeons?${params}`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            for (const dj of (json.data ?? [])) {
                dungeonCache.set(dj.id, {
                    name: dj.name?.fr ?? `Donjon #${dj.id}`,
                    bossIds: dj.bossIds ?? []
                });
            }
            await sleep(300);
        } catch (e: any) {
            console.warn(`  ⚠ Batch fetch failed for dungeons: ${e.message}`);
        }
    }
    console.log(`  ✅ ${dungeonCache.size} donjons en cache`);
}

/** Parse objective text for {{item,ID::Name}} patterns */
function findIdsInText(text: string, type: "item" | "npc" | "monster"): number[] {
    const regex = new RegExp(`{{${type},(\\d+)(::.*?)?}}`, "g");
    const ids: number[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        ids.push(parseInt(match[1]));
    }
    return ids;
}

/** Collect raw item IDs from all objective needs and text patterns */
function collectItemIds(quest: any): number[] {
    const ids: number[] = [];
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            // From generated field
            for (const item of obj.need?.generated?.items ?? []) {
                const id = typeof item === "object" ? item.id : item;
                if (typeof id === "number") ids.push(id);
            }
            // From text regex
            if (obj.text?.fr) {
                ids.push(...findIdsInText(obj.text.fr, "item"));
            }
        }
    }
    return ids;
}

/** Build enriched items list with resolved names and quantities from text parsing */
function extractItems(quest: any): Array<{ id: number; name: string; amount: number; img: string | null }> {
    const seenMap = new Map<number, number>(); // id -> total amount

    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            // From generated
            const genItems: any[] = obj.need?.generated?.items ?? [];
            const genQty: number[] = obj.need?.generated?.quantities ?? [];
            genItems.forEach((rawItem: any, idx: number) => {
                const id = typeof rawItem === "object" ? rawItem.id : rawItem;
                const amount = genQty[idx] ?? 1;
                seenMap.set(id, (seenMap.get(id) || 0) + amount);
            });

            // From text: extract amount if possible "x10 [Item]" or "10x [Item]"
            if (obj.text?.fr) {
                const text = obj.text.fr;
                const regex = /{{item,(\d+)::\[(.*?)\]}}/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const id = parseInt(match[1]);
                    // Try to find quantity prefix in text like "x3 {{item...}}"
                    const prefix = text.substring(0, match.index).trim();
                    const qtyMatch = prefix.match(/x\s*(\d+)\s*$/i) || prefix.match(/(\d+)\s*x\s*$/i);
                    const amount = qtyMatch ? parseInt(qtyMatch[1]) : 1;
                    
                    if (!obj.need?.generated?.items?.some((i: any) => (typeof i === "object" ? i.id : i) === id)) {
                        seenMap.set(id, (seenMap.get(id) || 0) + (amount || 1));
                    }
                }
            }
        }
    }

    const results: Array<{ id: number; name: string; amount: number; img: string | null }> = [];
    for (const [id, amount] of seenMap.entries()) {
        const cached = itemCache.get(id);
        results.push({
            id,
            name: cached?.name ?? `Item #${id}`,
            amount,
            img: cached?.img ?? null,
        });
    }
    return results;
}

/** Extract dungeon names from the quest */
function extractDungeons(quest: any): Array<{ id: number; name: string; bossId?: number }> {
    const results: Array<{ id: number; name: string; bossId?: number }> = [];
    const seen = new Set<number>();

    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            for (const djId of obj.need?.generated?.dungeons ?? []) {
                if (seen.has(djId)) continue;
                seen.add(djId);
                const cached = dungeonCache.get(djId);
                results.push({ 
                    id: djId, 
                    name: cached?.name ?? "Donjon", 
                    bossId: cached?.bossIds?.[0] 
                });
            }
        }
    }
    return results;
}

/** Extract all objective texts */
function extractObjectives(quest: any): string[] {
    const texts: string[] = [];
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.text?.fr && !texts.includes(obj.text.fr)) {
                texts.push(obj.text.fr);
            }
        }
    }
    return texts;
}

/** Detect dungeon requirement */
function detectDungeon(quest: any): boolean {
    if (quest.isDungeonQuest === true) return true;
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if ((obj.need?.generated?.dungeons ?? []).length > 0) return true;
        }
    }
    return false;
}

/** Extract first objective map coords + worldId */
function extractCoords(quest: any, success: any): { x: number; y: number; worldId: number } | null {
    let worldId = 1;
    const zoneName = success.zone?.toLowerCase() || "";
    if (zoneName === "incarnam") {
        worldId = 2;
    }

    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.map?.posX != null && obj.map?.posY != null) {
                const mapWorld = obj.map.worldMap;
                // If map has a valid world (not -1/interior), use it. Else fallback to success zone default.
                const finalWorld = (mapWorld != null && mapWorld > 0) ? mapWorld : worldId;
                return { x: obj.map.posX, y: obj.map.posY, worldId: finalWorld };
            }
            if (obj.coords?.posX != null) {
                const coordWorld = obj.coords.worldMap;
                const finalWorld = (coordWorld != null && coordWorld > 0) ? coordWorld : worldId;
                return { x: obj.coords.posX, y: obj.coords.posY, worldId: finalWorld };
            }
        }
    }
    return null;
}

/** Extract zone/subarea name from first map */
function extractZone(quest: any): string | null {
    if (quest.subArea?.name?.fr) return quest.subArea.name.fr;
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.map?.name?.fr) return obj.map.name.fr;
            if (obj.map?.subArea?.name?.fr) return obj.map.subArea.name.fr;
        }
    }
    return null;
}

/** Extract NPC ID from quest start or first step */
function extractNpcId(quest: any): number | null {
    if (quest.npcId) return quest.npcId;
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.npcId) return obj.npcId;
        }
    }
    return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
    // PASS 1 — Fetch all quest data
    console.log("\n📡 PASS 1 — Extraction des quêtes depuis DofusDB\n");

    const passOneData: Array<{
        success: any;
        questResults: Array<{ name: string; quest: any | null }>;
    }> = [];

    const allItemIds: number[] = [];
    const allNpcIds: number[] = [];
    const allDungeonIds: number[] = [];

    for (const success of config.successes) {
        console.log(`📦 Succès : "${success.name}" [${success.zone ?? "?"}]`);
        const questResults: Array<{ name: string; quest: any | null }> = [];

        for (let questEntry of success.quests) {
            let questName = typeof questEntry === "string" ? questEntry : questEntry.name;
            let manualId  = typeof questEntry === "object" ? (questEntry.id || questEntry.dofusdbId) : null;

            process.stdout.write(`  🔍 ${questName}${manualId ? ` (ID:${manualId})` : ""} ... `);
            await sleep(300);

            try {
                let quest: any = null;

                if (manualId) {
                    const detail = await apiFetch(`quests/${manualId}`);
                    quest = Array.isArray(detail) ? (detail[0] ?? null) : (detail ?? null);
                } else {
                    const searchRes = await apiFetch("quests", { "name.fr": questName, "$limit": "5" });
                    const searchData: any[] = searchRes.data ?? searchRes;
                    quest = searchData.find((q: any) => q.name?.fr === questName) ?? searchData[0] ?? null;

                    if (quest) {
                        await sleep(150);
                        const detail = await apiFetch(`quests/${quest.id}`);
                        quest = Array.isArray(detail) ? (detail[0] ?? quest) : (detail ?? quest);
                    }
                }

                if (!quest) {
                    console.log("⚠️  NOT FOUND");
                    questResults.push({ name: questName, quest: null });
                    continue;
                }

                const questItemIds = collectItemIds(quest);
                allItemIds.push(...questItemIds);
                const nid = extractNpcId(quest);
                if (nid) allNpcIds.push(nid);
                
                for (const step of quest.steps ?? []) {
                    for (const obj of step.objectives ?? []) {
                        allDungeonIds.push(...(obj.need?.generated?.dungeons ?? []));
                    }
                }

                const coords = extractCoords(quest, success);
                const isDungeon = detectDungeon(quest);
                const flags = [
                    isDungeon ? "🏰" : "",
                    coords ? `📍[${coords.x},${coords.y}]` : "",
                    questItemIds.length > 0 ? `📦×${questItemIds.length}` : "",
                    quest.levelMin != null ? `Lvl${quest.levelMin}` : "",
                ].filter(Boolean).join(" ");

                console.log(`✅ (ID:${quest.id}) ${flags}`);
                questResults.push({ name: questName, quest });

            } catch (e: any) {
                console.log(`❌ ${e.message}`);
                questResults.push({ name: questName, quest: null });
            }
        }

        passOneData.push({ success, questResults });
    }

    // PASS 2 — Batch resolve all item, NPC & Dungeon names
    await resolveItemsBatch(allItemIds);
    await resolveNpcsBatch(allNpcIds);
    await resolveDungeonsBatch(allDungeonIds);

    // PASS 3 — Assemble final enriched output
    console.log("\n🔨 PASS 3 — Assemblage des données enrichies\n");

    const output: any = {
        dofus: config.slug,
        displayName: config.displayName,
        color: config.color,
        successName: config.successName ?? null,
        recommendedLevel: config.recommendedLevel ?? null,
        description: config.successDescription ?? null,
        dofusItemId: config.dofusItemId ?? null,
        iconId: config.iconId ?? null,
        imageUrl: config.imageUrl ?? null,
        compiledAt: new Date().toISOString(),
        chains: [],
    };

    let globalOrder = 0;

    for (const { success, questResults } of passOneData) {
        const chain: any = {
            sectionName: success.name,
            sectionType: success.isPrerequisite === true || success.name.toLowerCase().includes("prérequis") || success.name.toLowerCase().includes("prerequis") ? "PREREQUISITE" : "MAIN_CHAIN",
            zone: success.zone ?? null,
            description: success.description ?? null,
            isSynergyCandidate: success.isSynergyCandidate ?? false,
            chainOrder: globalOrder++,
            requires: success.requires ?? [],
            entries: [],
        };

        let stepOrder = 0;
        let lastQuestDbId: number | null = null;
        let isFirstQuest = true;

        for (let { name, quest } of questResults) {
            const originalName = typeof name === "string" ? name : (name as any)?.name ?? String(name);
            name = originalName;
            if (!quest) {
                chain.entries.push({
                    name,
                    dofusdbId: null,
                    level: null,
                    zone: null,
                    npcSubArea: null,
                    coords: null,
                    isDungeon: false,
                    itemsRequired: [],
                    objectives: [],
                    stepOrder: stepOrder++,
                    requirements: lastQuestDbId
                        ? [{ type: "QUEST", dofusdbId: lastQuestDbId }]
                        : [],
                });
                isFirstQuest = false;
                continue;
            }

            const items = extractItems(quest);
            const objectives = extractObjectives(quest);
            const dungeonsRequired = extractDungeons(quest);

            // Inject Human Guide Manual Requirements
            if (isFirstQuest && success.globalItemsRequired) {
                const resolvedGlobals = success.globalItemsRequired.map((i: any, idx: number) => {
                    let id = i.id || (-999 - idx);
                    // V3: Try to extract ID from DofusDB image URL if provided
                    if (id < 0 && i.img && i.img.includes("/items/")) {
                        const match = i.img.match(/\/items\/(\d+)\.png/);
                        if (match) id = parseInt(match[1], 10);
                    }
                    return { ...i, id };
                });
                items.push(...resolvedGlobals);
            }
            if (isFirstQuest && success.globalDungeonsRequired) {
                success.globalDungeonsRequired.forEach((dName: string) => objectives.push(`Vaincre : ${dName}`));
            }
            isFirstQuest = false;
            const coords = extractCoords(quest, success);
            const rawZone = extractZone(quest);
            const isDungeon = detectDungeon(quest);
            const npcId = extractNpcId(quest);
            const npc = npcId ? npcCache.get(npcId) : null;

            chain.entries.push({
                name: quest.name?.fr ?? name,
                dofusdbId: quest.id,
                level: quest.levelMin ?? null,
                zone: npc?.subarea ?? rawZone ?? success.zone ?? null,
                npcName: npc?.name ?? null,
                npcSubArea: npc?.subarea ?? rawZone ?? null,
                coords,
                isDungeon,
                itemsRequired: items,
                dungeonsRequired,
                objectives,
                stepOrder: stepOrder++,
                isSynergyCandidate: success.isSynergyCandidate ?? false,
                requirements: lastQuestDbId
                    ? [{ type: "QUEST", dofusdbId: lastQuestDbId }]
                    : [],
            });
            lastQuestDbId = quest.id;
        }

        output.chains.push(chain);
    }

    // Write output
    const outDir = path.join(process.cwd(), "prisma/seed-data/dofus-quests");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${config.slug}-compiled.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

    // Summary
    const allEntries = output.chains.flatMap((c: any) => c.entries);
    const withCoords  = allEntries.filter((e: any) => e.coords).length;
    const withItems   = allEntries.filter((e: any) => e.itemsRequired?.length > 0).length;
    const dungeons    = allEntries.filter((e: any) => e.isDungeon).length;
    const namedItems  = allEntries.flatMap((e: any) => e.itemsRequired ?? [])
        .filter((i: any) => !i.name.startsWith("Item #")).length;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ ${config.displayName} — Compilation V2 terminée`);
    console.log(`   📝 ${output.chains.length} succès / ${allEntries.length} quêtes`);
    console.log(`   📍 ${withCoords} quêtes avec coordonnées`);
    console.log(`   📦 ${withItems} quêtes avec items | ${namedItems} items résolus`);
    console.log(`   🏰 ${dungeons} quêtes donjons`);
    console.log(`   💾 ${outPath}`);
    console.log("═".repeat(60));
}

run().catch(e => {
    console.error("💥 Compiler crash:", e);
    process.exit(1);
});

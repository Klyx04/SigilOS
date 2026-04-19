/**
 * ============================================================
 * DOFUS QUEST COMPILER V3 — Precision Enricher
 * ============================================================
 * Improvements over V2:
 *   - Extracts items from BOTH quest-level need AND step objectives
 *   - Resolves dungeon names from DofusDB dungeon IDs
 *   - Adds DofusDB CDN image URLs for all items
 *   - Produces a globalSummary with aggregated resources + dungeons
 *   - Supports --all to compile every dofus in dofus-configs/
 *   - Better duplicate handling and quantity merging
 *
 * Usage:
 *   npx tsx scripts/dofus-compiler-v3.ts --dofus turquoise
 *   npx tsx scripts/dofus-compiler-v3.ts --all
 * ============================================================
 */

import * as fs from "fs";
import * as path from "path";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const compileAll = args.includes("--all");
const dofusArg = args.find(a => a.startsWith("--dofus="))?.split("=")[1]
    ?? args[args.indexOf("--dofus") + 1]
    ?? (compileAll ? null : "turquoise");

// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE = "https://api.dofusdb.fr";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const MAX_RETRIES = 3;

async function apiFetch(path_: string, params: Record<string, string> = {}): Promise<any> {
    const p = new URLSearchParams({ lang: "fr", ...params });
    const url = `${API_BASE}/${path_}?${p}`;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(url, { 
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(15000),
            });
            if (res.status === 429) {
                const wait = Math.min(attempt * 2000, 10000);
                console.warn(`  ⏳ Rate limited, waiting ${wait}ms...`);
                await sleep(wait);
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
            return res.json();
        } catch (e: any) {
            if (attempt === MAX_RETRIES) throw e;
            await sleep(1000 * attempt);
        }
    }
}

// ─── Cache systems ──────────────────────────────────────────────────────────
interface CachedItem {
    name: string;
    img: string | null;
    level: number | null;
    typeId: number | null;
    typeName: string | null;
}
interface CachedNpc {
    name: string;
    img: string | null;
    subarea?: string;
}
interface CachedDungeon {
    name: string;
    level: number | null;
    img: string | null;
    bossName: string | null;
}

const itemCache = new Map<number, CachedItem>();
const npcCache = new Map<number, CachedNpc>();
const dungeonCache = new Map<number, CachedDungeon>();

// ─── Batch resolvers ─────────────────────────────────────────────────────────

async function resolveItemsBatch(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)].filter(id => id > 0 && !itemCache.has(id));
    if (unique.length === 0) return;
    console.log(`\n📚 Résolution de ${unique.length} items uniques...`);

    for (let i = 0; i < unique.length; i += 50) {
        const chunk = unique.slice(i, i + 50);
        try {
            const params = new URLSearchParams({ lang: "fr", "$limit": "50" });
            chunk.forEach(id => params.append("id[$in][]", id.toString()));
            const url = `${API_BASE}/items?${params}`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            for (const item of (json.data ?? [])) {
                itemCache.set(item.id, {
                    name: item.name?.fr ?? `Item #${item.id}`,
                    img: item.img ?? (item.iconId ? `https://static.dofusdb.fr/items/${item.iconId}.png` : null),
                    level: item.level ?? null,
                    typeId: item.typeId ?? null,
                    typeName: item.type?.name?.fr ?? null,
                });
            }
            // Fill missing from chunk
            for (const id of chunk) {
                if (!itemCache.has(id)) {
                    itemCache.set(id, { name: `Item #${id}`, img: null, level: null, typeId: null, typeName: null });
                }
            }
            await sleep(300);
        } catch (e: any) {
            console.warn(`  ⚠ Batch fetch failed: ${e.message}, resolving individually...`);
            for (const id of chunk) {
                if (itemCache.has(id)) continue;
                try {
                    await sleep(150);
                    const d = await apiFetch(`items/${id}`);
                    itemCache.set(id, {
                        name: d.name?.fr ?? `Item #${id}`,
                        img: d.img ?? (d.iconId ? `https://static.dofusdb.fr/items/${d.iconId}.png` : null),
                        level: d.level ?? null,
                        typeId: d.typeId ?? null,
                        typeName: d.type?.name?.fr ?? null,
                    });
                } catch {
                    itemCache.set(id, { name: `Item #${id}`, img: null, level: null, typeId: null, typeName: null });
                }
            }
        }
    }
    console.log(`  ✅ ${itemCache.size} items en cache`);
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
                    subarea: npc.subArea?.name?.fr ?? undefined,
                });
            }
            await sleep(300);
        } catch {
            for (const id of chunk) {
                if (!npcCache.has(id)) {
                    npcCache.set(id, { name: `PNJ #${id}`, img: null });
                }
            }
        }
    }
    console.log(`  ✅ ${npcCache.size} PNJ en cache`);
}

async function resolveDungeonsBatch(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)].filter(id => id > 0 && !dungeonCache.has(id));
    if (unique.length === 0) return;
    console.log(`\n🏰 Résolution de ${unique.length} donjons uniques...`);

    for (const id of unique) {
        try {
            await sleep(150);
            const d = await apiFetch(`dungeons/${id}`);
            // Find boss (usually last monster in the list)
            let boss = d.monsters?.slice(-1)[0];
            if (boss && typeof boss === "number") {
                try {
                    boss = await apiFetch(`monsters/${boss}`);
                } catch { /* skip */ }
            }
            
            const bossImg = boss?.img || (boss?.iconId ? `https://api.dofusdb.fr/img/monsters/${boss.iconId}.png` : null);
            
            dungeonCache.set(id, {
                name: d.name?.fr ?? `Donjon #${id}`,
                level: d.optimalLevel ?? null,
                img: bossImg,
                bossName: boss?.name?.fr ?? null,
            });
        } catch {
            dungeonCache.set(id, { name: `Donjon #${id}`, level: null, img: null, bossName: null });
        }
    }
    console.log(`  ✅ ${dungeonCache.size} donjons en cache`);
}

// ─── Data extractors ─────────────────────────────────────────────────────────

/** Collect ALL item IDs from quest (both quest-level and step-level) */
function collectAllItemIds(quest: any): number[] {
    const ids: number[] = [];
    // Quest-level need
    for (const itemId of quest.need?.items ?? []) {
        if (typeof itemId === "number" && itemId > 0) ids.push(itemId);
    }
    // Step-level objectives
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            // Structured data
            for (const raw of obj.need?.generated?.items ?? []) {
                const id = typeof raw === "object" ? raw.id : raw;
                if (typeof id === "number" && id > 0) ids.push(id);
            }
            // Parse text tokens as fallback/complement
            const text = obj.text?.fr || "";
            const regex = /\{item,(\d+)\}/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                ids.push(parseInt(match[1], 10));
            }
        }
    }
    return [...new Set(ids)];
}

/** Collect ALL dungeon IDs from quest objectives */
function collectDungeonIds(quest: any): number[] {
    const ids: number[] = [];
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            for (const dId of obj.need?.generated?.dungeons ?? []) {
                if (typeof dId === "number" && dId > 0) ids.push(dId);
            }
        }
    }
    return ids;
}

/** Collect all NPC IDs */
function collectNpcIds(quest: any): number[] {
    const ids: number[] = [];
    if (quest.npcId) ids.push(quest.npcId);
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            // NPC from objective parameters
            if (obj.parameters?.parameter0 && obj.className?.includes("Npc")) {
                ids.push(obj.parameters.parameter0);
            }
            if (obj.npcId) ids.push(obj.npcId);
        }
    }
    return ids;
}

/** Build enriched items list merging quest-level + step-level with dedup */
function extractItems(quest: any): Array<{ id: number; name: string; amount: number; img: string | null }> {
    const merged = new Map<number, { id: number; name: string; amount: number; img: string | null }>();

    // Helper to add/update item in map
    const addItem = (id: number, amount: number) => {
        if (typeof id !== "number" || id <= 0) return;
        const cached = itemCache.get(id);
        const existing = merged.get(id);
        merged.set(id, {
            id,
            name: cached?.name ?? `Item #${id}`,
            amount: existing ? existing.amount + amount : amount,
            img: cached?.img ?? null,
        });
    };

    // Quest-level items
    const questItems = quest.need?.items ?? [];
    const questQty = quest.need?.quantities ?? [];
    questItems.forEach((rawId: any, idx: number) => {
        const id = typeof rawId === "object" ? rawId.id ?? rawId : rawId;
        addItem(id, questQty[idx] ?? 1);
    });

    // Step-level objectives
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            // 1. Structured data
            const genItems: any[] = obj.need?.generated?.items ?? [];
            const genQty: number[] = obj.need?.generated?.quantities ?? [];
            genItems.forEach((rawItem: any, idx: number) => {
                const id = typeof rawItem === "object" ? rawItem.id : rawItem;
                addItem(id, genQty[idx] ?? 1);
            });

            // 2. Text parsing as fallback for counts
            const text = obj.text?.fr || "";
            // Regex for: "10 {item,123}" or "Avoir 5 de {item,123}"
            const regex = /(?:(\d+)\s*(?:[xX]\s*|de\s*)?)?\{item,\s*(\d+)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const amount = match[1] ? parseInt(match[1], 10) : 1;
                const id = parseInt(match[2], 10);
                // Only add if NOT already in merged, OR if we want to BE aggressive.
                // For now, let's just make sure it's there.
                if (!merged.has(id)) addItem(id, amount);
            }
        }
    }

    return [...merged.values()];
}

/** Extract dungeon info from quest objectives */
function extractDungeons(quest: any, config: any): Array<{ id: number; name: string; level: number | null; bossName: string | null; img: string | null; idoleName?: string | null }> {
    const seen = new Set<number>();
    const results: Array<{ id: number; name: string; level: number | null; bossName: string | null; img: string | null; idoleName?: string | null }> = [];

    const configDungeons = (config.successes || []).flatMap((s: any) => s.dungeons || []);

    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            for (const dId of obj.need?.generated?.dungeons ?? []) {
                if (typeof dId !== "number" || dId <= 0 || seen.has(dId)) continue;
                seen.add(dId);
                const cached = dungeonCache.get(dId);
                const dName = cached?.name ?? `Donjon #${dId}`;
                
                // Match with config to get idoleName
                const cfgDun = configDungeons.find((cd: any) => cd.name === dName);

                results.push({
                    id: dId,
                    name: dName,
                    level: cached?.level ?? null,
                    bossName: cached?.bossName ?? null,
                    img: cached?.img ?? null, // Boss portrait
                    idoleName: cfgDun?.idoleName ?? null,
                });
            }
        }
    }

    // Also detect dungeons from objective text patterns
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            const text = obj.text?.fr ?? "";
            if (/donjon|dungeon|vaincre.*boss/i.test(text) && results.length === 0) {
                // Mark quest as dungeon-related even without explicit dungeon ID
            }
        }
    }

    return results;
}

/** Extract objective texts */
function extractObjectives(quest: any): string[] {
    const texts: string[] = [];
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            const text = obj.text?.fr;
            if (text && !texts.includes(text)) {
                // Replace {npc,ID} and {item,ID} tokens with resolved names
                const resolved = text
                    .replace(/\{npc,(\d+)\}/g, (_: string, id: string) => {
                        const npc = npcCache.get(parseInt(id));
                        return npc?.name ?? `PNJ #${id}`;
                    })
                    .replace(/\{item,(\d+)\}/g, (_: string, id: string) => {
                        const item = itemCache.get(parseInt(id));
                        return item?.name ?? `Item #${id}`;
                    });
                texts.push(resolved);
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

/** Extract coords */
function extractCoords(quest: any, success: any): { x: number; y: number; worldId: number } | null {
    let worldId = 1;
    const zoneName = success.zone?.toLowerCase() || "";
    if (zoneName === "incarnam") worldId = 2;

    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.map?.posX != null && obj.map?.posY != null) {
                const mapWorld = obj.map.worldMap;
                return { x: obj.map.posX, y: obj.map.posY, worldId: (mapWorld != null && mapWorld > 0) ? mapWorld : worldId };
            }
            if (obj.coords?.posX != null) {
                const coordWorld = obj.coords.worldMap;
                return { x: obj.coords.posX, y: obj.coords.posY, worldId: (coordWorld != null && coordWorld > 0) ? coordWorld : worldId };
            }
        }
    }
    return null;
}

/** Extract zone/subarea */
function extractZone(quest: any): string | null {
    if (quest.subArea?.name?.fr) return quest.subArea.name.fr;
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.map?.subArea?.name?.fr) return obj.map.subArea.name.fr;
            if (obj.map?.name?.fr) return obj.map.name.fr;
        }
    }
    return null;
}

/** Extract NPC info */
function extractNpcId(quest: any): number | null {
    if (quest.npcId) return quest.npcId;
    for (const step of quest.steps ?? []) {
        for (const obj of step.objectives ?? []) {
            if (obj.npcId) return obj.npcId;
            if (obj.parameters?.parameter0 && obj.className?.includes("Npc")) {
                return obj.parameters.parameter0;
            }
        }
    }
    return null;
}

// ─── Single Dofus compiler ───────────────────────────────────────────────────

async function compileDofus(slug: string): Promise<void> {
    const configPath = path.join(process.cwd(), `scripts/dofus-configs/${slug}.json`);
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config not found: ${configPath}`);
        return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🚀 Compiler V3 — ${config.displayName} (${slug})`);
    console.log("═".repeat(60));

    // ── PASS 1: Fetch all quests, collect IDs ──
    console.log("\n📡 PASS 1 — Extraction des quêtes depuis DofusDB\n");

    const passOneData: Array<{
        success: any;
        questResults: Array<{ name: string; quest: any | null; manualCfg: any }>;
    }> = [];

    const allItemIds: number[] = [];
    const allNpcIds: number[] = [];
    const allDungeonIds: number[] = [];

    for (const success of config.successes) {
        if (success.globalItemsRequired) {
            allItemIds.push(...success.globalItemsRequired.map((m: any) => m.id).filter((id: any) => !!id));
        }
        if (success.dungeons) {
            allDungeonIds.push(...success.dungeons.map((d: any) => d.id).filter((id: any) => !!id));
        }
        if (config.globalItemsRequired) {
             allItemIds.push(...config.globalItemsRequired.map((m: any) => m.id).filter((id: any) => !!id));
        }
        console.log(`📦 Succès : "${success.name}" [${success.zone ?? "?"}]`);
        const questResults: Array<{ name: string; quest: any | null; manualCfg: any }> = [];

        for (const questCfg of success.quests) {
            const questName = typeof questCfg === "string" ? questCfg : questCfg.name;
            const questId = typeof questCfg === "object" ? questCfg.id : null;
            
            process.stdout.write(`  🔍 ${questName}${questId ? ` (ID:${questId})` : ""} ... `);
            await sleep(250);

            try {
                let quest: any = null;
                if (questId) {
                    const detail = await apiFetch(`quests/${questId}`);
                    quest = Array.isArray(detail) ? (detail[0] ?? null) : (detail ?? null);
                }

                if (!quest) {
                    // Try exact match first
                    let searchRes = await apiFetch("quests", { "name.fr": questName, "$limit": "5" });
                    let searchData: any[] = (searchRes.data ?? searchRes) || [];
                    let exact = searchData.find((q: any) => q.name?.fr === questName);

                    // If not found, try a broader search but without $search or regex which fail on DofusDB
                    if (!exact) {
                        // Just search by a fragment and filter manually
                        const query = questName.split(" ").sort((a: string, b: string) => b.length - a.length)[0];
                        const broadRes = await apiFetch("quests", { "name.fr": query, "$limit": "100" });
                        const broadData = (broadRes.data ?? broadRes) || [];
                        exact = broadData.find((q: any) => q.name?.fr?.toLowerCase() === questName.toLowerCase())
                             ?? broadData.find((q: any) => q.name?.fr?.toLowerCase().includes(questName.toLowerCase()))
                             ?? broadData[0];
                    }

                    if (!exact) {
                        console.log("⚠️  NOT FOUND");
                        questResults.push({ name: questName, quest: null, manualCfg: typeof questCfg === "object" ? questCfg : {} });
                        continue;
                    }
                    
                    const detail = await apiFetch(`quests/${exact.id}`);
                    quest = Array.isArray(detail) ? (detail[0] ?? exact) : (detail ?? exact);
                }

                // Collect ALL IDs for batch resolution
                allItemIds.push(...collectAllItemIds(quest));
                allNpcIds.push(...collectNpcIds(quest));
                allDungeonIds.push(...collectDungeonIds(quest));

                const isDungeon = detectDungeon(quest);
                const itemCount = collectAllItemIds(quest).length;
                const dungeonCount = collectDungeonIds(quest).length;
                const flags = [
                    isDungeon ? "🏰" : "",
                    dungeonCount > 0 ? `🏰×${dungeonCount}` : "",
                    itemCount > 0 ? `📦×${itemCount}` : "",
                    quest.levelMin != null ? `Lvl${quest.levelMin}` : "",
                ].filter(Boolean).join(" ");

                console.log(`✅ (ID:${quest.id}) ${flags}`);
                questResults.push({ name: questName, quest, manualCfg: typeof questCfg === "object" ? questCfg : {} });
            } catch (e: any) {
                console.log(`❌ ${e.message}`);
                questResults.push({ name: questName, quest: null, manualCfg: typeof questCfg === "object" ? questCfg : {} });
            }
        }

        // Also collect IDs from manual globalItemsRequired
        if (success.globalItemsRequired) {
            for (const item of success.globalItemsRequired) {
                if (item.id && item.id > 0) allItemIds.push(item.id);
                // Extract ID from DofusDB image URL
                if (item.img) {
                    const match = item.img.match(/\/items\/(\d+)\.png/);
                    if (match) allItemIds.push(parseInt(match[1], 10));
                }
            }
        }

        passOneData.push({ success, questResults });
    }

    // Add manual dungeons from configs to resolution
    for (const { success, questResults } of passOneData) {
        for (const qr of questResults) {
            if (qr.manualCfg.dungeons) {
                allDungeonIds.push(...qr.manualCfg.dungeons.map((d: any) => d.id));
            }
        }
    }

    console.log("\n📡 PASS 2 — Résolution batch des entités");
    await resolveItemsBatch(allItemIds);
    await resolveNpcsBatch(allNpcIds);
    await resolveDungeonsBatch(allDungeonIds);

    // Patch manual dungeon cache
    for (const { success, questResults } of passOneData) {
        for (const qr of questResults) {
            if (qr.manualCfg.dungeons) {
                for (const man of qr.manualCfg.dungeons) {
                    if (man.bossId) {
                        try {
                            const boss = await apiFetch(`monsters/${man.bossId}`);
                            dungeonCache.set(man.id, {
                                name: man.name ?? dungeonCache.get(man.id)?.name ?? `Donjon #${man.id}`,
                                level: dungeonCache.get(man.id)?.level ?? null,
                                img: boss?.img ?? `https://api.dofusdb.fr/img/monsters/${man.bossId}.png`,
                                bossName: boss?.name?.fr ?? man.name ?? "Boss Manuel",
                            });
                        } catch { /* skip */ }
                    }
                }
            }
        }
    }

    // ── PASS 3: Assemble enriched output ──
    console.log("\n🔨 PASS 3 — Assemblage des données enrichies\n");

    // Global resource aggregation
    const globalItems = new Map<number, { id: number; name: string; totalAmount: number; img: string | null }>();
    const globalDungeons = new Map<number, { id: number; name: string; level: number | null; bossName: string | null }>();

    const output: any = {
        dofus: slug,
        displayName: config.displayName,
        color: config.color,
        successName: config.successName ?? null,
        recommendedLevel: config.recommendedLevel ?? null,
        description: config.successDescription ?? null,
        dofusItemId: config.dofusItemId ?? null,
        iconId: config.iconId ?? null,
        imageUrl: config.imageUrl ?? null,
        compiledAt: new Date().toISOString(),
        compilerVersion: "3.0",
        chains: [],
        globalSummary: {
            totalQuests: 0,
            totalItems: 0,
            totalDungeons: 0,
            items: [] as any[],
            dungeons: [] as any[],
        },
    };

    let globalOrder = 0;

    for (const { success, questResults } of passOneData) {
        const chain: any = {
            sectionName: success.name,
            sectionType: success.isPrerequisite === true
                || success.name.toLowerCase().includes("prérequis")
                || success.name.toLowerCase().includes("prerequis")
                ? "PREREQUISITE" : "MAIN_CHAIN",
            zone: success.zone ?? null,
            description: success.description ?? null,
            isSynergyCandidate: success.isSynergyCandidate ?? false,
            chainOrder: globalOrder++,
            requires: success.requires ?? [],
            dungeons: success.dungeons ?? [],
            entries: [],
        };

        let stepOrder = 0;
        let lastQuestDbId: number | null = null;
        let isFirstQuest = true;

        for (const { name, quest, manualCfg } of questResults) {
            if (!quest) {
                chain.entries.push({
                    name,
                    dofusdbId: null,
                    level: null,
                    zone: null,
                    npcName: null,
                    npcSubArea: null,
                    coords: null,
                    isDungeon: false,
                    itemsRequired: [],
                    dungeonsRequired: [],
                    objectives: [],
                    stepOrder: stepOrder++,
                    requirements: lastQuestDbId ? [{ type: "QUEST", dofusdbId: lastQuestDbId }] : [],
                });
                isFirstQuest = false;
                if (manualCfg.externalRef) {
                    chain.entries[chain.entries.length - 1].externalRef = manualCfg.externalRef;
                }
                if (manualCfg.dungeons) {
                    chain.entries[chain.entries.length - 1].dungeonsRequired = manualCfg.dungeons.map((man: any) => {
                        const cached = dungeonCache.get(man.id);
                        return {
                            id: man.id,
                            name: man.name ?? cached?.name ?? `Donjon #${man.id}`,
                            level: cached?.level ?? null,
                            bossName: cached?.bossName ?? null,
                            img: cached?.img ?? null,
                            idoleName: man.idole ?? null,
                        };
                    });
                }
                continue;
            }

            let items = extractItems(quest);
            let dungeons = extractDungeons(quest, config);
            let objectives = extractObjectives(quest);

            // Inject manual globalItemsRequired on first quest
            const manualItems = [
                ...(isFirstQuest && success.globalItemsRequired ? success.globalItemsRequired : []),
                ...(isFirstQuest && (globalOrder === 1) && config.globalItemsRequired ? config.globalItemsRequired : [])
            ];

            for (const manual of manualItems) {
                let id = manual.id || 0;
                if (id <= 0 && manual.img) {
                    const match = manual.img.match(/\/items\/(\d+)\.png/);
                    if (match) id = parseInt(match[1], 10);
                }
                if (id <= 0) id = -(999 + items.length);
                
                // Only add if not already in items
                if (!items.find(i => i.id === id)) {
                    const cached = itemCache.get(id);
                    items.push({
                        id,
                        name: cached?.name ?? manual.name ?? `Item #${id}`,
                        amount: manual.amount ?? 1,
                        img: cached?.img ?? manual.img ?? null,
                    });
                }
            }
            if (isFirstQuest && success.globalDungeonsRequired) {
                for (const dName of success.globalDungeonsRequired) {
                    objectives.push(`Vaincre : ${dName}`);
                }
            }
            isFirstQuest = false;

            // Aggregate global resources
            for (const item of items) {
                const existing = globalItems.get(item.id);
                if (existing) {
                    existing.totalAmount += item.amount;
                } else {
                    globalItems.set(item.id, {
                        id: item.id,
                        name: item.name,
                        totalAmount: item.amount,
                        img: item.img,
                    });
                }
            }
            for (const dun of dungeons) {
                if (!globalDungeons.has(dun.id)) {
                    globalDungeons.set(dun.id, dun);
                }
            }

            const coords = extractCoords(quest, success);
            const rawZone = extractZone(quest);
            const isDungeon = detectDungeon(quest);
            const npcId = extractNpcId(quest);
            const npc = npcId ? npcCache.get(npcId) : null;

            // Manual dungeons override
            if (manualCfg.dungeons) {
                dungeons = manualCfg.dungeons.map((man: any) => {
                    const cached = dungeonCache.get(man.id);
                    return {
                        id: man.id,
                        name: man.name ?? cached?.name ?? `Donjon #${man.id}`,
                        level: cached?.level ?? null,
                        bossName: cached?.bossName ?? null,
                        img: cached?.img ?? null,
                        idoleName: man.idole ?? null,
                    };
                });
            }

            chain.entries.push({
                name: quest.name?.fr ?? name,
                dofusdbId: quest.id,
                level: quest.levelMin ?? null,
                zone: npc?.subarea ?? rawZone ?? success.zone ?? null,
                npcName: manualCfg.npcName ?? npc?.name ?? null,
                npcSubArea: npc?.subarea ?? rawZone ?? null,
                coords: manualCfg.coords ?? coords,
                isDungeon,
                itemsRequired: items,
                dungeonsRequired: dungeons,
                externalRef: manualCfg.externalRef ?? null,
                objectives,
                stepOrder: stepOrder++,
                isSynergyCandidate: success.isSynergyCandidate ?? false,
                requirements: lastQuestDbId
                    ? [{ type: "QUEST", dofusdbId: lastQuestDbId }]
                    : [],
                notes: manualCfg.notes ?? null,
            });
            lastQuestDbId = quest.id;
        }

        output.chains.push(chain);
    }

    // Build global summary
    output.globalSummary = {
        totalQuests: output.chains.flatMap((c: any) => c.entries).length,
        totalItems: globalItems.size,
        totalDungeons: globalDungeons.size,
        items: [...globalItems.values()].sort((a, b) => b.totalAmount - a.totalAmount),
        dungeons: [...globalDungeons.values()],
    };

    // Write output
    const outDir = path.join(process.cwd(), "prisma/seed-data/dofus-quests");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${slug}-compiled.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

    // Summary
    const allEntries = output.chains.flatMap((c: any) => c.entries);
    const withCoords = allEntries.filter((e: any) => e.coords).length;
    const withItems = allEntries.filter((e: any) => e.itemsRequired?.length > 0).length;
    const withDungeons = allEntries.filter((e: any) => e.dungeonsRequired?.length > 0).length;
    const namedItems = [...globalItems.values()].filter(i => !i.name.startsWith("Item #")).length;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ ${config.displayName} — Compilation V3 terminée`);
    console.log(`   📝 ${output.chains.length} succès / ${allEntries.length} quêtes`);
    console.log(`   📍 ${withCoords} quêtes avec coordonnées`);
    console.log(`   📦 ${withItems} quêtes avec items | ${namedItems}/${globalItems.size} items résolus`);
    console.log(`   🏰 ${withDungeons} quêtes avec donjons | ${globalDungeons.size} donjons totaux`);
    console.log(`   🎯 Résumé global: ${globalItems.size} ressources, ${globalDungeons.size} donjons`);
    console.log(`   💾 ${outPath}`);
    console.log("═".repeat(60));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    if (compileAll) {
        const configDir = path.join(process.cwd(), "scripts/dofus-configs");
        const files = fs.readdirSync(configDir).filter(f => f.endsWith(".json"));
        console.log(`🚀 Compilation de ${files.length} Dofus...\n`);
        
        for (const file of files) {
            const slug = file.replace(".json", "");
            try {
                await compileDofus(slug);
            } catch (e: any) {
                console.error(`💥 Échec pour ${slug}: ${e.message}`);
            }
        }
        
        console.log(`\n${"═".repeat(60)}`);
        console.log(`🏁 Compilation batch terminée: ${files.length} Dofus traités`);
        console.log("═".repeat(60));
    } else if (dofusArg) {
        await compileDofus(dofusArg);
    } else {
        console.error("Usage: npx tsx scripts/dofus-compiler-v3.ts --dofus <slug> | --all");
        process.exit(1);
    }
}

main().catch(e => {
    console.error("💥 Compiler crash:", e);
    process.exit(1);
});

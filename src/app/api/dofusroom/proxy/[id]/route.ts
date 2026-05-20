import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { auth } from "@/auth";

const CACHE_TTL_SECONDS = 3600;

// Map DofusRoom class names (value from <select>) to class IDs
const CLASS_NAME_MAP: Record<string, number> = {
    "feca": 1, "féca": 1,
    "osamodas": 2, "osa": 2,
    "enutrof": 3, "enu": 3,
    "sram": 4,
    "xelor": 5, "xélor": 5,
    "ecaflip": 6, "écaflip": 6, "eca": 6,
    "eniripsa": 7, "éniripsa": 7, "eni": 7,
    "iop": 8,
    "cra": 9, "crâ": 9,
    "sadida": 10, "sadi": 10,
    "sacrieur": 11, "sacri": 11,
    "pandawa": 12,
    "roublard": 13, "roub": 13,
    "zobal": 14,
    "steamer": 15,
    "eliotrope": 16, "éliotrope": 16, "elio": 16,
    "huppermage": 17, "hupper": 17,
    "ouginak": 18,
    "forgelance": 19,
};

export type DofusroomSet = {
    name: string;
    level: number;
    items: string[];
    bonus: Array<Record<string, { is: number; statLabel: string; fullname: string }>>;
};

export type DofusroomBuildData = {
    id: number;
    name: string;
    level: number;
    classId: number;
    className: string;
    source: "dofusroom";
    baseStats: {
        vitalite: number;
        sagesse: number;
        force: number;
        intelligence: number;
        chance: number;
        agilite: number;
    };
    smithmagic: Record<string, unknown>;
    itemSlots: Record<string, string | Record<string, string>>;
    items: Record<string, { id?: string; name: string; image: string; stats?: Record<string, unknown> }>;
    sets: Record<string, DofusroomSet>;
    buildUrl: string;
    calculatedStats: {
        vit: number;
        pa: number;
        pm: number;
        po: number;
        pp: number;
        cc: number;
        invo: number;
        so: number;
        sagesse: number;
        initiative: number;
    };
    calculatedElements: {
        force: number;
        intelligence: number;
        chance: number;
        agilite: number;
        puissance: number;
    };
    calculatedResists: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
    };
    calculatedDamages: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
        general: number;
        critique: number;
        poussee: number;
        melee: number;
        distance: number;
        armes: number;
        sorts: number;
    };
};

async function fetchItemDetails(itemId: string | number) {
    try {
        const res = await fetch("https://www.dofusroom.com/encyclopedia/item/getAjax", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "X-Requested-With": "XMLHttpRequest",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                "Cookie": "lang=fr; locale=fr;"
            },
            body: JSON.stringify({ itemId: parseInt(itemId.toString()), datasOnly: true }),
            next: { revalidate: 86400 } // Cache items for 24 hours
        });

        if (res.ok) {
            const json = await res.json();
            if (json.status === "success" && json.data?.item) {
                return {
                    name: json.data.item.name || "Équipement",
                    image: json.data.item.image?.toString() || "",
                    stats: json.data.item.stats || {},
                };
            }
        }
    } catch (e) {
        console.error(`[DofusRoom proxy] Failed to fetch item ${itemId}:`, e);
    }
    return null;
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
        return NextResponse.json({ error: "Invalid build ID" }, { status: 400 });
    }

    const showUrl = `https://www.dofusroom.com/buildroom/build/show/${id}`;

    try {
        // ── Step 1: Fetch the HTML page for name and class ─────────────────────
        const htmlRes = await fetch(showUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                "Cookie": "lang=fr; locale=fr;"
            },
            next: { revalidate: CACHE_TTL_SECONDS },
        });

        if (!htmlRes.ok) {
            return NextResponse.json({ error: `DofusRoom responded ${htmlRes.status}` }, { status: 502 });
        }

        const html = await htmlRes.text();
        const $ = cheerio.load(html);

        // Extract build name from og:title (format: "Build Name - Buildroom")
        const ogTitle = $("meta[property='og:title']").attr("content") || "";
        const buildName = ogTitle.replace(/\s*-\s*Buildroom\s*$/i, "").trim() || `Build #${id}`;

        // Extract class from the character selection dropdown
        const selectedClassOption = $("#character-selection option[selected]");
        const classValue = selectedClassOption.attr("value")?.toLowerCase().trim() || "";
        const classId = CLASS_NAME_MAP[classValue] || 0;
        const className = selectedClassOption.text().trim() || "";

        // ── Step 2: Call the internal DofusRoom AJAX API ───────────────────────
        const apiRes = await fetch("https://www.dofusroom.com/buildroom/build/getByIdAjax", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
                "Referer": showUrl,
                "X-Requested-With": "XMLHttpRequest",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                "Cookie": "lang=fr; locale=fr;"
            },
            body: JSON.stringify({ buildId: parseInt(id) }),
            next: { revalidate: CACHE_TTL_SECONDS },
        });

        if (!apiRes.ok) {
            return NextResponse.json({ error: `DofusRoom API responded ${apiRes.status}` }, { status: 502 });
        }

        const apiData = await apiRes.json() as {
            status: string;
            data?: {
                build?: {
                    items?: Record<string, string | Record<string, string>>;
                    sets?: Record<string, {
                        name: string;
                        level: number;
                        items: string[];
                        bonus: Array<Record<string, { is: number; statLabel: string; fullname: string }>>;
                    }>;
                    stats?: {
                        vitalite?: { inputs: number; parcho: number };
                        sagesse?: { inputs: number; parcho: number };
                        force?: { inputs: number; parcho: number };
                        intelligence?: { inputs: number; parcho: number };
                        chance?: { inputs: number; parcho: number };
                        agilite?: { inputs: number; parcho: number };
                    };
                    smithmagic?: Record<string, unknown>;
                    weaponSmithmagic?: string;
                };
            };
        };

        const build = apiData?.data?.build;

        // ── Step 3: Normalize the response ────────────────────────────────────
        const stats = build?.stats || {};
        const baseStats = {
            vitalite: (stats.vitalite?.inputs || 0) + (stats.vitalite?.parcho || 0),
            sagesse: (stats.sagesse?.inputs || 0) + (stats.sagesse?.parcho || 0),
            force: (stats.force?.inputs || 0) + (stats.force?.parcho || 0),
            intelligence: (stats.intelligence?.inputs || 0) + (stats.intelligence?.parcho || 0),
            chance: (stats.chance?.inputs || 0) + (stats.chance?.parcho || 0),
            agilite: (stats.agilite?.inputs || 0) + (stats.agilite?.parcho || 0),
        };

        // Sets: keep only the active bonus tier (based on the number of equipped items)
        const equippedItemIds = new Set<string>();
        const addEquippedId = (val: any) => {
            if (typeof val === "string" || typeof val === "number") {
                equippedItemIds.add(val.toString());
            } else if (val && typeof val === "object" && "id" in val) {
                equippedItemIds.add(val.id?.toString());
            }
        };
        for (const val of Object.values(build?.items || {})) {
            if (val && typeof val === "object") {
                for (const subVal of Object.values(val)) {
                    addEquippedId(subVal);
                }
            } else {
                addEquippedId(val);
            }
        }

        const sets: Record<string, DofusroomSet> = {};
        for (const [setId, setData] of Object.entries(build?.sets || {})) {
            const equippedInSet = (setData.items || []).filter((itemId: any) =>
                equippedItemIds.has(itemId?.toString())
            );
            const equippedCount = equippedInSet.length;
            const activeBonusIndex = equippedCount - 2;
            const activeBonusTier = setData.bonus && activeBonusIndex >= 0 ? setData.bonus[activeBonusIndex] : null;
            sets[setId] = {
                name: setData.name,
                level: setData.level,
                items: setData.items || [],
                bonus: activeBonusTier ? [activeBonusTier] : [],
            };
        }

        // Fetch each equipped item details in parallel using our slots mapping
        const slotsMapping: Record<string, string | { path: string; key: string }> = {
            coiffe: "hat",
            cape: "cape",
            amulette: "amulet",
            anneau1: { path: "ring", key: "top" },
            anneau2: { path: "ring", key: "bottom" },
            ceinture: "belt",
            bottes: "boots",
            "corps-a-corps": "weapon",
            bouclier: "shield",
            familier: "creature",
            dofus1: { path: "trophus", key: "1" },
            dofus2: { path: "trophus", key: "2" },
            dofus3: { path: "trophus", key: "3" },
            dofus4: { path: "trophus", key: "4" },
            dofus5: { path: "trophus", key: "5" },
            dofus6: { path: "trophus", key: "6" },
        };

        const rawItems = build?.items || {};
        const itemsToFetch: Array<{ slot: string; id: string }> = [];

        const getRawId = (mapping: string | { path: string; key: string }) => {
            if (typeof mapping === "string") {
                const val = rawItems[mapping];
                if (typeof val === "string" || typeof val === "number") return val.toString();
                if (val && typeof val === "object" && "id" in val) return val.id?.toString();
                return null;
            } else {
                const subObj = rawItems[mapping.path];
                if (subObj && typeof subObj === "object") {
                    const val = (subObj as Record<string, string | number>)[mapping.key];
                    return val ? val.toString() : null;
                }
                return null;
            }
        };

        for (const [slot, mapping] of Object.entries(slotsMapping)) {
            const id = getRawId(mapping);
            if (id && id !== "false" && id !== "0" && id !== "null") {
                itemsToFetch.push({ slot, id });
            }
        }

        const fetchedResults: Array<{ slot: string; id: string; details: any } | null> = [];
        for (const { slot, id } of itemsToFetch) {
            const details = await fetchItemDetails(id);
            fetchedResults.push(details ? { slot, id, details } : null);
            // Add a small delay between requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const items: Record<string, { id: string; name: string; image: string; stats?: Record<string, unknown> }> = {};
        for (const res of fetchedResults) {
            if (res) {
                items[res.slot] = { id: res.id, ...res.details };
            }
        }

        // ── Step 4: Calculate Total Stats ─────────────────────────────────────
        let vit = baseStats.vitalite + 50 + 200 * 5; // Base level 200 character has 50 + 200*5 health = 1050 base
        let pa = 7;
        let pm = 3;
        let po = 0;
        let pp = 100;
        let cc = 0; // Base CC set to 0% to match DofusRoom's active calculation
        let invo = 1;
        let so = 0;
        let force = baseStats.force;
        let intelligence = baseStats.intelligence;
        let chance = baseStats.chance;
        let agilite = baseStats.agilite;
        let sagesse = baseStats.sagesse;
        let puissance = 0;

        let resNeutre = 0;
        let resTerre = 0;
        let resFeu = 0;
        let resEau = 0;
        let resAir = 0;

        let dmgNeutre = 0;
        let dmgTerre = 0;
        let dmgFeu = 0;
        let dmgEau = 0;
        let dmgAir = 0;
        let dmgGeneral = 0;
        let dmgCrit = 0;
        let dmgPoussee = 0;

        let dmgMelee = 0;
        let dmgDistance = 0;
        let dmgArmes = 0;
        let dmgSorts = 0;

        let initiative = 0;

        const parseStatValue = (stat: any): number => {
            if (!stat) return 0;
            if (stat.is !== undefined && stat.is !== null) {
                const val = typeof stat.is === "number" ? stat.is : parseInt(stat.is.toString());
                if (!isNaN(val)) return val;
            }
            if (stat.to !== undefined && stat.to !== null) {
                const val = typeof stat.to === "number" ? stat.to : parseInt(stat.to.toString());
                if (!isNaN(val)) return val;
            }
            if (stat.value !== undefined && stat.value !== null) {
                const val = typeof stat.value === "number" ? stat.value : parseInt(stat.value.toString());
                if (!isNaN(val)) return val;
            }
            return 0;
        };

        const addStat = (statKey: string, val: number) => {
            const keyNormalized = statKey.toLowerCase().trim().replace(/-/g, " ");
            if (keyNormalized === "vitalite" || keyNormalized === "vitalite bonus") vit += val;
            else if (keyNormalized === "pa") pa += val;
            else if (keyNormalized === "pm") pm += val;
            else if (keyNormalized === "portee" || keyNormalized === "po") po += val;
            else if (keyNormalized === "prospection") pp += val;
            else if (keyNormalized === "coup critique" || keyNormalized === "cc" || keyNormalized === "% critique" || keyNormalized === "% coup critique") cc += val;
            else if (keyNormalized === "invocations") invo += val;
            else if (keyNormalized === "soins" || keyNormalized === "soin") so += val;
            else if (keyNormalized === "force" || keyNormalized === "force bonus") force += val;
            else if (keyNormalized === "intelligence" || keyNormalized === "intelligence bonus") intelligence += val;
            else if (keyNormalized === "chance" || keyNormalized === "chance bonus") chance += val;
            else if (keyNormalized === "agilite" || keyNormalized === "agilite bonus") agilite += val;
            else if (keyNormalized === "sagesse" || keyNormalized === "sagesse bonus") sagesse += val;
            else if (keyNormalized === "puissance" || keyNormalized === "puissance bonus") puissance += val;
            else if (keyNormalized === "% resistance neutre" || keyNormalized === "percent resistance neutre") resNeutre += val;
            else if (keyNormalized === "% resistance terre" || keyNormalized === "percent resistance terre") resTerre += val;
            else if (keyNormalized === "% resistance feu" || keyNormalized === "percent resistance feu") resFeu += val;
            else if (keyNormalized === "% resistance eau" || keyNormalized === "percent resistance eau") resEau += val;
            else if (keyNormalized === "% resistance air" || keyNormalized === "percent resistance air") resAir += val;
            else if (keyNormalized === "dommages neutre") dmgNeutre += val;
            else if (keyNormalized === "dommages terre") dmgTerre += val;
            else if (keyNormalized === "dommages feu") dmgFeu += val;
            else if (keyNormalized === "dommages eau") dmgEau += val;
            else if (keyNormalized === "dommages air") dmgAir += val;
            else if (keyNormalized === "dommages") dmgGeneral += val;
            else if (keyNormalized === "dommages critiques") dmgCrit += val;
            else if (keyNormalized === "dommages de poussee") dmgPoussee += val;
            else if (keyNormalized === "initiative") initiative += val;
            else if (keyNormalized === "dommages mêlée" || keyNormalized === "dommages melee") dmgMelee += val;
            else if (keyNormalized === "dommages distance") dmgDistance += val;
            else if (keyNormalized === "dommages aux armes" || keyNormalized === "dommages d'armes") dmgArmes += val;
            else if (keyNormalized === "dommages aux sorts" || keyNormalized === "dommages de sorts") dmgSorts += val;
        };

        // 1. Sum up from items
        for (const res of fetchedResults) {
            if (res && res.details && (res.details as any).stats) {
                for (const [statKey, statVal] of Object.entries((res.details as any).stats)) {
                    addStat(statKey, parseStatValue(statVal));
                }
            }
        }

        // 2. Sum up from sets active bonuses
        for (const [_, setData] of Object.entries(sets)) {
            const activeBonusTier = setData?.bonus?.[0];
            if (activeBonusTier) {
                for (const [statKey, statVal] of Object.entries(activeBonusTier)) {
                    addStat(statKey, parseStatValue(statVal));
                }
            }
        }

        // 3. Sum up from smithmagic (exo/over)
        const smithmagic = build?.smithmagic || {};
        for (const [statKey, statVal] of Object.entries(smithmagic)) {
            if (Array.isArray(statVal)) {
                for (const item of statVal) {
                    addStat(statKey, parseStatValue(item));
                }
            } else if (statVal && typeof statVal === "object") {
                for (const [_, item] of Object.entries(statVal as Record<string, unknown>)) {
                    addStat(statKey, parseStatValue(item));
                }
            }
        }

        // 4. Sum up from item-effects
        const itemEffects = (build as any)["item-effects"] || {};
        for (const [itemId, effect] of Object.entries(itemEffects)) {
            if (typeof effect === "number") {
                if (itemId === "3211") cc += effect; // Dofus Turquoise CC
                if (itemId === "3214") puissance += effect; // Dofus Pourpre Puissance
            } else if (effect && typeof effect === "object") {
                const obj = effect as Record<string, number>;
                if (obj["dommages-melee"]) dmgMelee += obj["dommages-melee"];
                if (obj["dommages-distance"]) dmgDistance += obj["dommages-distance"];
                if (obj["dommages-aux-armes"]) dmgArmes += obj["dommages-aux-armes"];
                if (obj["dommages-aux-sorts"]) dmgSorts += obj["dommages-aux-sorts"];
            }
        }

        // Final calculations
        pp += Math.floor(chance / 10);
        initiative += (force + intelligence + chance + agilite);

        const buildData: DofusroomBuildData = {
            id: parseInt(id),
            name: buildName,
            level: 200, // Not available in static HTML; DofusRoom builds are typically 200
            classId,
            className,
            source: "dofusroom",
            baseStats,
            smithmagic: build?.smithmagic || {},
            itemSlots: rawItems,
            items,
            sets,
            buildUrl: showUrl,
            calculatedStats: {
                vit, pa, pm, po, pp, cc, invo, so, sagesse, initiative
            },
            calculatedElements: {
                force, intelligence, chance, agilite, puissance
            },
            calculatedResists: {
                neutre: resNeutre,
                terre: resTerre,
                feu: resFeu,
                eau: resEau,
                air: resAir
            },
            calculatedDamages: {
                neutre: dmgNeutre,
                terre: dmgTerre,
                feu: dmgFeu,
                eau: dmgEau,
                air: dmgAir,
                general: dmgGeneral,
                critique: dmgCrit,
                poussee: dmgPoussee,
                melee: dmgMelee,
                distance: dmgDistance,
                armes: dmgArmes,
                sorts: dmgSorts
            }
        };

        return NextResponse.json(buildData, {
            headers: {
                "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=300`,
            },
        });

    } catch (err) {
        console.error("[DofusRoom proxy] Error:", err);
        return NextResponse.json({ error: "Failed to fetch build data" }, { status: 500 });
    }
}

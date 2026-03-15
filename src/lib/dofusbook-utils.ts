export type DofusbookItem = {
    id: number;
    name: string;
    picture: number;
    official: number;
};

export type DofusbookPreviewData = {
    id: number;
    name: string;
    level: number;
    className: string;
    classId: number;
    stats: {
        pa: number;
        pm: number;
        po: number;
        vit: number;
        // ini removed — unreliable to compute server-side
        // invoc removed — not from items directly
    };
    /** Character real stats = items + capital + scrolls */
    elements: {
        fo: number;   // Force
        in: number;   // Intelligence
        ch: number;   // Chance
        ag: number;   // Agilité
        sa: number;   // Sagesse
    };
    resists: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
    };
    items?: Record<string, DofusbookItem | null>;
    cloths?: {
        name: string;
        count: number;
        total: number;
        clothItems?: DofusbookItem[]; // items belonging to this set (equipped ones)
    }[];
};

export function getClassName(id: number): string {
    const classes: Record<number, string> = {
        1: "Féca", 2: "Osamodas", 3: "Enutrof", 4: "Sram", 5: "Xélor",
        6: "Écaflip", 7: "Éniripsa", 8: "Iop", 9: "Crâ", 10: "Sadida",
        11: "Sacrieur", 12: "Pandawa", 13: "Roublard", 14: "Zobal", 15: "Steamer",
        16: "Éliotrope", 17: "Huppermage", 18: "Ouginak", 19: "Forgelance"
    };
    return classes[id] || "Inconnu";
}

export function processDofusbookRawData(id: string, raw: any): DofusbookPreviewData {
    const level = raw.stuff?.character_level || 200;

    // ⚔️ 1. Base Stats
    let pa = level >= 100 ? 7 : 6;
    let pm = 3;
    let po = 0;
    // Base life: 1050 at level 200 (Dofus 2 formula: 50 + level*5)
    let vit = 50 + (level * 5);
    let resN = 0, resT = 0, resF = 0, resE = 0, resA = 0;

    // Element stats from items only (capital/scroll added later)
    let el_fo = 0, el_in = 0, el_ch = 0, el_ag = 0, el_sa = 0;

    const stuffItemsSlots = raw.stuff?.stuffItem || {};
    const itemsList: any[] = raw.items || [];
    const itemsMap: Record<string, DofusbookItem | null> = {};

    // Sums item effects into our running stats
    const sumEffect = (e: any) => {
        const name = (e.name || "").toLowerCase();
        // Take max of range — Dofusbook displays items at max (fméd) values
        const val = Number(e.max) || Number(e.min) || Number(e.value) || 0;
        if (val === 0) return;

        switch (name) {
            // Action / movement
            case 'pa':  pa  += val; break;
            case 'pm':  pm  += val; break;
            case 'po':  po  += val; break;
            // Life
            case 'vi':
            case 'vit': vit += val; break;
            // Element stats (items contribution — for real-stats panel)
            case 'fo':  el_fo += val; break;
            case 'in':  el_in += val; break;  // 'in' = intelligence, NOT invocations
            case 'ch':  el_ch += val; break;
            case 'ag':  el_ag += val; break;
            case 'sa':  el_sa += val; break;
            // Resistances % (actual Dofusbook API stat names)
            case 'rnp': resN += val; break;  // résistance neutre %
            case 'rtp': resT += val; break;  // résistance terre %
            case 'rfp': resF += val; break;  // résistance feu %
            case 'rep': resE += val; break;  // résistance eau %
            case 'rap': resA += val; break;  // résistance air %
        }
    };

    // 🔍 2. Sum effects from all equipped items
    Object.entries(stuffItemsSlots).forEach(([slot, itemId]) => {
        const item = itemsList.find(i => Number(i.id) === Number(itemId));
        if (item) {
            itemsMap[slot] = {
                id: item.id,
                name: item.name,
                picture: item.picture,
                official: item.official
            };
            const effects = item.effects || item.stats || [];
            if (Array.isArray(effects)) effects.forEach(sumEffect);
        } else {
            itemsMap[slot] = null;
        }
    });

    // 🔗 3. Panoplie Bonuses
    const activeCloths: { name: string; count: number; total: number; clothItems?: DofusbookItem[] }[] = [];
    if (Array.isArray(raw.cloths)) {
        raw.cloths.forEach((cloth: any) => {
            const clothItemIds = new Set((cloth.items || []).map((i: any) => Number(i.id)));
            const equippedCount = Object.values(stuffItemsSlots).filter(
                id => clothItemIds.has(Number(id))
            ).length;

            const total = cloth.count_item || cloth.items?.length || 0;
            const clothName = cloth.name || "Panoplie inconnue";

            if (equippedCount > 1) {
                // Collect the actually-equipped items from this cloth
                const equippedClothItems: DofusbookItem[] = (cloth.items || [])
                    .filter((ci: any) => Object.values(stuffItemsSlots).some(id => Number(id) === Number(ci.id)))
                    .map((ci: any) => itemsList.find((i: any) => Number(i.id) === Number(ci.id)))
                    .filter(Boolean)
                    .map((i: any) => ({ id: i.id, name: i.name, picture: i.picture, official: i.official }));

                activeCloths.push({ name: clothName, count: equippedCount, total, clothItems: equippedClothItems });
            }

            // Apply ALL cumulative bonuses up to equippedCount
            // Dofus pano bonuses are cumulative: 3 pieces = 2-piece bonus + 3-piece bonus
            const bonuses = (cloth.effects || []).filter(
                (e: any) => Number(e.count) <= equippedCount
            );
            bonuses.forEach(sumEffect);
        });
    }

    // 👤 4. Character Capital + Scroll (parchos/capitaux)
    // These are stored in raw.stuffStats or raw.stuff.stuffCarac
    const carac = raw.stuffStats || raw.stuff?.stuffCarac;
    if (carac && !Array.isArray(carac)) {
        const base   = (k: string) => Number(carac[`base_${k}`])   || 0;
        const scroll = (k: string) => Number(carac[`scroll_${k}`]) || 0;

        vit   += base('vi')  + scroll('vi');
        el_fo += base('fo')  + scroll('fo');
        el_in += base('in')  + scroll('in');
        el_ch += base('ch')  + scroll('ch');
        el_ag += base('ag')  + scroll('ag');
        el_sa += base('sa')  + scroll('sa');
    }

    // 🔧 5. Forgemagie — two possible sources:
    //   A. stuffFm.fm  = global FM applied to character stats (shown as "+1 PA" next to stat)
    //   B. stuffFmItem = per-item exo FM (shown in "Exo / Over des items" section)
    //      Structure: { "itemId": { pa: 1, pm: 1, ... } } or flat { pa: 1, pm: 1 }

    // A. Global FM
    const stuffFm = raw.stuff?.stuffFm?.fm || raw.stuffFm?.fm || {};
    pa    += Number(stuffFm.pa)  || 0;
    pm    += Number(stuffFm.pm)  || 0;
    po    += Number(stuffFm.po)  || 0;
    vit   += Number(stuffFm.vi)  || Number(stuffFm.vit) || 0;
    el_fo += Number(stuffFm.fo)  || 0;
    el_in += Number(stuffFm.in)  || 0;
    el_ch += Number(stuffFm.ch)  || 0;
    el_ag += Number(stuffFm.ag)  || 0;

    // B. Per-item exo FM — path: raw.stuff.stuffFmItem (NOT raw.stuff.stuffFm.fmItem!)
    // Structure: { "slotKey": { pa: 1, pm: 1, ... } } — one entry per slot
    const stuffFmItem = raw.stuff?.stuffFmItem || raw.stuffFmItem || {};
    if (stuffFmItem && typeof stuffFmItem === 'object') {
        Object.values(stuffFmItem).forEach((fmStats: any) => {
            if (!fmStats || typeof fmStats !== 'object') return;
            pa    += Number(fmStats.pa)  || 0;
            pm    += Number(fmStats.pm)  || 0;
            po    += Number(fmStats.po)  || 0;
            vit   += Number(fmStats.vi)  || Number(fmStats.vit) || 0;
            el_fo += Number(fmStats.fo)  || 0;
            el_in += Number(fmStats.in)  || 0;
            el_ch += Number(fmStats.ch)  || 0;
            el_ag += Number(fmStats.ag)  || 0;
            resN  += Number(fmStats.rnp) || 0;
            resT  += Number(fmStats.rtp) || 0;
            resF  += Number(fmStats.rfp) || 0;
            resE  += Number(fmStats.rep) || 0;
            resA  += Number(fmStats.rap) || 0;
        });
    }

    return {
        id: parseInt(id),
        name: raw.stuff?.name || "Sans nom",
        level,
        classId: raw.stuff?.character_class || 1,
        className: getClassName(raw.stuff?.character_class),
        stats: { pa, pm, po, vit },
        elements: { fo: el_fo, in: el_in, ch: el_ch, ag: el_ag, sa: el_sa },
        resists: { neutre: resN, terre: resT, feu: resF, eau: resE, air: resA },
        items: itemsMap,
        cloths: activeCloths
    };
}

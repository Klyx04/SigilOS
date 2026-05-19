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
        ini: number;
        pp: number;
        cc: number;
        invo: number;
        so: number;
    };
    /** Character real stats = items + capital + scrolls */
    elements: {
        fo: number;   // Force
        in: number;   // Intelligence
        ch: number;   // Chance
        ag: number;   // Agilité
        sa: number;   // Sagesse
        pu: number;   // Puissance
    };
    resists: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
    };
    damages?: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
        general: number;
        critique: number;
        poussee: number;
        armes: number;
        sorts: number;
        melee: number;
        distance: number;
    };
    items?: Record<string, DofusbookItem | null>;
    cloths?: {
        name: string;
        count: number;
        total: number;
        clothItems?: DofusbookItem[]; // items belonging to this set (equipped ones)
        bonuses?: Record<string, number>;
    }[];
    thumbnail?: string;
    smithmagic?: any;
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
    let ini = level * 5; // Rough base initiative approximation
    let pp = 100;
    let cc = 0;
    let invo = 1;
    let so = 0;
    let resN = 0, resT = 0, resF = 0, resE = 0, resA = 0;

    // Damages
    let dn = 0, dt = 0, df = 0, de = 0, da = 0, dom = 0;
    let dc = 0, dp = 0, do_armes = 0, do_sorts = 0, do_melee = 0, do_dist = 0;

    // Element stats from items only (capital/scroll added later)
    let el_fo = 0, el_in = 0, el_ch = 0, el_ag = 0, el_sa = 0, el_pu = 0;

    const stuffItemsSlots = raw.stuff?.stuffItem || {};
    const itemsList: any[] = raw.items || [];
    const itemsMap: Record<string, DofusbookItem | null> = {};
    const stuffFmItem = raw.stuff?.stuffFmItem || raw.stuffFmItem || {};

    // Sums item effects into our running stats
    const sumEffect = (e: any) => {
        const name = (e.name || "").toLowerCase();
        // Dofusbook items feature both min and max property bounds.
        // Selecting the best roll means selecting Math.max(min, max).
        // This naturally accommodates penalties (e.g., -5 to -4% means the best roll is -4%).
        const minVal = e.min !== undefined && e.min !== null ? Number(e.min) : undefined;
        const maxVal = e.max !== undefined && e.max !== null ? Number(e.max) : undefined;
        
        let val = Number(e.value) || 0;
        if (minVal !== undefined && maxVal !== undefined) {
            val = Math.max(minVal, maxVal);
        } else if (maxVal !== undefined) {
            val = maxVal;
        } else if (minVal !== undefined) {
            val = minVal;
        }

        if (val === 0 && name !== 'invo' && name !== 'po') return;

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
            case 'in':
                if (name === 'in') el_in += val; // 'in' is intel
                break;
            case 'ch':  el_ch += val; break;
            case 'ag':  el_ag += val; break;
            case 'sa':  el_sa += val; break;
            case 'pu':  el_pu += val; break;
            // Resistances % (actual Dofusbook API stat names)
            case 'rnp': resN += val; break;  // résistance neutre %
            case 'rtp': resT += val; break;  // résistance terre %
            case 'rfp': resF += val; break;  // résistance feu %
            case 'rep': resE += val; break;  // résistance eau %
            case 'rap': resA += val; break;  // résistance air %
            // Damages
            case 'dnf': dn += val; break;
            case 'dtf': dt += val; break;
            case 'dff': df += val; break;
            case 'def': de += val; break;
            case 'daf': da += val; break;
            case 'df':  dom += val; break;
            case 'dc':  dc += val; break;
            case 'dp':  dp += val; break;
            // % Damages
            case 'da':  do_armes += val; break;
            case 'ds':  do_sorts += val; break;
            case 'dm':  do_melee += val; break;
            case 'di':  do_dist += val; break;
            // Secondary
            case 'ini': ini += val; break;
            case 'cc': cc += val; break;
            case 'pp': pp += val; break;
            case 'invo': invo += val; break;
            case 'so': so += val; break;
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
            // Mod: Only add base effect if that stat hasn't been FM'd (overridden in stuffFmItem)
            const fmItemOverrides = (stuffFmItem && typeof stuffFmItem === 'object') ? (stuffFmItem as any)[slot] : null;

            const effects = item.effects || item.stats || [];
            if (Array.isArray(effects)) {
                effects.forEach(e => {
                    const name = (e.name || "").toLowerCase();
                    if (fmItemOverrides && fmItemOverrides[name] !== undefined) {
                        return; // Ignore this base stat, it's overwritten by FM
                    }
                    sumEffect(e);
                });
            }
        } else {
            itemsMap[slot] = null;
        }
    });

    // 🔗 3. Panoplie Bonuses
    const activeCloths: { name: string; count: number; total: number; clothItems?: DofusbookItem[]; bonuses?: Record<string, number> }[] = [];
    if (Array.isArray(raw.cloths)) {
        raw.cloths.forEach((cloth: any) => {
            const clothItemIds = new Set((cloth.items || []).map((i: any) => Number(i.id)));
            const equippedCount = Object.values(stuffItemsSlots).filter(
                id => clothItemIds.has(Number(id))
            ).length;

            const total = cloth.count_item || cloth.items?.length || 0;
            const clothName = cloth.name || "Panoplie inconnue";

            // Apply ALL cumulative bonuses up to equippedCount
            // Dofus pano bonuses are cumulative: 3 pieces = 2-piece bonus + 3-piece bonus
            const bonuses = (cloth.effects || []).filter(
                (e: any) => Number(e.count) <= equippedCount
            );
            
            const clothBonuses: Record<string, number> = {};
            bonuses.forEach((e: any) => {
                sumEffect(e);
                const name = (e.name || "").toLowerCase();
                const val = Number(e.value) || Math.max(Number(e.min) || 0, Number(e.max) || 0);
                if (val !== 0 && name !== 'invo' && name !== 'po') {
                    clothBonuses[name] = (clothBonuses[name] || 0) + val;
                } else if (val !== 0) {
                    clothBonuses[name] = (clothBonuses[name] || 0) + val;
                }
            });

            if (equippedCount > 1) {
                // Collect the actually-equipped items from this cloth
                const equippedClothItems: DofusbookItem[] = (cloth.items || [])
                    .filter((ci: any) => Object.values(stuffItemsSlots).some(id => Number(id) === Number(ci.id)))
                    .map((ci: any) => itemsList.find((i: any) => Number(i.id) === Number(ci.id)))
                    .filter(Boolean)
                    .map((i: any) => ({ id: i.id, name: i.name, picture: i.picture, official: i.official }));

                activeCloths.push({ name: clothName, count: equippedCount, total, clothItems: equippedClothItems, bonuses: clothBonuses });
            }
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
        el_pu += base('pu')  + scroll('pu');
        ini   += base('ini') + scroll('ini');
    }
    
    // Add Chance / 10 to Prospection
    pp += Math.floor(el_ch / 10);

    // 🔧 5. Forgemagie — two possible sources:
    //   A. stuffFm.fm  = global FM applied to character stats (shown as "+1 PA" next to stat)
    //   B. stuffFmItem = per-item exo FM (shown in "Exo / Over des items" section)
    //      Structure: { "itemId": { pa: 1, pm: 1, ... } } or flat { pa: 1, pm: 1 }

    // A. Global FM
    const fmGlobal = raw.stuff?.stuffFm?.fm || raw.stuffFm?.fm || {};
    pa    += Number(fmGlobal.pa)  || 0;
    pm    += Number(fmGlobal.pm)  || 0;
    po    += Number(fmGlobal.po)  || 0;
    vit   += Number(fmGlobal.vi)  || Number(fmGlobal.vit) || 0;
    el_fo += Number(fmGlobal.fo)  || 0;
    el_in += Number(fmGlobal.in)  || 0;
    el_ch += Number(fmGlobal.ch)  || 0;
    el_ag += Number(fmGlobal.ag)  || 0;
    el_pu += Number(fmGlobal.pu)  || 0;
    ini   += Number(fmGlobal.ini) || 0;
    cc    += Number(fmGlobal.cc)  || 0;
    pp    += Number(fmGlobal.pp)  || 0;
    invo  += Number(fmGlobal.invo)|| 0;
    so    += Number(fmGlobal.so)  || 0;
    dn    += Number(fmGlobal.dnf) || 0;
    dt    += Number(fmGlobal.dtf) || 0;
    df    += Number(fmGlobal.dff) || 0;
    de    += Number(fmGlobal.def) || 0;
    da    += Number(fmGlobal.daf) || 0;
    dom   += Number(fmGlobal.df)  || 0;
    dc    += Number(fmGlobal.dc)  || 0;
    dp    += Number(fmGlobal.dp)  || 0;
    do_armes += Number(fmGlobal.da) || 0;
    do_sorts += Number(fmGlobal.ds) || 0;
    do_melee += Number(fmGlobal.dm) || 0;
    do_dist  += Number(fmGlobal.di) || 0;

    // B. Per-item exo FM — path: raw.stuff.stuffFmItem (NOT raw.stuff.stuffFm.fmItem!)
    // We already skipped the base values in sumEffect, so now we just blindly ADD every fm value 
    // exactly as they are defined on the FM item object.
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
            el_pu += Number(fmStats.pu)  || 0;
            resN  += Number(fmStats.rnp) || 0;
            resT  += Number(fmStats.rtp) || 0;
            resF  += Number(fmStats.rfp) || 0;
            resE  += Number(fmStats.rep) || 0;
            resA  += Number(fmStats.rap) || 0;
            ini   += Number(fmStats.ini) || 0;
            cc    += Number(fmStats.cc)  || 0;
            pp    += Number(fmStats.pp)  || 0;
            invo  += Number(fmStats.invo)|| 0;
            so    += Number(fmStats.so)  || 0;
            dn    += Number(fmStats.dnf) || 0;
            dt    += Number(fmStats.dtf) || 0;
            df    += Number(fmStats.dff) || 0;
            de    += Number(fmStats.def) || 0;
            da    += Number(fmStats.daf) || 0;
            dom   += Number(fmStats.df)  || 0;
            dc    += Number(fmStats.dc)  || 0;
            dp    += Number(fmStats.dp)  || 0;
            do_armes += Number(fmStats.da) || 0;
            do_sorts += Number(fmStats.ds) || 0;
            do_melee += Number(fmStats.dm) || 0;
            do_dist  += Number(fmStats.di) || 0;
        });
    }

    // 🔧 6. Extract true Exo/Over for the FM Panel
    // We compare stuffFmItem (full modified stats) with the base item effects
    const computedSmithmagic: Record<string, Record<string, number>> = {};
    if (stuffFmItem && typeof stuffFmItem === 'object') {
        Object.entries(stuffFmItem).forEach(([slot, fmStats]: [string, any]) => {
            if (!fmStats || typeof fmStats !== 'object') return;
            const itemId = stuffItemsSlots[slot];
            const item = itemsList.find(i => Number(i.id) === Number(itemId));
            
            const diff: Record<string, number> = {};
            const baseStats: Record<string, number> = {};
            
            // Gather max base stats
            if (item && Array.isArray(item.effects)) {
                item.effects.forEach((e: any) => {
                    const name = (e.name || "").toLowerCase();
                    const minVal = e.min !== undefined && e.min !== null ? Number(e.min) : undefined;
                    const maxVal = e.max !== undefined && e.max !== null ? Number(e.max) : undefined;
                    let val = Number(e.value) || 0;
                    if (minVal !== undefined && maxVal !== undefined) val = Math.max(minVal, maxVal);
                    else if (maxVal !== undefined) val = maxVal;
                    else if (minVal !== undefined) val = minVal;
                    
                    baseStats[name] = (baseStats[name] || 0) + val;
                });
            }

            // Compare FM stats to base stats
            for (const [stat, val] of Object.entries(fmStats)) {
                const fmVal = Number(val) || 0;
                const baseVal = baseStats[stat.toLowerCase()] || 0;
                const exo = fmVal - baseVal;
                if (exo !== 0) {
                    diff[stat.toLowerCase()] = exo;
                }
            }

            if (Object.keys(diff).length > 0) {
                computedSmithmagic[slot] = diff;
            }
        });
    }

    const numericIdMatch = id?.match(/^(\d+)/);
    const numericId = numericIdMatch ? numericIdMatch[1] : id;
    
    const thumbnail = numericId 
        ? `https://static.dofusbook.net/equipement/render/${numericId}.png`
        : undefined;

    return {
        id: parseInt(id) || 0,
        name: raw.stuff?.name || "Sans nom",
        level,
        classId: raw.stuff?.character_class || 1,
        className: getClassName(raw.stuff?.character_class),
        stats: { pa, pm, po, vit, ini, pp, cc, invo, so },
        elements: { fo: el_fo, in: el_in, ch: el_ch, ag: el_ag, sa: el_sa, pu: el_pu },
        resists: { neutre: resN, terre: resT, feu: resF, eau: resE, air: resA },
        damages: { neutre: dn, terre: dt, feu: df, eau: de, air: da, general: dom, critique: dc, poussee: dp, armes: do_armes, sorts: do_sorts, melee: do_melee, distance: do_dist },
        items: itemsMap,
        cloths: activeCloths,
        thumbnail,
        smithmagic: computedSmithmagic
    };
}

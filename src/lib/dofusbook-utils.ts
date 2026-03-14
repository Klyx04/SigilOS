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
        ini: number;
        invoc: number;
        vit: number;
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
    let po = 0, ini = level, invoc = 1, vit = 50 + (level * 5);
    let resN = 0, resT = 0, resF = 0, resE = 0, resA = 0;

    // 🎒 Initialize
    const stuffItemsSlots = raw.stuff?.stuffItem || {};
    const itemsList: any[] = raw.items || [];
    const itemsMap: Record<string, DofusbookItem | null> = {};

    const sumEffect = (e: any) => {
        const name = (e.name || "").toLowerCase();
        const val = Number(e.max) || Number(e.value) || 0;
        
        if (name === 'pa') pa += val;
        if (name === 'pm') pm += val;
        if (name === 'po') po += val;
        if (name === 'in' || name === 'invoc') invoc += val;
        if (name === 'vi' || name === 'vit') vit += val;
        if (name === 'ini') ini += val;
        
        // Handling both fixed and percent resists (simplified to fixed as Dofusbook raw often mixes them)
        if (name === 're_ne' || name === 're_ne_p') resN += val;
        if (name === 're_te' || name === 're_te_p') resT += val;
        if (name === 're_fe' || name === 're_fe_p') resF += val;
        if (name === 're_ea' || name === 're_ea_p') resE += val;
        if (name === 're_ai' || name === 're_ai_p') resA += val;
        
        // Character stats affect initiative
        if (['fo', 'in', 'ch', 'ag', 'sa'].includes(name)) ini += val;
    };

    // 🔍 2. Sum from Items
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
            if (Array.isArray(effects)) {
                effects.forEach(sumEffect);
            }
        } else {
            itemsMap[slot] = null;
        }
    });

    // 🔗 3. Panoplie Bonuses (Cloths)
    const activeCloths: { name: string; count: number; total: number }[] = [];
    if (Array.isArray(raw.cloths)) {
        raw.cloths.forEach((cloth: any) => {
            const count = cloth.items?.length || 0;
            const pano = cloth.panoplie || {};
            const total = pano.items?.length || count;
            const name = pano.name || "Panoplie inconnue";
            
            if (count > 1) {
                activeCloths.push({ name, count, total });
            }

            // Dofusbook stores pano bonuses in pano.stats[count]
            const panStatsDict = pano.stats || {};
            const bonus = panStatsDict[count];
            if (Array.isArray(bonus)) {
                bonus.forEach(sumEffect);
            }
        });
    }

    // 👤 4. Character Points (Capital/Parchos)
    if (raw.stuffStats && !Array.isArray(raw.stuffStats)) {
        const s = raw.stuffStats;
        const sum = (key: string) => (Number(s[`base_${key}`]) || 0) + (Number(s[`scroll_${key}`]) || 0);
        
        vit += sum('vi');
        // Initial Initiative is also affected by base stats
        ini += sum('fo') + sum('in') + sum('ch') + sum('ag') + sum('sa');
    }

    return {
        id: parseInt(id),
        name: raw.stuff?.name || "Sans nom",
        level: level,
        classId: raw.stuff?.character_class || 1,
        className: getClassName(raw.stuff?.character_class),
        stats: { pa, pm, po, ini, invoc, vit },
        resists: {
            neutre: resN,
            terre: resT,
            feu: resF,
            eau: resE,
            air: resA,
        },
        items: itemsMap,
        cloths: activeCloths
    };
}


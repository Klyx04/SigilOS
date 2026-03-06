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
    let po = 0, ini = 0, invoc = 1, vit = 50 + (level * 5);
    let resN = 0, resT = 0, resF = 0, resE = 0, resA = 0;

    // 🎒 Initialize
    const stuffItemsSlots = raw.stuff?.stuffItem || {};
    const itemsList: any[] = raw.items || [];
    const itemsMap: Record<string, DofusbookItem | null> = {};

    // 🔍 2. Manual Sum from Items
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
                effects.forEach((e: any) => {
                    const name = (e.name || "").toLowerCase();
                    const val = Number(e.max) || Number(e.value) || 0;
                    if (name === 'pa') pa += val;
                    if (name === 'pm') pm += val;
                    if (name === 'po') po += val;
                    if (name === 'in' || name === 'invoc') invoc += val;
                    if (name === 'vi' || name === 'vit') vit += val;
                    if (name === 'ini') ini += val;
                    if (name === 're_ne') resN += val;
                    if (name === 're_te') resT += val;
                    if (name === 're_fe') resF += val;
                    if (name === 're_ea') resE += val;
                    if (name === 're_ai') resA += val;
                    if (['fo', 'in', 'ch', 'ag'].includes(name)) ini += val;
                });
            }
        } else {
            itemsMap[slot] = null;
        }
    });

    // 🔗 3. Panoplie Bonuses (Cloths)
    if (Array.isArray(raw.cloths)) {
        raw.cloths.forEach((cloth: any) => {
            const count = cloth.items?.length || 0;
            const panStats = cloth.panoplie?.stats || cloth.stats;
            if (panStats && panStats[count]) {
                const bonus = panStats[count];
                if (Array.isArray(bonus)) {
                    bonus.forEach((b: any) => {
                        const name = (b.name || "").toLowerCase();
                        const val = Number(b.value) || 0;
                        if (name === 'pa') pa += val;
                        if (name === 'pm') pm += val;
                        if (name === 'po') po += val;
                        if (name === 'vi') vit += val;
                        if (name === 'ini') ini += val;
                        if (name === 're_ne') resN += val;
                        if (name === 're_te') resT += val;
                        if (name === 're_fe') resF += val;
                        if (name === 're_ea') resE += val;
                        if (name === 're_ai') resA += val;
                    });
                }
            }
        });
    }

    // 👤 4. Character Points
    if (raw.stuffStats && !Array.isArray(raw.stuffStats)) {
        const s = raw.stuffStats;
        const sum = (key: string) => (Number(s[`base_${key}`]) || 0) + (Number(s[`scroll_${key}`]) || 0);
        vit += sum('vi');
        ini += sum('ini') + (sum('fo') + sum('in') + sum('ch') + sum('ag'));
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
        items: itemsMap
    };
}


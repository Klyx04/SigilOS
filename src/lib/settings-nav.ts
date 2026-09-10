/**
 * Navigation des Paramètres — filtrage par modules (cohérence "désactivé =
 * invisible"). Pur (testé en unitaire) : la page construit les groupes avec
 * leur module éventuel, ce helper retire les items dont le module est OFF
 * ainsi que les groupes vidés. `module` absent = structurel, toujours affiché.
 * L'état effectif inclut déjà le verrou God (getGuildModules).
 */
export interface SettingsNavItemDef {
    id: string;
    module?: string | null;
}

export interface SettingsNavGroupDef {
    title: string;
    items: SettingsNavItemDef[];
}

export function getVisibleSettingsNav<T extends SettingsNavItemDef>(
    groups: Array<{ title: string; items: T[] }>,
    modules: Record<string, boolean | undefined> | null | undefined
): Array<{ title: string; items: T[] }> {
    if (!modules) return groups;
    const out: Array<{ title: string; items: T[] }> = [];
    for (const group of groups) {
        const items = group.items.filter((item) => !item.module || !!modules[item.module]);
        if (items.length > 0) out.push({ title: group.title, items });
    }
    return out;
}

/** Onglet → module requis pour afficher le panneau (même règle que la nav). */
export const SETTINGS_TAB_MODULES: Record<string, string> = {
    sondages: "polls",
    calendrier: "calendar",
    donjons: "donjons",
    missions: "missions",
    metamob: "ocre",
    gallery: "gallery",
    services: "services",
    annuaire: "roster",
    marche: "marche",
};

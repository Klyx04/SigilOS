/**
 * Fiche visiteur — **règles pures** des filtres de listes (aucune I/O, aucun React).
 *
 * Les listes de la fiche sont bornées côté serveur (`PUBLIC_PROFILE_*_TAKE`) ; ces règles
 * s'appliquent dessus pour rendre l'écran utilisable : recherche accent-insensible,
 * personnage, donjon / zone, niveau minimum. Un filtre inconnu (`"all"`) ne filtre rien.
 */

import type { VisitorAchievement, VisitorBounty, VisitorJob } from "@/lib/public-directory";

/** Nombre d'éléments révélés par « Voir plus » (une liste de 200 reste lisible). */
export const VISITOR_PROFILE_LIST_PAGE_SIZE = 24;

/** Les métiers sont des pastilles compactes : on en révèle 8 avant « Voir plus ». */
export const VISITOR_PROFILE_JOBS_PAGE_SIZE = 8;

/** Valeur de filtre « tout » — jamais un libellé utilisateur. */
export const VISITOR_PROFILE_FILTER_ALL = "all";

/** Normalise pour comparer sans accents ni casse. */
export function normalizeVisitorFilterText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function matchesQuery(query: string, ...values: Array<string | null | undefined>): boolean {
    const needle = normalizeVisitorFilterText(query);
    if (!needle) return true;
    return values.some((value) => value && normalizeVisitorFilterText(value).includes(needle));
}

function matchesSlot(slot: string, wanted: string): boolean {
    return wanted === VISITOR_PROFILE_FILTER_ALL || slot === wanted;
}

export function filterVisitorAchievements(
    items: ReadonlyArray<VisitorAchievement>,
    query: string,
    characterSlot: string,
    dungeonName: string
): VisitorAchievement[] {
    return items.filter(
        (item) =>
            matchesSlot(item.characterSlot, characterSlot) &&
            (dungeonName === VISITOR_PROFILE_FILTER_ALL || item.dungeonName === dungeonName) &&
            matchesQuery(query, item.name, item.dungeonName)
    );
}

export function filterVisitorBounties(
    items: ReadonlyArray<VisitorBounty>,
    query: string,
    characterSlot: string,
    zoneName: string
): VisitorBounty[] {
    return items.filter(
        (item) =>
            matchesSlot(item.characterSlot, characterSlot) &&
            (zoneName === VISITOR_PROFILE_FILTER_ALL || item.zoneName === zoneName) &&
            matchesQuery(query, item.name, item.zoneName)
    );
}

export function filterVisitorJobs(
    items: ReadonlyArray<VisitorJob>,
    query: string,
    minLevel: number | null
): VisitorJob[] {
    return items.filter(
        (item) =>
            (minLevel === null || item.level >= minLevel) &&
            matchesQuery(query, item.name)
    );
}

/** Personnages présents dans une liste, principal d'abord puis ordre alphabétique. */
export function visitorCharacterSlots(
    items: ReadonlyArray<{ characterSlot: string }>,
    principalSlot: string
): string[] {
    const unique = new Set(items.map((item) => item.characterSlot));
    return [...unique].sort((a, b) => {
        if (a === principalSlot) return -1;
        if (b === principalSlot) return 1;
        return a.localeCompare(b, "fr");
    });
}

/** Donjons présents dans la liste, ordre alphabétique (sans doublon). */
export function visitorDungeonNames(items: ReadonlyArray<VisitorAchievement>): string[] {
    return [...new Set(items.map((item) => item.dungeonName))].sort((a, b) =>
        a.localeCompare(b, "fr")
    );
}

/** Zones présentes dans la liste (une zone absente n'est pas proposée). */
export function visitorZoneNames(items: ReadonlyArray<VisitorBounty>): string[] {
    return [
        ...new Set(
            items
                .map((item) => item.zoneName)
                .filter((zone): zone is string => typeof zone === "string" && zone.length > 0)
        ),
    ].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Tranche visible d'une liste filtrée (`visible` est déjà borné par l'appelant). */
export function visitorVisibleSlice<T>(items: ReadonlyArray<T>, visible: number): T[] {
    return items.slice(0, Math.max(0, visible));
}

/**
 * Tris de la fiche visiteur — une **préférence d'affichage**, jamais un filtre.
 *
 * Le tri par donjon / zone est le défaut : il regroupe les lignes qui partagent la même
 * origine, ce qui rend le tableau lisible sans recopier le nom du donjon sur chaque ligne.
 */
export const VISITOR_PROFILE_ACHIEVEMENT_SORTS = ["dungeon", "name", "points"] as const;
export type VisitorProfileAchievementSort = (typeof VISITOR_PROFILE_ACHIEVEMENT_SORTS)[number];

export const VISITOR_PROFILE_BOUNTY_SORTS = ["zone", "name", "level"] as const;
export type VisitorProfileBountySort = (typeof VISITOR_PROFILE_BOUNTY_SORTS)[number];

function compareText(a: string | null | undefined, b: string | null | undefined): number {
    return (a ?? "").localeCompare(b ?? "", "fr", { sensitivity: "base" });
}

/** Copie triée : l'original n'est jamais muté (les listes viennent du serveur). */
export function sortVisitorAchievements(
    items: ReadonlyArray<VisitorAchievement>,
    sort: VisitorProfileAchievementSort
): VisitorAchievement[] {
    return [...items].sort((a, b) => {
        switch (sort) {
            case "name":
                return compareText(a.name, b.name) || compareText(a.dungeonName, b.dungeonName);
            case "points":
                return b.points - a.points || compareText(a.name, b.name);
            default:
                return compareText(a.dungeonName, b.dungeonName) || compareText(a.name, b.name);
        }
    });
}

/** Copie triée des avis : zone par défaut, puis nom ou niveau décroissant. */
export function sortVisitorBounties(
    items: ReadonlyArray<VisitorBounty>,
    sort: VisitorProfileBountySort
): VisitorBounty[] {
    return [...items].sort((a, b) => {
        switch (sort) {
            case "name":
                return compareText(a.name, b.name) || compareText(a.zoneName, b.zoneName);
            case "level":
                return b.level - a.level || compareText(a.name, b.name);
            default:
                return compareText(a.zoneName, b.zoneName) || compareText(a.name, b.name);
        }
    });
}

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

/**
 * Familles de monstres d'une zone — règle **pure**, partagée par la fiche de zone de
 * la carte du monde (onglet « Familles »).
 *
 * Défaut mesuré (11/10/2026) : le rattachement monstre → famille se faisait sur le
 * nom **brut** (`m.familyName === family.name`). Dès qu'une écriture différait d'un
 * accent, d'une casse ou d'un espace, la famille s'affichait avec « 0 espèce » et
 * ses monstres disparaissaient — un « fail » silencieux à l'écran.
 *
 * Règle unique et testée :
 *   · la clé de rapprochement ignore casse, accents et ponctuation ;
 *   · une famille **sans monstre** n'est jamais affichée (jamais de bloc vide) ;
 *   · un monstre dont la famille n'est pas déclarée dans la zone est écarté (pas de
 *     famille fantôme) ;
 *   · une famille déclarée deux fois n'est rendue qu'une fois.
 */

/** Clé de rapprochement d'un nom de famille (casse/accents/ponctuation ignorés). */
export function familyKey(name: string | null | undefined): string {
    return String(name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export interface ZoneFamilyGroup<TFamily, TMonster> {
    family: TFamily;
    monsters: TMonster[];
}

/**
 * Rattache chaque monstre à sa famille déclarée et ne retourne que les familles
 * réellement peuplées.
 */
export function groupZoneFamilies<
    TFamily extends { name: string },
    TMonster extends { name: string; familyName?: string | null },
>(families: TFamily[], monsters: TMonster[]): ZoneFamilyGroup<TFamily, TMonster>[] {
    const byFamily = new Map<string, TMonster[]>();
    for (const monster of monsters) {
        const key = familyKey(monster.familyName);
        if (!key) continue;
        const list = byFamily.get(key);
        if (list) list.push(monster);
        else byFamily.set(key, [monster]);
    }

    const groups: ZoneFamilyGroup<TFamily, TMonster>[] = [];
    const seen = new Set<string>();
    for (const family of families) {
        const key = familyKey(family.name);
        if (!key || seen.has(key)) continue;
        const attached = byFamily.get(key);
        if (!attached || attached.length === 0) continue;
        seen.add(key);
        groups.push({ family, monsters: attached });
    }
    return groups;
}

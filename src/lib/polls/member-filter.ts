/**
 * Sondages — **filtre de participation** : qui afficher dans les listes de
 * votants (et de non-votants) selon un **rôle Discord** et une **recherche**.
 *
 * Pourquoi une règle pure : les deux listes (votants d'un choix, non-votants)
 * doivent obéir au **même** filtre, sinon elles se contredisent à l'écran
 * (« untel votant *et* non-votant »), et la recherche doit ignorer les accents
 * (les pseudos Dofus en sont pleins : « Azäël » vs « azael »).
 *
 * ⚠️ **Fail-soft assumé** : si les rôles ne sont pas disponibles (bot Discord
 * sans l'intent « Server Members », cache vide, appel en échec), un filtre par
 * rôle **ne filtre rien** au lieu de vider les listes. On ne prétend jamais
 * « personne n'a ce rôle » alors qu'on ne le sait pas.
 */

export interface PollMemberFilterInput {
    /** Recherche libre (nom affiché) — insensible à la casse et aux accents. */
    query?: string;
    /** Rôle Discord retenu (`null`/vide = tous). */
    roleId?: string | null;
    /** `profileId` → identifiants de rôles Discord. Vide = rôle non filtrable. */
    rolesByProfileId?: Record<string, string[]> | null;
}

/** Normalise un texte pour la recherche : minuscules, sans accents, sans espaces de bord. */
export function normalizeSearch(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Filtre une liste de membres (votants ou non-votants). L'ORDRE d'entrée est
 * conservé (les listes serveur sont déjà triées : ordre du vote, ou nom FR).
 */
export function filterPollMembers<T extends { id: string; name: string }>(
    items: readonly T[],
    input: PollMemberFilterInput = {},
): T[] {
    const query = normalizeSearch(input.query);
    const roleId = input.roleId?.trim() || null;
    const roles = input.rolesByProfileId ?? {};
    const roleDataAvailable = Object.keys(roles).length > 0;

    return items.filter((member) => {
        if (query && !normalizeSearch(member.name).includes(query)) return false;
        if (roleId && roleDataAvailable) {
            const memberRoles = roles[member.id];
            if (!memberRoles || !memberRoles.includes(roleId)) return false;
        }
        return true;
    });
}

/** Nombre de rôles réellement filtrables (0 = le sélecteur de rôle n'apporte rien). */
export function countFilterableRoles(rolesByProfileId: Record<string, string[]> | null | undefined): number {
    if (!rolesByProfileId) return 0;
    const unique = new Set<string>();
    for (const roleIds of Object.values(rolesByProfileId)) {
        for (const id of roleIds) unique.add(id);
    }
    return unique.size;
}

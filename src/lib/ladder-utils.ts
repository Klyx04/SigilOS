/**
 * Ladder helper utilities (client-safe)
 */

/**
 * Convert days to readable format (years, months, days)
 */
export function formatSeniority(totalDays: number): string {
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} an${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} mois`);
    if (days > 0 || parts.length === 0) parts.push(`${days} jour${days > 1 ? "s" : ""}`);

    return parts.join(", ");
}

export interface LadderSearchable {
    discordNickname?: string | null;
    pseudoDofus?: string | null;
}

/**
 * Normalise une requête de recherche pseudo : casse, accents, tirets/espaces
 * multiples. « twoda-jr », « Twoda Jr » et « twodajr » matchent pareil.
 */
export function normalizeLadderQuery(query: string): string {
    return query
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_\s]+/g, "");
}

/**
 * Vrai si l'entrée matche la requête (requête déjà normalisée ou non —
 * normalisée ici par sécurité). Champs couverts : pseudo Discord + pseudo Dofus.
 */
export function matchLadderSearch<T extends LadderSearchable>(entry: T, query: string): boolean {
    const q = normalizeLadderQuery(query);
    if (!q) return true;
    const nick = entry.discordNickname ? normalizeLadderQuery(entry.discordNickname) : "";
    const pseudo = entry.pseudoDofus ? normalizeLadderQuery(entry.pseudoDofus) : "";
    return nick.includes(q) || pseudo.includes(q);
}

/**
 * Filtre un classement complet (appliqué AVANT pagination côté serveur :
 * la recherche porte sur tous les membres, pas seulement la page courante).
 */
export function applyLadderSearch<T extends LadderSearchable>(entries: readonly T[], query: string): T[] {
    if (!normalizeLadderQuery(query)) return [...entries];
    return entries.filter((e) => matchLadderSearch(e, query));
}

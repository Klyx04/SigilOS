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

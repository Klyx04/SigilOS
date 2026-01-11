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

/**
 * Get achievement tier based on points
 */
export function getAchievementTier(points: number): {
    name: string;
    color: string;
    icon: string;
} {
    if (points >= 25000) return { name: "Légende", color: "#FFD700", icon: "👑" };
    if (points >= 20000) return { name: "Champion", color: "#FF8C00", icon: "🔶" };
    if (points >= 15000) return { name: "Aventurier", color: "#9B59B6", icon: "💜" };
    if (points >= 10000) return { name: "Explorateur", color: "#3498DB", icon: "💙" };
    return { name: "Novice", color: "#95A5A6", icon: "⚪" };
}

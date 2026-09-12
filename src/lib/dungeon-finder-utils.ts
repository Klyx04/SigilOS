/**
 * Utilitaires pour le Dungeon Finder (normalisation multi-donjons, titres, sous-titres, images)
 * #26 — Mode multi-donjons
 */

export interface MultiDungeonItem {
    dungeonId: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl: string | null;
    wantedAchievementIds?: string[];
    achievements?: { id: string; name: string; iconUrl: string | null }[];
    message?: string | null;
    targetDate?: Date | string | null;
    maxMembers?: number;
}

/**
 * Normalise la liste des donjons d'un post multi-donjons (#26).
 * Supporte :
 * - Tableau direct : [...]
 * - Objet enveloppé (sauvegarde rappels Discord / inactivité) : { _items: [...], _autoReminderCount: ... }
 * - Chaîne JSON sérialisée
 */
export function getMultiDungeons(dungeonsJson: unknown): MultiDungeonItem[] {
    if (!dungeonsJson) return [];
    if (Array.isArray(dungeonsJson)) return dungeonsJson as MultiDungeonItem[];
    if (typeof dungeonsJson === "object" && dungeonsJson !== null) {
        if (Array.isArray((dungeonsJson as any)._items)) return (dungeonsJson as any)._items as MultiDungeonItem[];
        if (Array.isArray((dungeonsJson as any).items)) return (dungeonsJson as any).items as MultiDungeonItem[];
        if (Array.isArray((dungeonsJson as any).posts)) return (dungeonsJson as any).posts as MultiDungeonItem[];
    }
    if (typeof dungeonsJson === "string") {
        try {
            const parsed = JSON.parse(dungeonsJson);
            return getMultiDungeons(parsed);
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * Calcule le titre d'affichage pour un post DJ (simple ou multi-donjons).
 */
export function getDjPostTitle(post: {
    mode?: string | null;
    dungeon?: { name?: string | null } | null;
    dungeonsJson?: unknown;
    defiName?: string | null;
    titanName?: string | null;
    questName?: string | null;
}): string {
    const multi = getMultiDungeons(post.dungeonsJson);
    if (multi.length > 0) {
        if (multi.length <= 2) {
            return multi.map(d => d.name || "Donjon").join(" + ");
        }
        return `Multi-donjons (${multi.length})`;
    }
    if (post.mode === "DONJON") {
        return post.dungeon?.name || "Donjon";
    }
    if (post.mode === "DEFI") return post.defiName || "Défi";
    if (post.mode === "TITAN") return post.titanName || "Titan";
    return post.questName || "Quête";
}

/**
 * Calcule le sous-titre d'affichage (ex: niveau, boss, etc.).
 */
export function getDjPostSubtitle(post: {
    mode?: string | null;
    dungeon?: { bossName?: string | null; level?: number | null } | null;
    dungeonsJson?: unknown;
    defiName?: string | null;
    titanName?: string | null;
}): string {
    const multi = getMultiDungeons(post.dungeonsJson);
    if (multi.length > 0) {
        const levels = multi
            .map(d => d.level)
            .filter((lvl): lvl is number => typeof lvl === "number" && !isNaN(lvl));
        if (levels.length > 0) {
            const minLvl = Math.min(...levels);
            const maxLvl = Math.max(...levels);
            const lvlText = minLvl === maxLvl ? `Niv. ${minLvl}` : `Niv. ${minLvl} à ${maxLvl}`;
            return `${lvlText} · ${multi.length} donjons`;
        }
        return `Session de ${multi.length} donjons`;
    }
    if (post.mode === "DONJON") {
        const boss = post.dungeon?.bossName;
        const lvl = post.dungeon?.level;
        if (boss && lvl != null) return `Niv. ${lvl} — ${boss}`;
        if (lvl != null) return `Niv. ${lvl}`;
        if (boss) return boss;
        return "Donjon";
    }
    if (post.mode === "DEFI") return post.defiName || "Événement Défi";
    if (post.mode === "TITAN") return post.titanName || "Mode Titan";
    return "Mode Quête";
}

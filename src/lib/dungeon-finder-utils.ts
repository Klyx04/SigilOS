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

/* ------------------------------------------------------------------------- */
/* Date & heure prévues — OPTIONNELLES sur un post Donjons & Quêtes           */
/* ------------------------------------------------------------------------- */

/**
 * La date est optionnelle, et l'heure aussi (« Sans heure » dans le sélecteur,
 * qui pose alors minuit). Afficher « 00:00 » dans ce cas serait un mensonge
 * (personne ne lance un donjon à minuit pile) : on affiche la **date seule**.
 *
 * Le calcul est fait en **heure civile Europe/Paris**, pour le serveur (embed
 * Discord) ET le navigateur (carte dashboard) : sans ça les deux vues
 * divergeaient (le serveur en UTC voyait 22:00 → « heure fixée », la carte
 * voyait 00:00 → « date seule »). C'est aussi le référentiel que Discord
 * affiche aux membres français.
 */
const DJ_DATE_TZ = "Europe/Paris";

export type DjDateParts = {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    /** Vrai si une heure a été fixée (≠ 00:00) ; « Sans heure » → false. */
    explicitTime: boolean;
};

/** Découpe une date de post DJ en heure civile Paris, ou null si non exploitable. */
export function getDjDateParts(value: Date | string | null | undefined): DjDateParts | null {
    if (value == null || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;

    const parts = new Intl.DateTimeFormat("fr-CA", {
        timeZone: DJ_DATE_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(d);
    const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);

    const year = num("year");
    const month = num("month");
    const day = num("day");
    // `hour12: false` peut rendre « 24 » pour minuit selon l'ICU → on ramène à 0.
    const hours = num("hour") % 24;
    const minutes = num("minute");
    if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return null;

    return { year, month, day, hours, minutes, explicitTime: hours !== 0 || minutes !== 0 };
}

/** Une heure a-t-elle été fixée ? (faux pour une date posée à minuit → « date seule ») */
export function hasExplicitTime(value: Date | string | null | undefined): boolean {
    return getDjDateParts(value)?.explicitTime ?? false;
}

/**
 * Libellé français unique des cartes et écrans du finder :
 * « dimanche 20 septembre 2026 à 18:00 », ou « dimanche 20 septembre 2026 »
 * quand aucune heure n'a été fixée. `null` si la date est absente/invalide.
 */
export function formatDjDateLabel(
    value: Date | string | null | undefined,
    opts: { shortWeekday?: boolean; shortMonth?: boolean } = {}
): string | null {
    const parts = getDjDateParts(value);
    if (!parts) return null;
    const d = value instanceof Date ? value : new Date(value as string);
    const datePart = new Intl.DateTimeFormat("fr-FR", {
        timeZone: DJ_DATE_TZ,
        weekday: opts.shortWeekday ? "short" : "long",
        day: "numeric",
        month: opts.shortMonth ? "short" : "long",
        year: "numeric",
    }).format(d);
    if (!parts.explicitTime) return datePart;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${datePart} à ${pad(parts.hours)}:${pad(parts.minutes)}`;
}

/**
 * Timestamp Discord : `<t:ts:F>` (date + heure) quand une heure est fixée,
 * `<t:ts:D>` (date seule) sinon. `null` si la date est absente/invalide.
 */
export function formatDiscordDateStamp(value: Date | string | null | undefined): string | null {
    if (value == null || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const ts = Math.floor(d.getTime() / 1000);
    return hasExplicitTime(d) ? `<t:${ts}:F>` : `<t:${ts}:D>`;
}

/**
 * Applique de NOUVELLES dates prévues aux donjons d'un post multi (#26).
 *
 * `dungeonsJson` n'est pas toujours un tableau : les rappels Discord inactifs y
 * ajoutent une enveloppe (`{ _items: [...], _autoReminderCount: n }`). On
 * conserve donc l'enveloppe et on ne remplace QUE `targetDate`, pour ne pas
 * écraser le compteur de rappels (régression connue).
 */
export function mergeMultiDungeonTargetDates(
    existing: unknown,
    updates: { targetDate?: Date | string | null }[] | null | undefined
): unknown {
    const items = getMultiDungeons(existing);
    if (items.length === 0) return existing;

    const next = items.map((item, index) => {
        const provided = updates?.[index];
        // `undefined` = donjon non touché ; `null` = date retirée explicitement.
        if (!provided || provided.targetDate === undefined) return item;
        return { ...item, targetDate: provided.targetDate ?? null };
    });

    if (Array.isArray(existing)) return next;
    if (existing && typeof existing === "object" && Array.isArray((existing as any)._items)) {
        return { ...(existing as any), _items: next };
    }
    return next;
}

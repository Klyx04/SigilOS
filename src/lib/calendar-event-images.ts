/**
 * Visuels des événements du calendrier — **source unique** partagée par les embeds
 * Discord (`src/server/calendar-service.ts`) et les cartes du dashboard
 * (`src/components/calendar/event-card.tsx`).
 *
 * Un raid n'a pas un seul visuel : « Gouffre du Gigalodon » et « Sanctuaire des
 * Jardins Éternels » ont chacun leur illustration, choisie via
 * `GuildEvent.metadata.raidType` (`"gigalodon"` | `"jardin"`). Un raid sans type
 * (données historiques) ou `OFFICIAL_RESET` retombe sur le visuel générique.
 */

/** Visuel par défaut d'un événement dont le type n'a pas d'illustration dédiée. */
export const CALENDAR_FALLBACK_IMAGE = "calendar_event_guild.png";

/** Visuels génériques par `GuildEventType`. */
export const EVENT_IMAGES: Record<string, string> = {
    RAID_OFFICIAL: "calendar_raid_official.png",
    EVENT_GUILD: "calendar_event_guild.png",
    SESSION_MISSIONS: "calendar_session_missions.png",
    SORTIE_FARM: "calendar_boss_farm.png",
    KRALAMOURE: "calendar_kralamour.png",
    // Fallbacks / types secondaires
    GUILD_MISSION: "calendar_session_missions.png",
    SONGES_RUN: "calendar_songes_run.png",
    DUNGEON_FARM: "calendar_dungeon_farm.png",
    SOCIAL: "calendar_social.png",
    ALMANAX_BONUS: "calendar_almanax_bonus.png",
    OFFICIAL_RESET: "calendar_raid_official.png",
    OTHERS: "calendar_autres.png",
};

/** Visuels dédiés aux raids, indexés par `metadata.raidType`. */
export const RAID_IMAGES: Record<string, string> = {
    gigalodon: "calendar_raid_gigalodon.jpg",
    jardin: "calendar_raid_sanctuaire.jpg",
};

/** `metadata.raidType` d'un raid (jamais deviné depuis le titre). */
function raidTypeOf(metadata: unknown): string | null {
    const value = (metadata as { raidType?: unknown } | null | undefined)?.raidType;
    return typeof value === "string" ? value : null;
}

/**
 * Nom du fichier servi depuis `/assets/calendar/`.
 * Un raid utilise le visuel de son type **avant** le visuel générique `RAID_OFFICIAL`.
 */
export function resolveEventImageFile(type: string, metadata?: unknown): string {
    if (type === "RAID_OFFICIAL") {
        const raidType = raidTypeOf(metadata);
        if (raidType && RAID_IMAGES[raidType]) return RAID_IMAGES[raidType];
    }
    return EVENT_IMAGES[type] || CALENDAR_FALLBACK_IMAGE;
}

/** Chemin public (Next) de ce visuel — pour les `<img>` du dashboard. */
export function resolveEventImagePath(type: string, metadata?: unknown): string {
    return `/assets/calendar/${resolveEventImageFile(type, metadata)}`;
}

/**
 * Chemin public de l'illustration dédiée d'un raid — sélecteur « Type de Raid »
 * du formulaire d'événement (jamais une image distante : une seule source).
 */
export function raidImagePath(raidType: "gigalodon" | "jardin"): string {
    return `/assets/calendar/${RAID_IMAGES[raidType]}`;
}

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

// ---------------------------------------------------------------------------
// Illustrations RÉELLES (donjon / titan / Kralamoure)
// ---------------------------------------------------------------------------

/**
 * Illustration réelle du Kralamoure : le donjon « Antre du Kralamoure Géant ».
 * Mesuré en base le 04/11/2026 — `Dungeon.imageUrl` porte exactement ce chemin
 * (c'est l'asset servi par la bêta). Le visuel générique `calendar_kralamour.png`
 * reste le repli du type.
 */
export const KRALAMOURE_IMAGE_PATH = "/game-data/dungeons/antre-du-kralamoure-g-ant.webp";

/** Nature de la fiche dont il faut lire l'illustration réelle. */
export type EventIllustrationKind = "dungeon" | "titan";

export interface EventIllustrationRef {
    kind: EventIllustrationKind;
    name: string;
}

/**
 * Nom (donjon ou titan) dont l'illustration réelle doit être lue en base.
 *
 * Deux signaux, dans cet ordre :
 * 1. `metadata.source.mode` (`DONJON` | `TITAN`) + `metadata.mirror.names` — l'autorité ;
 * 2. le **titre normalisé** produit par `djMirrorTitle` (`[Titan] Gargandyas`,
 *    `[DJ] Donjon des Squelettes`) — les miroirs historiques peuvent avoir perdu
 *    leur metadata, et le préfixe est un format de l'app, pas une devinette.
 *
 * Tout le reste (quête, défi, event manuel libre, tournée multi-donjons) rend `null`
 * → l'écran garde le visuel du type.
 */
export function eventIllustrationRef(metadata?: unknown, title?: string | null): EventIllustrationRef | null {
    const meta = metadata as
        | { source?: { mode?: unknown }; mirror?: { names?: unknown } }
        | null
        | undefined;
    const mode = meta?.source?.mode;

    if (mode === "DONJON" || mode === "TITAN") {
        const names = meta?.mirror?.names;
        const first = Array.isArray(names)
            ? names.find((value) => typeof value === "string" && value.trim().length > 0)
            : null;
        if (typeof first === "string") {
            // Borne identique au miroir (`names` déjà tronqué à 80) : une valeur aberrante
            // ne doit pas partir telle quelle dans une requête.
            return { kind: mode === "TITAN" ? "titan" : "dungeon", name: first.trim().slice(0, 80) };
        }
    }

    // Repli titre : `djMirrorTitle` écrit « [Titan] <nom> » / « [DJ] <nom> ».
    const match = /^\[(Titan|DJ)\]\s+(.+)$/.exec((title ?? "").trim());
    if (!match) return null;
    const name = match[2].trim().slice(0, 80);
    if (!name) return null;
    return { kind: match[1] === "Titan" ? "titan" : "dungeon", name };
}

/** Un événement Kralamoure (type dédié ou import Metamob) porte l'illustration du donjon. */
export function isKralamoureEvent(type: string, metadata?: unknown): boolean {
    if (type === "KRALAMOURE") return true;
    return Boolean((metadata as { isKralamoure?: unknown } | null | undefined)?.isKralamoure);
}


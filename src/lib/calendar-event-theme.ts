/**
 * Identité visuelle d'un type d'événement du calendrier — **source unique**.
 *
 * Constat user du 19/09/2026 (« deslop IA ») : la MÊME table était recopiée dans
 * six composants (`event-detail-modal`, `event-card`, `calendar-grid`,
 * `calendar-dashboard`, `upcoming-events-widget`, `featured-events-carousel`) avec,
 * à chaque fois, son icône **lucide** de remplacement et son « dégradé » décoratif
 * — d'où des pictos qui divergeaient d'un écran à l'autre et l'effet « maquette IA ».
 *
 * Ici : un type = un libellé + une couleur sémantique + **un picto Dofus réel**
 * (référentiel `DofusUiIcon`, `public/assets/dofus/icons/`). Aucun gradient, aucune
 * icône générique : « une notion = un picto, partout ».
 *
 * Module **pur** (aucune I/O) — testé unitairement.
 */

import type { DofusUiIconName } from "@/components/shared/dofus-ui-icon";

export type CalendarEventTypeTheme = {
    /** Libellé complet (« Raid 3.6 », « Missions Guilde »…). */
    label: string;
    /** Libellé court pour les filtres et pastilles (« Raid 3.6 », « Missions »…). */
    shortLabel: string;
    /** Picto Dofus du type (jamais un emoji, jamais une icône générique). */
    picto: DofusUiIconName;
    /** Texte coloré (tokens sémantiques uniquement). */
    color: string;
    /** Aplat de fond. */
    bg: string;
    /** Bordure. */
    border: string;
    /** Pastille pleine (légende, liseré, barre d'accent). */
    dot: string;
};

const THEMES: Record<string, CalendarEventTypeTheme> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        shortLabel: "Raid 3.6",
        picto: "dungeon",
        color: "text-danger",
        bg: "bg-danger/10",
        border: "border-danger/20",
        dot: "bg-danger",
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        shortLabel: "Event Guilde",
        picto: "guild",
        color: "text-info",
        bg: "bg-info/10",
        border: "border-info/20",
        dot: "bg-info",
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        shortLabel: "Missions",
        picto: "quest",
        color: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
        dot: "bg-warning",
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        shortLabel: "Farm",
        picto: "chest",
        color: "text-success",
        bg: "bg-success/10",
        border: "border-success/20",
        dot: "bg-success",
    },
    KRALAMOURE: {
        label: "Kralamoure",
        shortLabel: "Kralamoure",
        picto: "monster",
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        border: "border-pink-500/20",
        dot: "bg-pink-500",
    },
    OTHERS: {
        label: "Autres",
        shortLabel: "Autres",
        picto: "calendar",
        color: "text-muted-foreground",
        bg: "bg-muted/10",
        border: "border-border/20",
        dot: "bg-muted",
    },
};

/** Tous les types couverts (ordre d'affichage stable). */
export const CALENDAR_EVENT_THEME_TYPES = Object.keys(THEMES);

/**
 * Thème d'un type d'événement. Type inconnu / `null` ⇒ repli `OTHERS`
 * (jamais d'`undefined` à l'écran, jamais un faux « Event Guilde »).
 */
export function calendarEventTheme(type: string | null | undefined): CalendarEventTypeTheme {
    if (!type) return THEMES.OTHERS;
    return THEMES[type] ?? THEMES.OTHERS;
}

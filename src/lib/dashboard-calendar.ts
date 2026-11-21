import { addDays, startOfWeek } from "date-fns";

/**
 * Règle PURE de la carte « calendrier » du dashboard : à partir d'une **seule** liste
 * d'événements (lue en une requête), dériver les trois besoins de la page d'accueil :
 * - `weekEvents` : les événements de la semaine en cours (widget Agenda) ;
 * - `activeRaid` : le raid officiel actif (démarré avant ou pendant la semaine) ;
 * - `focusEvent` : l'événement majeur dans les prochaines 24 h (carte Focus).
 *
 * Le serveur ne fait qu'une lecture `GuildEvent` ; cette fonction remplace les trois
 * requêtes historiques (`getUpcomingEvents`, `getActiveRaid`, focus).
 */
export type DashboardCalendarEventLike = {
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
};

const byStartAsc = (a: DashboardCalendarEventLike, b: DashboardCalendarEventLike) =>
    a.startDate.getTime() - b.startDate.getTime();

export function deriveDashboardCalendar<T extends DashboardCalendarEventLike>(
    events: readonly T[],
    now: Date,
): { weekEvents: T[]; activeRaid: T | null; focusEvent: T | null } {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
    const focusHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const weekEvents = events
        .filter(
            (event) =>
                event.status === "PUBLISHED" &&
                event.startDate >= weekStart &&
                event.startDate < weekEnd &&
                event.endDate >= now,
        )
        .sort(byStartAsc)
        .slice(0, 20);

    // Plusieurs raids peuvent se chevaucher : le serveur prenait le plus récent (startDate desc).
    const activeRaid =
        events
            .filter(
                (event) =>
                    event.type === "RAID_OFFICIAL" &&
                    event.status === "PUBLISHED" &&
                    event.startDate <= now &&
                    event.endDate >= now,
            )
            .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;

    // Le focus prenait le premier événement à venir (startDate asc) dans les 24 h.
    const focusEvent =
        events
            .filter(
                (event) =>
                    event.status === "PUBLISHED" &&
                    event.startDate <= focusHorizon &&
                    event.endDate >= now &&
                    (event.type === "RAID_OFFICIAL" || event.type === "EVENT_GUILD"),
            )
            .sort(byStartAsc)[0] ?? null;

    return { weekEvents, activeRaid, focusEvent };
}

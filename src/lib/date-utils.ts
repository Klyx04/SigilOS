import { getISOWeek, getISOWeekYear, subHours } from "date-fns";

/**
 * Get the current Dofus ISO week number and year.
 * The week changes on Tuesday at 07:00 Paris time.
 */
export function getDofusWeek(): { week: number; year: number } {
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" });
    const parisDate = new Date(nowStr);

    // ISO week resets on Monday at 00:00.
    // By subtracting 31 hours (24h + 7h) from Paris time,
    // anything before Tue 07:00 falls into Sunday (previous ISO week)
    // and anything after falls into Monday (current ISO week).
    const shifted = subHours(parisDate, 31);

    return {
        week: getISOWeek(shifted),
        year: getISOWeekYear(shifted)
    };
}

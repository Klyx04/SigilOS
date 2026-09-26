import { getISOWeek, getISOWeekYear, subHours, addDays, setHours, setMinutes, setSeconds, format } from "date-fns";

/**
 * Get the current Dofus ISO week number and year.
 * The week changes on Tuesday at 07:00 Paris time.
 */
export function getDofusWeek(date: Date = new Date()): { week: number; year: number } {
    const nowStr = date.toLocaleString("en-US", { timeZone: "Europe/Paris" });
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

/**
 * Returns the next Tuesday at 07:00 (Dofus Reset Time)
 */
export function getNextDofusReset(): Date {
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" });
    const parisNow = new Date(nowStr);
    const dayOfWeek = parisNow.getDay(); // 0:Sun, 1:Mon, 2:Tue...
    
    let nextTuesday = setSeconds(setMinutes(setHours(parisNow, 7), 0), 0);
    const diff = (2 - dayOfWeek + 7) % 7;

    // If it's already Tuesday and we are past 07:00, the next reset is next week.
    if (diff === 0 && parisNow.getHours() >= 7) {
        nextTuesday = addDays(nextTuesday, 7);
    } else {
        nextTuesday = addDays(nextTuesday, diff);
    }
    
    return nextTuesday;
}

/**
 * Valeur pour un sélecteur date+heure LOCALE (« YYYY-MM-DDTHH:mm »).
 *
 * Pourquoi pas `toISOString().slice(0, 16)` : `toISOString` rend l'heure **UTC**,
 * réinjectée ensuite comme heure locale → l'heure reculait du décalage à chaque
 * enregistrement, et une date proche de minuit **changeait de jour** (« le jour et
 * l'heure figés à minuit »). On lit donc les composantes locales.
 */
export function toLocalDateTimeInput(value: Date | string | null | undefined): string {
    if (value == null || value === "") return "";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formats a date range for the Discord embed title (Du DD/MM au DD/MM 07h)
 */
export function formatDofusRange(): string {
    const now = new Date();
    const nextReset = getNextDofusReset();
    
    return `du ${format(now, "dd/MM")} au ${format(nextReset, "dd/MM")} (07h)`;
}

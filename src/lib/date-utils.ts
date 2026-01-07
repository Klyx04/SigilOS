/**
 * Date Utilities for SigilOS
 */

/**
 * Get the current ISO week number and year.
 */
export function getWeekNumber(): { week: number; year: number } {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return { week, year: now.getFullYear() };
}

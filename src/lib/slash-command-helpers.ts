/**
 * Helpers purs des slash commands Discord (sans I/O — testables unitairement).
 */

/** Normalisation insensible casse/accents pour la recherche (métiers, monstres…). */
export function normSearch(value: string): string {
    return (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/** Date civile Europe/Paris au format YYYY-MM-DD (sans dépendance timezone). */
export function parisCivilDate(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Parse l'option `date` de /almanax : "JJ/MM/AAAA" (année optionnelle).
 * Retourne YYYY-MM-DD ou null si invalide. `now` injectable pour les tests.
 */
export function parseAlmanaxDateInput(
    input: string | undefined | null,
    now: Date = new Date()
): string | null {
    if (!input || !input.trim()) return parisCivilDate(now);

    const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!m) return null;

    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3] ? Number(m[3]) : Number(parisCivilDate(now).slice(0, 4));

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    // Garde anti-jour-imaginaire (ex. 31/02 → 03/03).
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}

/** Libellé français long d'une date YYYY-MM-DD ("mardi 9 septembre"). */
export function frenchLongDate(isoDate: string): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    if (!y || !m || !d) return isoDate;
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

/**
 * Règles **pures** d'indexation (aucun import serveur : testables unitairement).
 *
 * Mesuré le 29/09/2026 (`curl` sur la bêta, avant correctif) :
 *  - le `sitemap.xml` publiait un `<lastmod>` **dans le futur** (2 guides annoncés au 02/10 alors
 *    que le sitemap était généré le 29/09) — Google ignore une date future, et un `lastmod` non
 *    fiable finit par être ignoré pour **tout** le sitemap (constat du 21/09/2026) ;
 *  - `/almanax/<date>` acceptait **n'importe quelle date** (`1999-01-01` → 200, `2030-01-01` → 200)
 *    et servait une **coquille vide** en `200 index, follow` (« Donnée temporairement
 *    indisponible ») : des milliers d'URL vides indexables, exactement ce que Search Console
 *    classe « Explorée, actuellement non indexée ».
 *
 * La source Almanax (dofusdu.de, `range[size]=30`) ne sert que le **jour courant → +29 jours**
 * (heure civile Europe/Paris) et **ignore** `range[date]` : mesuré le 29/09, une requête
 * `range[date]=2015-01-01` renvoie… les jours du jour. Le passé n'existe donc pas côté source :
 * une page de date passée n'a rien à montrer, elle doit **404** et non publier une page vide.
 */
import { parisCivilDate } from "./slash-command-helpers";

/** Fenêtre réellement servie par la source Almanax (`range[size]=30`). */
export const ALMANAX_SOURCE_WINDOW_DAYS = 30;

/**
 * Date de modification **publiable** dans le sitemap : jamais postérieure à maintenant.
 *
 * Un `/guides/<slug>` portant `updatedAt` au 02/10 (le raid est sorti plus tard) suffisait à
 * publier une date future ; on la ramène à l'instant de génération plutôt que de la publier.
 */
export function clampLastModified(date: Date, now: Date = new Date()): Date {
    const time = Number.isFinite(date.getTime()) ? date.getTime() : now.getTime();
    return new Date(Math.min(time, now.getTime()));
}

/** Dernier jour servi par la source, calculé depuis le jour civil courant (`YYYY-MM-DD`). */
export function almanaxWindowLastDay(
    today: string = parisCivilDate(),
    days: number = ALMANAX_SOURCE_WINDOW_DAYS,
): string {
    const [year, month, day] = today.split("-").map(Number);
    const last = new Date(Date.UTC(year, month - 1, day + days - 1));
    return last.toISOString().slice(0, 10);
}

/**
 * Ce jour d'Almanax peut-il être servi (donc publié, donc indexable) ?
 *
 * Fenêtre = jour civil courant (Europe/Paris) → `+29 jours`. Hors fenêtre, la donnée n'existe
 * pas : la page répond **404**, jamais une coquille vide en 200.
 */
export function isServableAlmanaxDay(day: string, now: Date = new Date()): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const today = parisCivilDate(now);
    return day >= today && day <= almanaxWindowLastDay(today);
}

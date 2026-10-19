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

/* ------------------------------------------------------------------------------------------------
 * Extraits SERP — bornés, jamais coupés au milieu d'un mot par Google.
 *
 * Mesure du 19/10/2026 (export Search Console de la bêta, 01/08 → 17/10 : 6 156 impressions,
 * 109 clics, CTR 1,77 %) :
 *  - les **fiches boss** pesaient 1 715 impressions pour **4 clics** (0,23 %) et leur titre
 *    dépassait **90 caractères** ⇒ Google n'en affichait que la moitié, précisément la partie
 *    qui donne envie de cliquer ;
 *  - `/almanax` : 479 impressions pour **1 clic** (0,21 %) ;
 *  - le guide « créer une guilde » : **933 impressions pour 6 clics** (0,64 %).
 * Le nom cherché doit rester **en tête** ; le qualificatif est ce qu'on sacrifie en premier.
 * ---------------------------------------------------------------------------------------------- */

/** Longueur maximale d'un titre réellement affiché dans les résultats Google (~580 px). */
export const SERP_TITLE_MAX_LENGTH = 60;

/** Longueur maximale d'une description réellement affichée (au-delà, Google coupe). */
export const SERP_DESCRIPTION_MAX_LENGTH = 155;

/** Normalise les espaces : jamais deux de suite, jamais en bord. */
function normalizeSerpText(text: string): string {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Coupe sur un **mot entier**, sans ellipse : Google ajoute la sienne et un « … » consomme un
 * caractère utile. La ponctuation pendante en fin de coupe est retirée.
 */
export function truncateAtWord(text: string, max: number): string {
    const clean = normalizeSerpText(text);
    if (clean.length <= max) return clean;
    // `+ 1` : on garde la frontière du mot qui commence juste après la limite.
    const window = clean.slice(0, max + 1);
    const lastSpace = window.lastIndexOf(" ");
    const cut = lastSpace > 0 ? window.slice(0, lastSpace) : clean.slice(0, max);
    return cut.replace(/[\s,;:.·—–-]+$/, "");
}

/**
 * Compose un titre SERP à partir de trois éléments, en dégradant dans cet ordre :
 *  1. tout tient → `nom suffixe — qualificatif` ;
 *  2. le qualificatif ne tient pas → `nom suffixe` ;
 *  3. même le suffixe (niveau) ne tient pas → le **nom seul**, coupé sur un mot.
 *
 * Le nom passe toujours avant : c'est la requête que le joueur tape.
 */
export function composeSerpTitle(
    name: string,
    suffix: string,
    qualifier: string,
    max: number = SERP_TITLE_MAX_LENGTH,
): string {
    const cleanName = normalizeSerpText(name);
    const cleanSuffix = normalizeSerpText(suffix);
    const cleanQualifier = normalizeSerpText(qualifier);
    const withSuffix = `${cleanName}${cleanSuffix ? ` ${cleanSuffix}` : ""}`.trim();
    const full = cleanQualifier ? `${withSuffix} — ${cleanQualifier}` : withSuffix;
    if (full.length <= max) return full;
    if (withSuffix && withSuffix.length <= max) return withSuffix;
    return truncateAtWord(cleanName || cleanQualifier, max);
}

/** Description SERP bornée, coupée sur un mot (aucune phrase fantôme). */
export function clampSerpDescription(
    text: string,
    max: number = SERP_DESCRIPTION_MAX_LENGTH,
): string {
    return truncateAtWord(text, max);
}

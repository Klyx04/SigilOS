/**
 * Télémétrie — règles **publiques** pures (D-2bis, itération 6 : la partie externe).
 *
 * Le module God ne mesurait que le **dedans** du produit (guildes connectées). Le site public —
 * accueil, guides, carte du monde, almanax, fiches boss, annuaire des guildes — ne comptait rien :
 * ni nos pages, ni un outil tiers (aucun Umami / Plausible / Google Analytics dans le projet).
 *
 * Ce fichier pose ce qu'on a le **droit** de compter, sans cookie, sans consentement, sans bandeau :
 * - une **allowlist** d'écrans publics (une route nouvelle n'est jamais comptée par surprise) ;
 * - un compteur **agrégé par jour et par écran** : aucune adresse, aucun identifiant, aucun
 *   user-agent conservé (le user-agent est **lu** pour écarter les robots, jamais stocké) ;
 * - une règle cardinale : ces compteurs ne sont **jamais** joints à `TelemetryEvent` (identifié).
 *   Deux mondes séparés (`docs/ROADMAP.md` § D).
 *
 * ⚠️ Ce qu'un tel compteur ne peut **pas** dire : visiteurs uniques, sessions, provenance. Sans
 * identifiant, on compte des **requêtes**, pas des personnes — et l'écran doit l'écrire ainsi.
 */

/** Jours de rétention des compteurs publics. */
export const PUBLIC_COUNTER_TTL_DAYS = 400;

/**
 * Nombre minimal de vues (sur la fenêtre lue) avant qu'un écran soit publié individuellement.
 * En dessous, l'écran est regroupé dans « autres écrans » : sur un site jeune, une ligne
 * « 1 vue » par page est du bruit, et un écran quasi désert n'a pas à être exposé.
 */
export const MIN_PUBLIC_VIEWS_TO_PUBLISH = 25;

export interface PublicScreenRule {
    /** Clé stable (identifiant du compteur). */
    readonly key: string;
    /** Libellé affiché. */
    readonly label: string;
    /** Préfixes de chemin (le plus spécifique d'abord). */
    readonly prefixes: readonly string[];
}

/**
 * Écrans publics suivis. **Allowlist** : tout chemin absent n'est pas compté (et ne crée donc
 * aucune clé Redis). L'ordre n'a pas d'importance (les préfixes ne se recoupent pas).
 */
export const PUBLIC_SCREEN_RULES: readonly PublicScreenRule[] = [
    { key: "accueil", label: "Accueil (landing)", prefixes: ["/"] },
    { key: "guides", label: "Guides", prefixes: ["/guides"] },
    { key: "carte", label: "Carte du monde", prefixes: ["/carte-du-monde"] },
    { key: "almanax", label: "Almanax", prefixes: ["/almanax"] },
    { key: "boss", label: "Fiches de boss", prefixes: ["/boss"] },
    { key: "raids", label: "Raids", prefixes: ["/raids"] },
    { key: "annuaire", label: "Annuaire des guildes", prefixes: ["/guilds"] },
    { key: "modules", label: "Vitrine des modules", prefixes: ["/modules"] },
    { key: "docs", label: "Documentation", prefixes: ["/docs"] },
    { key: "changelog", label: "Journal des versions", prefixes: ["/changelog"] },
    { key: "statut", label: "Statut public", prefixes: ["/status"] },
    { key: "demo", label: "Démo publique", prefixes: ["/demo"] },
];

/**
 * Écran public d'un chemin, ou `null` si le chemin n'est pas dans l'allowlist.
 * La query et le fragment sont ignorés : `/guides?onglet=x` reste `guides`.
 */
export function publicScreenKey(path: string | null | undefined): string | null {
    if (!path || !path.startsWith("/")) return null;

    const pathname = path.split("?")[0]?.split("#")[0] ?? "";
    // `/` (accueil) est le seul cas où le chemin est exactement la racine.
    if (pathname === "/") return "accueil";

    for (const rule of PUBLIC_SCREEN_RULES) {
        if (rule.key === "accueil") continue;
        if (rule.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            return rule.key;
        }
    }

    return null;
}

/** Ce chemin est-il un écran public suivi ? (garde du beacon, testable sans Next) */
export function isPublicTrackedPath(path: string | null | undefined): boolean {
    return publicScreenKey(path) !== null;
}

/** Libellé d'un écran ; une clé inconnue est rendue telle quelle (jamais un libellé inventé). */
export function publicScreenLabel(key: string): string {
    return PUBLIC_SCREEN_RULES.find((rule) => rule.key === key)?.label ?? key;
}

/** Clé de jour UTC `AAAA-MM-JJ` (les compteurs sont agrégés par jour, jamais par heure). */
export function dayKeyUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** Les `days` derniers jours UTC, du plus ancien au plus récent. */
export function listDayKeysUTC(end: Date, days: number): string[] {
    const total = Math.trunc(days);
    if (!Number.isFinite(total) || total <= 0) return [];

    const keys: string[] = [];
    for (let index = total - 1; index >= 0; index--) {
        keys.push(dayKeyUTC(new Date(end.getTime() - index * 86400000)));
    }
    return keys;
}

const PUBLIC_COUNTER_NAMESPACE = "stats:public";

/** Clé Redis d'un compteur : `stats:public:<jour>:<écran>`. */
export function publicCounterKey(day: string, screen: string): string {
    return `${PUBLIC_COUNTER_NAMESPACE}:${day}:${screen}`;
}

/** Toutes les clés Redis d'un jour, pour la lecture groupée (`mget`). */
export function publicCounterKeysForDay(day: string): string[] {
    return PUBLIC_SCREEN_RULES.map((rule) => publicCounterKey(day, rule.key));
}

/**
 * Robots et outils : leurs requêtes ne sont pas des visites. Le user-agent est **lu ici et
 * jamais conservé** — c'est le seul usage qu'on en fait.
 */
const BOT_PATTERN =
    /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegrambot|discordbot|googlebot|gptbot|ccbot|claudebot|perplexity|lighthouse|pagespeed|headlesschrome|phantomjs|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baiduspider|uptimerobot|pingdom|curl|wget|python-requests|axios|node-fetch|go-http-client|java\//i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
    if (!userAgent) return true; // sans user-agent, on ne compte pas (l'absence est anormale)
    return BOT_PATTERN.test(userAgent);
}

export interface PublicViewRow {
    readonly screen: string;
    readonly views: number;
}

export interface PublicViewSplit {
    /** Écrans publiés individuellement, du plus vu au moins vu. */
    readonly published: PublicViewRow[];
    /** Écrans sous le seuil : comptés, jamais listés individuellement. */
    readonly withheld: { readonly screens: number; readonly views: number };
    /** Seuil utilisé (rappelé tel quel par l'écran). */
    readonly minViews: number;
}

/** Sépare les écrans publiables de ceux qui restent sous le seuil de publication. */
export function splitPublicViews(
    rows: readonly PublicViewRow[],
    minViews: number = MIN_PUBLIC_VIEWS_TO_PUBLISH
): PublicViewSplit {
    const threshold = Math.max(1, Math.trunc(minViews));
    const normalized = rows.map((row) => ({
        screen: row.screen,
        views: Number.isFinite(row.views) ? Math.max(0, Math.trunc(row.views)) : 0,
    }));

    const published = normalized
        .filter((row) => row.views >= threshold)
        .sort((a, b) => b.views - a.views || a.screen.localeCompare(b.screen));
    const withheldRows = normalized.filter((row) => row.views < threshold);

    return {
        published,
        withheld: {
            screens: withheldRows.length,
            views: withheldRows.reduce((total, row) => total + row.views, 0),
        },
        minViews: threshold,
    };
}

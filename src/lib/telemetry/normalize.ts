/**
 * Télémétrie — règles de **normalisation** pures (D-2).
 *
 * Pourquoi ce fichier existe : ces règles vivaient au fond de
 * `src/server/actions/telemetry-actions.ts` (`getModuleName` inline, `details` non bornés),
 * donc **non testables** et impossibles à réutiliser côté client (tracker). Une règle = une
 * fonction pure = un test (`tests/unit/telemetry-normalize.test.ts`).
 *
 * ⚠️ Aucune dépendance Prisma / Next : utilisable telle quelle dans un composant client.
 */

/**
 * Clés de `details` qui ne doivent **jamais** être persistées : elles reconstituent une empreinte
 * de navigateur (user-agent + taille d'écran ≈ identifiant persistant) ou sont des données
 * personnelles. Voir `docs/RULES.md` § Security et l'invariant « zéro empreinte ».
 */
export const TELEMETRY_DETAILS_DENYLIST: readonly string[] = [
    "useragent",
    "user-agent",
    "ua",
    "screen",
    "screensize",
    "viewport",
    "window",
    "platform",
    "ip",
    "ipaddress",
    "remoteaddr",
    "email",
    "token",
];

/** Nombre maximal de clés conservées dans `details`. */
export const TELEMETRY_DETAILS_MAX_KEYS = 6;

/** Longueur maximale d'une valeur texte de `details`. */
export const TELEMETRY_DETAILS_MAX_VALUE_LENGTH = 200;

/**
 * Nettoie `details` avant persistance : liste de clés interdites, valeurs bornées,
 * nombre de clés borné. Renvoie `{}` si l'entrée n'est pas un objet exploitable.
 */
export function sanitizeTelemetryDetails(details: unknown): Record<string, string | number | boolean> {
    if (!details || typeof details !== "object" || Array.isArray(details)) return {};

    const sanitized: Record<string, string | number | boolean> = {};
    for (const [rawKey, rawValue] of Object.entries(details as Record<string, unknown>)) {
        if (Object.keys(sanitized).length >= TELEMETRY_DETAILS_MAX_KEYS) break;

        const key = rawKey.trim().slice(0, 40);
        if (!key || TELEMETRY_DETAILS_DENYLIST.includes(key.toLowerCase())) continue;

        if (typeof rawValue === "string") {
            const value = rawValue.trim().slice(0, TELEMETRY_DETAILS_MAX_VALUE_LENGTH);
            if (value) sanitized[key] = value;
        } else if (typeof rawValue === "number") {
            if (Number.isFinite(rawValue)) sanitized[key] = rawValue;
        } else if (typeof rawValue === "boolean") {
            sanitized[key] = rawValue;
        }
    }

    return sanitized;
}

/** Module de repli quand aucun motif ne correspond. */
export const FALLBACK_MODULE = "Autre Module";

/** Module racine du dashboard. */
export const HOME_MODULE = "Accueil / Tableau de bord";

interface ModuleRule {
    readonly module: string;
    readonly contains: readonly string[];
}

/**
 * Motifs de chemin → module du dashboard. **L'ordre compte** (premier motif qui matche gagne) :
 * les motifs les plus spécifiques viennent d'abord.
 */
const MODULE_RULES: readonly ModuleRule[] = [
    { module: "Raid Hub", contains: ["/raids", "/rush"] },
    { module: "Marché", contains: ["/market"] },
    { module: "Galerie de Stuffs", contains: ["/stuff-gallery", "/stuffs"] },
    { module: "Almanax", contains: ["/almanax"] },
    { module: "Boutique", contains: ["/shop"] },
    { module: "Quêtes & Succès", contains: ["/quests", "/dofus"] },
    { module: "Mini-Jeux", contains: ["/minigames", "/games"] },
    { module: "Roster & Membres", contains: ["/members", "/roster"] },
    { module: "Administration God", contains: ["/god"] },
    { module: "Configuration", contains: ["/settings", "/config"] },
];

/** Chemin → module lisible. Un chemin vide n'appartient à aucun module (`Général`). */
export function resolveModule(path: string | null | undefined): string {
    if (!path) return "Général";

    const rule = MODULE_RULES.find((candidate) => candidate.contains.some((needle) => path.includes(needle)));
    if (rule) return rule.module;

    if (path === "/" || path.includes("/dashboard")) return HOME_MODULE;

    return FALLBACK_MODULE;
}

/** Segments d'identifiant : CUID, snowflake Discord, UUID. */
const ID_SEGMENT = /^(c[a-z0-9]{20,}|\d{15,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Clés de requête jamais conservées (jetons, codes, adresses). */
const QUERY_DENYLIST: readonly string[] = ["token", "code", "email", "secret", "key"];

/** Longueur maximale d'un motif de chemin conservé. */
export const PATH_PATTERN_MAX_LENGTH = 120;

/**
 * Identifiant de télémétrie d'une entrée de navigation : **indépendant de la guilde**.
 * `/dashboard/<guildId>/missions` → `nav:missions` · `/dashboard/<guildId>` → `nav:dashboard`
 * · `/dashboard/<guildId>/admin/settings` → `nav:admin-settings`.
 *
 * Le segment `[guildId]` est toujours retiré (même règle que `normalizePathPattern`) : sans cela
 * chaque guilde produirait sa propre clé et aucun regroupement ne serait possible.
 */
export function navTelemetryId(href: string | null | undefined): string {
    if (!href) return "nav:unknown";

    const [base] = href.split("?");
    const segments = base.split("/").filter(Boolean);
    const dashboardIndex = segments.indexOf("dashboard");

    // Hors `/dashboard/**`, le chemin est pris tel quel (`/god`, `/docs`…).
    if (dashboardIndex === -1) return `nav:${segments.join("-") || "unknown"}`;

    // `segments[dashboardIndex + 1]` est le paramètre dynamique `[guildId]` : jamais exposé.
    const rest = segments.slice(dashboardIndex + 2);
    return `nav:${rest.join("-") || "dashboard"}`;
}

/**
 * Réduit un chemin à son **motif** : identifiants remplacés par `:id`, query filtrée.
 * `/dashboard/cm3abc…/missions?tab=x` → `/dashboard/:id/missions?tab=x`.
 * Indispensable pour que les clics capturés automatiquement ne créent pas une clé par guilde.
 */
export function normalizePathPattern(path: string | null | undefined): string {
    if (!path) return "/";

    const [rawPathname, rawQuery] = path.split("?");
    const pathname = rawPathname
        .split("/")
        .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
        .join("/");

    const segments = (rawQuery || "")
        .split("&")
        .filter(Boolean)
        .filter((pair) => {
            const key = pair.split("=")[0]?.toLowerCase() ?? "";
            return !QUERY_DENYLIST.includes(key);
        });

    const query = segments.length > 0 ? `?${segments.join("&")}` : "";
    return `${pathname || "/"}${query}`.slice(0, PATH_PATTERN_MAX_LENGTH);
}

/** Préfixes de chemin qui ne sont **jamais** instrumentés (auto-monitoring exclu). */
const IGNORED_PREFIXES: readonly string[] = ["/god", "/api", "/_next", "/overlay"];

/**
 * Un chemin doit-il être instrumenté ? Garde partagée tracker ↔ tests : le panneau God
 * ne se surveille pas lui-même et les routes techniques ne polluent pas les statistiques.
 */
export function isTrackedPath(path: string | null | undefined): boolean {
    if (!path || !path.startsWith("/")) return false;
    return !IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Un identifiant de clic a-t-il été produit automatiquement (donc non instrumenté) ? */
export function isAutoTrackedElementId(elementId: string | null | undefined): boolean {
    return !!elementId && elementId.startsWith("auto:");
}

/** Préfixe des identifiants produits **automatiquement** par le tracker (élément non instrumenté). */
const AUTO_ID_PATTERN = /^auto:(button|a|nav|input|div|span):/i;

/** Espaces de noms des identifiants posés à la main (`data-telemetry-id`). */
const INSTRUMENTED_ID_PATTERN = /^(nav|action|module):(.+)$/i;

/**
 * Identifiant technique → libellé lisible dans l'écran God.
 * `auto:button:claim-reward` → `Claim reward` · `nav:missions` → `Missions`
 * · `auto:nav:/dashboard/:id/missions` → le motif de chemin tel quel.
 */
export function humanizeElementId(elementId: string | null | undefined): string {
    if (!elementId) return "Élément non identifié";

    const instrumented = INSTRUMENTED_ID_PATTERN.exec(elementId);
    const raw = (instrumented ? instrumented[2] : elementId.replace(AUTO_ID_PATTERN, "")).trim();
    if (raw.startsWith("/")) return raw;

    const words = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!words) return elementId;

    return words.charAt(0).toUpperCase() + words.slice(1);
}

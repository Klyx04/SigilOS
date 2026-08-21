import { randomBytes } from "crypto";

/**
 * CSP nonce-based — Construction de la politique de sécurité de contenu.
 *
 * But : retirer `'unsafe-inline'` de `script-src` en le remplaçant par un nonce
 * aléatoire par requête. Next.js 16 gère nativement ce nonce : il lit la CSP de
 * la REQUÊTE entrante (`content-security-policy` OU
 * `content-security-policy-report-only`) via `getScriptNonceFromHeader()`
 * (node_modules/next/dist/server/app-render/get-script-nonce-from-header.js)
 * et l'applique à ses scripts d'hydratation inline.
 *
 * Le proxy (src/proxy.ts) est responsable d'injecter la CSP dans la requête
 * (pour Next) ET dans la réponse (pour le navigateur). Ce module est purement
 * descriptif : il ne fait AUCUN I/O et peut être testé unitairement.
 *
 * Mode : `CSP_ENFORCE=true` → header `Content-Security-Policy` (enforce).
 * Sinon (défaut, recommandé pendant la transition) →
 * `Content-Security-Policy-Report-Only` : le navigateur ne bloque rien,
 * il signale les violations à /api/csp-report.
 */

export type CspMode = "report-only" | "enforce";

export const CSP_HEADER_ENFORCE = "Content-Security-Policy";
export const CSP_HEADER_REPORT_ONLY = "Content-Security-Policy-Report-Only";

/**
 * Génère un nonce aléatoire par requête (16 octets, base64url — zéro padding).
 * Le pool de caractères contient uniquement [A-Za-z0-9_-] → compatible avec le
 * regex de Next `CSP_NONCE_SOURCE_REGEX` (/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/).
 */
export function generateCspNonce(): string {
    return randomBytes(16).toString("base64url");
}

interface BuildCspOptions {
    nonce: string;
    enforce: boolean;
}

/**
 * Construit la CSP complète.
 *
 * ⚠️ `style-src 'unsafe-inline'` DOIT rester : Next.js en a besoin pour son
 * injection de styles au runtime. On ne retire QUE `'unsafe-inline'` de
 * `script-src`.
 */
export function buildCsp({ nonce, enforce }: BuildCspOptions): {
    headerName: string;
    headerValue: string;
    mode: CspMode;
} {
    const isProd = process.env.NODE_ENV === "production";

    // ─── img-src — adapté à next.config.ts remotePatterns ───────────────────
    const imgSrc = [
        "'self'",
        "data:",
        "blob:",
        "https://cdn.discordapp.com",
        "https://metamob.fr https://www.metamob.fr",
        "https://api.dofusdu.de https://api.dofusdb.fr",
        "https://dofusdb.s3.eu-west-3.amazonaws.com https://dofusdb.fr https://static.dofusdb.fr",
        "https://www.dofusbook.net https://static.dofusbook.net https://s.d-bk.net",
        "https://static.ankama.com https://www.ankama.com https://www.dofus.com",
        "https://www.dofuspourlesnoobs.com",
        "https://static-cdn.jtvnw.net",
        "https://i.ytimg.com",
        "https://dofusskinmanga.com",
        "https://barbofus.com https://www.barbofus.com https://static.barbofus.com",
        "https://www.google.com https://*.gstatic.com",
        "https://ganymede-dofus.com https://ganymede-app.com",
        "https://cdn.static.dofensive.com", // icônes de sorts Dofensive (fiches boss / simulation)
        "https://images.unsplash.com",
        "https://i.imgur.com",
        "https://unavatar.io", // avatars Createurs (YT/Twitch)
        "https://media.discordapp.net", // miroir fallback avatars Discord (#23)
    ].join(" ");

    // ─── connect-src — Sentry (loader + tunnel) + WebSocket ────────────────
    const connectSrc = [
        "'self'",
        "https://*.sentry.io https://sentry.io",
        "wss://*.sigilos.fr wss://localhost:*",
    ].join(" ");

    // ─── script-src — nonce-based, PLUS aucun 'unsafe-inline' ──────────────
    // 'unsafe-eval' uniquement en dev (comme avant). Sentry loader externe.
    const scriptSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        ...(isProd ? [] : ["'unsafe-eval'"]),
        "https://cdn.sentry.io",
    ].join(" ");

    const csp = [
        "default-src 'self'",
        // Next.js exige 'unsafe-inline' pour son injection de styles runtime — ne pas retirer.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        `script-src ${scriptSrc}`,
        `img-src ${imgSrc}`,
        `connect-src ${connectSrc}`,
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        // Strict: no iframes allowed (remplace X-Frame-Options: DENY)
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // Report CSP violations to our own structured endpoint (F-29)
        "report-uri /api/csp-report",
        "report-to csp-endpoint",
    ].join("; ");

    const mode: CspMode = enforce ? "enforce" : "report-only";
    const headerName = enforce ? CSP_HEADER_ENFORCE : CSP_HEADER_REPORT_ONLY;

    return { headerName, headerValue: csp, mode };
}
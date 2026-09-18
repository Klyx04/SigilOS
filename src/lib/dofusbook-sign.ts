import crypto from "node:crypto";

/**
 * Jeton d'accès **navigateur** au worker Dofusbook (`GET /s/{id}?e=<exp>&t=<hmac>`).
 *
 * Pourquoi ? Dofusbook (Cloudflare) refuse les appels dont le client d'origine est un
 * serveur (Node/.NET → 403/5xx « Attention Required! ») alors qu'un navigateur passe.
 * Le navigateur du membre appelle donc le worker avec ce jeton — le worker reste le
 * SEUL émetteur vers Dofusbook et l'IP du VPS n'est jamais exposée.
 *
 * Recette (identiquée côté worker dans `worker.js` → `hmacHex`) :
 *   message = `${buildId}.${exp}`   ·   token = HMAC_SHA256(secret, message) en hex
 * Secret : `DOFUSBOOK_WORKER_SIGN_SECRET` (repli : `DOFUSBOOK_WORKER_SECRET`).
 */
export const DOFUSBOOK_CLIENT_TOKEN_TTL_SECONDS = 300; // 5 min

function getSignSecret(): string | null {
    const secret = process.env.DOFUSBOOK_WORKER_SIGN_SECRET || process.env.DOFUSBOOK_WORKER_SECRET;
    return secret && secret.length > 0 ? secret : null;
}

export function signDofusbookClientToken(
    buildId: string,
    nowSeconds: number = Math.floor(Date.now() / 1000),
    ttlSeconds: number = DOFUSBOOK_CLIENT_TOKEN_TTL_SECONDS,
    secretOverride?: string
): { token: string; exp: number } | null {
    const secret = secretOverride || getSignSecret();
    if (!secret) return null;
    const exp = nowSeconds + ttlSeconds;
    const token = crypto.createHmac("sha256", secret).update(`${buildId}.${exp}`).digest("hex");
    return { token, exp };
}

export function verifyDofusbookClientToken(
    buildId: string,
    token: string,
    exp: number,
    nowSeconds: number = Math.floor(Date.now() / 1000),
    secretOverride?: string
): boolean {
    const secret = secretOverride || getSignSecret();
    if (!secret) return false;
    if (!Number.isFinite(exp) || exp <= nowSeconds) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${buildId}.${exp}`).digest("hex");
    const a = Buffer.from(String(token).toLowerCase(), "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** URL signée à appeler **depuis le navigateur** (null si non configuré). */
export function buildDofusbookClientFetchUrl(buildId: string): string | null {
    const base = process.env.DOFUSBOOK_CF_WORKER_URL;
    if (!base) return null;
    const signed = signDofusbookClientToken(buildId);
    if (!signed) return null;
    return `${base.replace(/\/+$/, "")}/s/${buildId}?e=${signed.exp}&t=${signed.token}`;
}

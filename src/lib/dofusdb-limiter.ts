/**
 * Phase 5.3 — Limiteur global anti-ban DofusDB (partagé par tous les siphons).
 *
 * Politesse réseau centralisée : fenêtre fixe par hôte dans Redis, respect du
 * `Retry-After` sur 429, compteur quotidien de 429 → alerte God "ralentir".
 * Jamais bloquant : Redis KO → on laisse passer (fail-open, log seul). Un
 * appelant ne doit JAMAIS crasher à cause du limiteur.
 */

const DEFAULT_LIMIT = 30; // requêtes / minute / hôte
const DEFAULT_WINDOW_MS = 60_000;
const MAX_WAIT_MS = 60_000; // Retry-After jusqu'à 60s (DofusDB peut demander 30-60s)
const RETRY_AFTER_CAP_MS = 120_000;
const COURTESY_WAIT_MS = process.env.NODE_ENV === "test" ? 0 : 5_000; // pause minimale si 429 sans Retry-After
const ALERT_THRESHOLD = 10; // 429/jour avant alerte God (une seule fois)

/** Parse `Retry-After` (secondes ou date HTTP) → ms, null si absent/invalide. */
export function parseRetryAfterMs(raw: string | null | undefined, nowMs = Date.now()): number | null {
    if (!raw) return null;
    const s = raw.trim();
    if (/^\d+$/.test(s)) {
        const ms = Number(s) * 1000;
        return ms > 0 ? Math.min(ms, RETRY_AFTER_CAP_MS) : null;
    }
    const t = Date.parse(s);
    if (Number.isFinite(t) && t > nowMs) {
        return Math.min(t - nowMs, RETRY_AFTER_CAP_MS);
    }
    return null;
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return "unknown";
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Redis peut pendre (connexion) : borne toute op Redis, fail-open au-delà. */
async function withRedisTimeout<T>(work: () => Promise<T>, ms = 500): Promise<T | null> {
    try {
        return await Promise.race([
            work(),
            sleep(ms).then((): null => null),
        ]);
    } catch {
        return null;
    }
}

async function getRedis(): Promise<{ incr(k: string): Promise<number>; expire(k: string, s: number): Promise<unknown>; set(k: string, v: string, mode: string, s: number): Promise<unknown> } | null> {
    try {
        const { redis } = await import("@/lib/redis");
        return redis as unknown as {
            incr(k: string): Promise<number>;
            expire(k: string, s: number): Promise<unknown>;
            set(k: string, v: string, mode: string, s: number): Promise<unknown>;
        };
    } catch {
        return null;
    }
}

/**
 * Prend un slot pour `host`. true = feu vert. false = quota épuisé (l'appelant
 * doit lever le pied : le wrapper `dofusDbFetch` attend puis rejoue une fois).
 */
export async function acquireSlot(
    host: string,
    opts: { limit?: number; windowMs?: number } = {}
): Promise<boolean> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    const allowed = await withRedisTimeout<boolean>(async () => {
        const redis = await getRedis();
        if (!redis) return true;
        const key = `dofusdb:bucket:${host}:${Math.floor(Date.now() / windowMs)}`;
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.expire(key, Math.ceil(windowMs / 1000) + 1);
        }
        return count <= limit;
    });
    return allowed ?? true;
}

/** Compte un 429 ; alerte God (une fois/jour) au-delà du seuil. */
export async function recordRateLimitHit(host: string): Promise<void> {
    const done = await withRedisTimeout<boolean>(
        async () => {
            const redis = await getRedis();
            if (!redis) return true;
            const day = new Date().toISOString().slice(0, 10);
            const count = await redis.incr(`dofusdb:429:${host}:${day}`);
            await redis.expire(`dofusdb:429:${host}:${day}`, 2 * 24 * 3600);
            if (count === ALERT_THRESHOLD) {
                const { notifyGod } = await import("@/server/actions/god-notif-actions");
                await notifyGod({
                    title: "⚠️ DofusDB nous rate-limite",
                    message: `${count} réponses 429 aujourd'hui pour ${host} : ralentir les siphons manuels, les crons restent espacés.`,
                    type: "SYSTEM",
                    success: false,
                });
            }
            return true;
        },
        800
    );
    void done;
}

/**
 * Fetch poli vers DofusDB & co : slot global → fetch → 429 honoré (Retry-After
 * + 1 seul rejeu) → compteur. Retourne toujours une Response (jamais de throw
 * pour cause de limite : quota épuisé = fausse 429 locale, les appelants
 * gèrent déjà `!res.ok`).
 */
export async function dofusDbFetch(input: string, init?: RequestInit): Promise<Response> {
    const host = hostOf(input);
    try {
        if (!(await acquireSlot(host))) {
            await sleep(2000);
            if (!(await acquireSlot(host))) {
                return new Response(JSON.stringify({ error: "rate-limited (local)" }), {
                    status: 429,
                    headers: { "content-type": "application/json" },
                });
            }
        }
    } catch {
        // Limiteur HS → on tente quand même le fetch.
    }

    let res: Response;
    try {
        res = await fetch(input, init);
    } catch (e) {
        throw e;
    }

    if (res.status === 429) {
        void recordRateLimitHit(host);
        const waitMs = parseRetryAfterMs(res.headers.get("retry-after"));
        // Si Retry-After présent et dans notre fenêtre : attendre + réessayer
        if (waitMs !== null && waitMs <= MAX_WAIT_MS) {
            await sleep(waitMs);
            try {
                const retry = await fetch(input, init);
                if (retry.status === 429) void recordRateLimitHit(host);
                return retry;
            } catch (e) {
                throw e;
            }
        }
        // Pas de Retry-After (ou trop long) : pause de courtoisie minimale
        // avant de remonter le 429 — laisse les boucles de siphon faire leur
        // propre backoff exponentiel sans bombarder l'API.
        await sleep(COURTESY_WAIT_MS);
    }
    return res;
}

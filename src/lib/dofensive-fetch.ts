/**
 * Couche de transport — API Dofensive (dofensive.com/api/dofus2/bestiary).
 *
 * Module serveur partagé par :
 *   - src/server/actions/dofensive-actions.ts (lectures à la demande, cache 24 h)
 *   - src/lib/dofensive-sync.ts (siphon local Prisma, crons)
 *
 * La garde anti-SSRF vit ICI (un seul endroit) : allowlist stricte des chemins
 * + ID entier strictement positif (toSafeId). Aucune URL n'est construite avec une
 * valeur non validée. Fail-closed : erreur réseau → null, le client garde son fallback.
 */
import { logger } from "@/lib/logger";

export const DOFENSIVE_BASE = "https://dofensive.com/api/dofus2/bestiary";

const DOFENSIVE_HEADERS = {
    Accept: "application/json",
    "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)",
};

// ── Garde anti-SSRF ─────────────────────────────────────────────────────────
// Les IDs (map/monstre/sort) peuvent provenir du client (query params ?boss=&dungeon=,
// sélecteur de salle, liste de sorts). On ne construit JAMAIS d'URL avec une valeur
// non validée : allowlist stricte des chemins Dofensive + ID entier strictement positif.
const DOFENSIVE_PATH_RE =
    /^\/?(?:dungeons\/preview\?lang=fr|maps\/\d+\?lang=fr|monsters\/\d+\?lang=fr|spells\/\d+\?lang=fr)$/;

/** Convertit un ID Dofensive en entier strictement positif, ou `null` si invalide (anti-SSRF). */
export function toSafeId(value: number | string | null | undefined): number | null {
    const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
}

export function norm(s: string): string {
    return String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’'`]/g, "'")
        .replace(/\s*\(\d+\)$/, "")
        .replace(/[\s\-_]+/g, " ")
        .trim();
}

const dofensiveCache = new Map<string, { data: unknown; expiresAt: number }>();
const DOFENSIVE_TTL = 24 * 60 * 60 * 1000; // 24 h — data de jeu statique

/**
 * Interrupteur de TEST DE PANNE (D6 de l'amorce « indépendance totale »).
 *
 * `DOFENSIVE_OFFLINE=1` coupe **tout** appel sortant vers Dofensive (bestiaire, maps,
 * sorts) : le fetcher refuse la requête (log + `null`). Permet de rejouer la panne du
 * 15/09/2026 en dev et de prouver qu'aucune LECTURE ne bascule sur le live.
 *
 * ⚠️ Réservé aux tests/dev (les siphons, eux, doivent joindre la source).
 */
export function isDofensiveOffline(): boolean {
    return String(process.env.DOFENSIVE_OFFLINE ?? "").trim() === "1";
}

/**
 * Fetch Dofensive avec garde SSRF (allowlist de chemins + IDs entiers) + cache 24 h.
 * `skipCache` force une lecture réseau fraîche (utilisé par les crons de sync).
 */
export async function dofensiveFetch<T>(path: string, key: string, skipCache = false): Promise<T | null> {
    // Garde de test : aucun appel sortant quand la panne est simulée.
    if (isDofensiveOffline()) {
        logger.warn(`[dofensive] mode OFFLINE (DOFENSIVE_OFFLINE=1) — appel refusé: ${path}`);
        return null;
    }
    // Garde SSRF : seul un chemin de l'allowlist (IDs entiers) peut atteindre fetch().
    if (!DOFENSIVE_PATH_RE.test(path)) {
        logger.error(`[dofensive] Chemin refusé (garde SSRF): ${path}`);
        return null;
    }
    if (!skipCache) {
        const cached = dofensiveCache.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.data as T;
    }

    try {
        const res = await fetch(`${DOFENSIVE_BASE}${path}`, {
            headers: DOFENSIVE_HEADERS,
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`Dofensive HTTP ${res.status}`);
        const json = (await res.json()) as { Data?: unknown; Errors?: unknown[] };
        const data = json?.Data ?? null;
        if (data !== null && data !== undefined && !skipCache) {
            dofensiveCache.set(key, { data, expiresAt: Date.now() + DOFENSIVE_TTL });
        }
        return data as T;
    } catch (error) {
        logger.warn(`[dofensive] Fetch échoué (${key}):`, { error: String(error) });
        return null;
    }
}

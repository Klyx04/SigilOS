import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Disjoncteur Dofusbook — partagé par la route proxy (`/api/dofusbook/proxy/[id]`)
 * et le bake (`getDofusbookPreview`).
 *
 * Dofusbook (derrière Cloudflare) refuse les clients « serveur » (Node/undici, .NET…)
 * alors qu'un navigateur passe : inutile de ré-essayer, et surtout **on protège l'IP du
 * VPS** (plus aucune requête directe vers dofusbook.net) et le quota du worker CF.
 * Quand un blocage est détecté, on ne rappelle plus rien pendant 15 min (cache servi).
 */
export const DOFUSBOOK_BLOCKED_KEY = "dofusbook:blocked-until";
export const DOFUSBOOK_BLOCKED_TTL = 900; // 15 min

/** Le disjoncteur est-il ouvert (Dofusbook bloque) ? Fail-open : Redis KO → false. */
export async function isDofusbookBreakerOpen(): Promise<boolean> {
    try {
        return Boolean(await redis.get(DOFUSBOOK_BLOCKED_KEY));
    } catch {
        return false;
    }
}

/** Ouvre/renouvelle le disjoncteur (best effort, jamais bloquant). */
export async function openDofusbookBreaker(reason: string): Promise<void> {
    try {
        await redis.set(DOFUSBOOK_BLOCKED_KEY, String(Date.now()), "EX", DOFUSBOOK_BLOCKED_TTL);
        logger.warn(`[Dofusbook] Disjoncteur ouvert ${DOFUSBOOK_BLOCKED_TTL}s`, { reason });
    } catch {
        /* non bloquant */
    }
}

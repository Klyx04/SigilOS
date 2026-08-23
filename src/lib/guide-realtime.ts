/**
 * GANYMEDE — Couche temps réel du module guide (Phase E).
 *
 * Même architecture que src/lib/socket-r4.ts (R4 god:revoked) :
 *   - le serveur Next.js (server actions) PUBLIE des events ici ;
 *   - le serveur WebSocket standalone (src/server/websocket/guide-presence.ts)
 *     s'abonne au canal `guide:${guildId}:${guideSlug}` et les diffuse à la
 *     room `guild:<guildId>:guide:<slug>` après batching (500ms).
 *
 * Fail-closed : si Redis/pub est indisponible, le publish échoue
 * silencieusement — le module garde ses props serveur figées en fallback
 * (jamais d'écran cassé).
 */
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/** Contrat de payload temps réel du guide (Phase 4 — GUIDE-DEMARRAGE). */
export type GuideRealtimeEvent =
  | { type: "presence:join"; profileId: string; userName: string; userAvatar?: string; milestoneId: string }
  | { type: "presence:leave"; profileId: string; userName?: string; milestoneId: string }
  | { type: "step:validated"; profileId: string; userName: string; userAvatar?: string; subGuideRef: string; stepNumber: number; stepTitle?: string }
  | { type: "step:validated:batch"; profileId: string; userName: string; subGuideRef: string; count: number }
  | { type: "milestone:completed"; profileId: string; userName: string; milestoneId: string; milestoneTitle: string };

/** Canal Redis d'un guide : `guide:${guildId}:${guideSlug}`. */
export function guideChannel(guildId: string, guideSlug: string): string {
  return `guide:${guildId}:${guideSlug}`;
}

/**
 * Publie un event temps réel sur le canal du guide. Best-effort, fail-closed :
 * ne lève JAMAIS (le temps réel est un plus, jamais un trou de fonctionnalité).
 */
export async function publishGuideEvent(
  guildId: string,
  guideSlug: string,
  payload: GuideRealtimeEvent
): Promise<boolean> {
  try {
    await redis.publish(guideChannel(guildId, guideSlug), JSON.stringify(payload));
    return true;
  } catch (err) {
    logger.warn("[GuideRealtime] publish échoué — fallback props serveur conservé", { error: err });
    return false;
  }
}

/**
 * Décompose une clé d'étape `GPx-N` (ex: "GP7-6") en { subGuideRef, stepNumber }.
 * Retourne null pour les clés non numériques (`GPx-all`) ou malformées.
 */
export function parseStepKey(key: string): { subGuideRef: string; stepNumber: number } | null {
  const idx = key.lastIndexOf("-");
  if (idx <= 0) return null;
  const subGuideRef = key.slice(0, idx);
  const stepNumber = parseInt(key.slice(idx + 1), 10);
  if (!subGuideRef || Number.isNaN(stepNumber)) return null;
  return { subGuideRef, stepNumber };
}

/**
 * Cache court de l'agrégat de progression d'un guide (multi-guilde × centaines d'utilisateurs).
 * `getGuildOptimizedGuideProgress` re-fetchait TOUTES les PlayerGuideProgress de la guilde
 * à chaque page view → on calcule l'agrégat au plus une fois toutes les ~3s par (guild, slug).
 * Le client utilise la présence LIVE (WS) quand elle est connectée ; ce cache sert de fallback
 * et au sommaire/TOC — 3s de latence max, acceptable.
 */
export const GUIDE_PROGRESS_CACHE_TTL_MS = 3_000;

/** Clé Redis de l'agrégat (scopée par guilde + guide). */
export function guideProgressCacheKey(guildId: string, guideSlug: string): string {
  return `guide:progress:${guildId}:${guideSlug}`;
}

/** Lit le cache sinon calcule et stocke. Best-effort, fail-closed : ne lève JAMAIS. */
export async function getCachedGuideProgress<T>(
  guildId: string,
  guideSlug: string,
  compute: () => Promise<T>
): Promise<T> {
  const key = guideProgressCacheKey(guildId, guideSlug);
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn("[GuideRealtime] cache lecture échouée — calcul direct", { error: err });
  }
  const value = await compute();
  try {
    await redis.set(key, JSON.stringify(value), "PX", GUIDE_PROGRESS_CACHE_TTL_MS);
  } catch (err) {
    logger.warn("[GuideRealtime] cache écriture échouée (non bloquant)", { error: err });
  }
  return value;
}

/** Invalide l'agrégat après une écriture (toggle/reset/step/bookmark). Best-effort. */
export async function invalidateGuideProgressCache(guildId: string, guideSlug: string): Promise<void> {
  try {
    await redis.del(guideProgressCacheKey(guildId, guideSlug));
  } catch (err) {
    logger.warn("[GuideRealtime] cache invalidation échouée (non bloquant)", { error: err });
  }
}

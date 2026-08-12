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
  | { type: "presence:leave"; profileId: string; milestoneId: string }
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

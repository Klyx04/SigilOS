/**
 * PÉRIMÈTRE — Page par-Dofus (/quetes-dofus/[dofusSlug]).
 * Couche temps réel : présence WS (room `guild:{guildId}:dofus:{slug}`) +
 * events d'action (bascule de statut de quête).
 *
 * Même architecture que src/lib/guide-realtime.ts :
 *   - le serveur Next.js (server actions) PUBLIE des events ici ;
 *   - le serveur WebSocket standalone (src/server/websocket/dofus-presence.ts)
 *     s'abonne au canal `dofus:${guildId}:${slug}` et les diffuse à la
 *     room `guild:<guildId>:dofus:<slug>` après batching (500ms).
 *
 * Fail-closed : si Redis/pub est indisponible, le publish échoue
 * silencieusement — le module garde ses props serveur figées en fallback
 * (jamais d'écran cassé).
 */
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/** Contrat de payload temps réel de la page par-Dofus (#37). */
export type DofusRealtimeEvent =
  | { type: "presence:join"; profileId: string; userName: string; userAvatar?: string; questId: string }
  | { type: "presence:leave"; profileId: string; userName?: string; questId: string }
  | { type: "quest:status"; profileId: string; userName: string; userAvatar?: string; questId: string; status: string };

/** Canal Redis d'un Dofus : `dofus:${guildId}:${slug}`. */
export function dofusChannel(guildId: string, dofusSlug: string): string {
  return `dofus:${guildId}:${dofusSlug}`;
}

/**
 * Publie un event temps réel sur le canal du Dofus. Best-effort, fail-closed :
 * ne lève JAMAIS (le temps réel est un plus, jamais un trou de fonctionnalité).
 */
export async function publishDofusEvent(
  guildId: string,
  dofusSlug: string,
  payload: DofusRealtimeEvent
): Promise<boolean> {
  try {
    await redis.publish(dofusChannel(guildId, dofusSlug), JSON.stringify(payload));
    return true;
  } catch (err) {
    logger.warn("[DofusRealtime] publish échoué — fallback props serveur conservé", { error: err });
    return false;
  }
}

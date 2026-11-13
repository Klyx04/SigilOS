/**
 * Révocation d'accès à une guilde — publisher serveur Next (audit 13/11/2026, lot 4f).
 *
 * Même architecture que `socket-r4.ts` (R4 `god:revoked`) : le serveur Next
 * publie sur Redis, le process WS standalone s'abonne et coupe les sockets
 * concernés. Best-effort : si Redis est indisponible, la révocation n'est pas
 * perdue — le sweep d'appartenance du process WS la rattrape à la passe
 * suivante (≤ 60 s par défaut). Le temps réel est un plus, jamais la garantie.
 */
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import {
    GUILD_MEMBER_REVOKED_CHANNEL,
    type GuildMemberRevokedPayload,
} from "@/lib/ws-guild-revocation";

export { GUILD_MEMBER_REVOKED_CHANNEL };
export type { GuildMemberRevokedPayload };

/**
 * Publie une révocation d'accès. Ne lève JAMAIS et ne journalise aucun
 * identifiant (ni snowflake Discord, ni identifiant interne).
 */
export async function publishGuildMemberRevoked(
    payload: GuildMemberRevokedPayload
): Promise<boolean> {
    try {
        await redis.publish(GUILD_MEMBER_REVOKED_CHANNEL, JSON.stringify(payload));
        return true;
    } catch (err) {
        logger.warn(
            "[GuildAccess] publishGuildMemberRevoked échoué — le sweep WS révoquera à la prochaine passe",
            { error: err }
        );
        return false;
    }
}

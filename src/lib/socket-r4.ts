/**
 * R4 — LIVE God Revocation (Socket.IO/SSE bridge).
 *
 * Canal inter-process "god:revoked" via Redis pub/sub :
 *  - Le serveur Next.js (server actions) PUBLIE un événement ici.
 *  - Le serveur WebSocket standalone s'abonne et diffuse aux sockets concernées.
 *
 * Fail-closed : si Redis/pub est indisponible, publishGodRevoked échoue
 * silencieusement — le sous-god garde le polling GodExpiryGuard + la
 * vérification serveur canAccessBrick (le live est un plus, jamais un trou).
 */
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const GOD_REVOKED_CHANNEL = "god:revoked";

export type GodRevokedPayload = {
    userId: string;
    reason: "DELEGATE_REVOKED" | "BRICK_REVOKED" | "SCOPES_CHANGED";
    brickId?: string;
    delegateId?: string;
    timestamp: string;
};

/**
 * Publie un événement de révocation live. Best-effort : ne lève JAMAIS.
 * Retourne false si Redis indisponible (le polling reste la ceinture de sécurité).
 */
export async function publishGodRevoked(payload: GodRevokedPayload): Promise<boolean> {
    try {
        await redis.publish(GOD_REVOKED_CHANNEL, JSON.stringify(payload));
        return true;
    } catch (err) {
        logger.warn("[R4] publishGodRevoked échoué — poll sécurisé conservé", { error: err });
        return false;
    }
}

// ─── Accès modifié (briques ajoutées/retirées/prolongées) : refresh UI, PAS de logout ───
export const GOD_ACCESS_CHANGED_CHANNEL = "god:access-changed";

export type GodAccessChangedPayload = {
    userId: string;
    delegateId?: string;
    timestamp: string;
};

/**
 * Signale qu'un sous-god a vu ses BRIQUES accessibles changer (accord, retrait,
 * prolongation) → le client rafraîchit son UI (router.refresh) pour que les onglets
 * apparaissent/disparaissent sans logout. Best-effort, fail-closed.
 */
export async function publishGodAccessChanged(payload: GodAccessChangedPayload): Promise<boolean> {
    try {
        await redis.publish(GOD_ACCESS_CHANGED_CHANNEL, JSON.stringify(payload));
        return true;
    } catch (err) {
        logger.warn("[R4] publishGodAccessChanged échoué — refresh à la prochaine requête", { error: err });
        return false;
    }
}
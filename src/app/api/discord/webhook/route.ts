/**
 * Discord Webhook Events — entrée HTTP sortante de Discord (outgoing webhook).
 *
 * #223 P1 (résilience long terme) : ce canal du portail développeur Discord
 * n'envoie QUE des « Webhook Events » :
 *   - PING (`type: 0`, ou `type: 1` sans `event`) → réponse 204 vide (< 3 s) ;
 *   - `APPLICATION_AUTHORIZED`   → tracé (installation de l'app) ;
 *   - `APPLICATION_DEAUTHORIZED` → tracé + lookup du compte (hygiène de compte).
 *
 * Discord n'envoie JAMAIS d'events Gateway (`GUILD_*`, `MESSAGE_*`,
 * `CHANNEL_*`) vers ce canal : les anciens handlers Gateway de cette route
 * étaient du code mort au format erroné (et auto-whitelistaient les guildes en
 * `isActive:true`, divergent du bot) et ont été SUPPRIMÉS. Le Gateway
 * (`services/discord-bot/index.ts`) reste la source de vérité du lifecycle.
 *
 * Sécurité : signature Ed25519 obligatoire (`X-Signature-Ed25519` +
 * `X-Signature-Timestamp`, anti-replay ±5 min) via `verifyDiscordSignature`
 * (`src/server/discord.ts`). Échec → 401 (fail-closed). Discord envoie
 * volontairement de mauvaises signatures en check périodique : les accepter
 * ferait retirer l'URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyDiscordSignature } from "@/server/discord";
import { revokeDiscordAccountSession } from "@/lib/discord-account-hygiene";

type DiscordWebhookEventData = {
    type?: string;
    timestamp?: string;
    data?: { user?: { id?: string } };
};

type DiscordWebhookPayload = {
    version?: number;
    application_id?: string;
    type?: number;
    event?: DiscordWebhookEventData;
};

/** Réponse attendue par Discord : 204 No Content, sans corps. */
function respondNoContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
}

async function handleApplicationAuthorized(payload: DiscordWebhookPayload): Promise<void> {
    logger.info("[Discord Webhook] APPLICATION_AUTHORIZED", {
        applicationId: payload.application_id ?? null,
    });
}

async function handleApplicationDeauthorized(payload: DiscordWebhookPayload): Promise<void> {
    const discordUserId = payload.event?.data?.user?.id;
    if (!discordUserId) {
        logger.warn("[Discord Webhook] APPLICATION_DEAUTHORIZED sans user id (payload ignoré)");
        return;
    }

    // #223 P3.2 — Hygiène de compte branchée : dé-liaison OAuth + invalidation des sessions.
    // Best-effort (ne throw jamais) : l'ACK 204 doit toujours partir.
    const result = await revokeDiscordAccountSession(discordUserId);

    logger.warn("[Discord Webhook] APPLICATION_DEAUTHORIZED", {
        discordUserId,
        revoked: result.revoked,
        userId: result.revoked ? result.userId : null,
        reason: result.revoked ? null : result.reason,
    });

    // Traçage God (audit système, sans session utilisateur).
    if (result.revoked) {
        try {
            const { createSystemAuditLog } = await import("@/lib/dofensive-sync");
            await createSystemAuditLog({
                action: "DISCORD_DEAUTHORIZED",
                targetType: "USER",
                targetId: result.userId,
                discordUserId,
                sessionRevoked: true,
            });
        } catch (auditErr) {
            logger.warn("[Discord Webhook] createSystemAuditLog échoué:", { error: String(auditErr) });
        }
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const bodyText = await request.text();

    // Signature Ed25519 unifiée (anti-replay ±5 min). Fail-closed → 401.
    const isValid = await verifyDiscordSignature(request, bodyText);
    if (!isValid) {
        logger.warn("[Discord Webhook] Signature invalide — requête rejetée (401)");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: DiscordWebhookPayload;
    try {
        payload = JSON.parse(bodyText);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // PING : `type: 0` (convention snapshot #223) ; fallback `type: 1` sans event.
    if (payload.type === 0 || (payload.type === 1 && !payload.event)) {
        return respondNoContent();
    }

    if (payload.type === 1 && payload.event?.type) {
        switch (payload.event.type) {
            case "APPLICATION_AUTHORIZED":
                await handleApplicationAuthorized(payload);
                break;
            case "APPLICATION_DEAUTHORIZED":
                await handleApplicationDeauthorized(payload);
                break;
            default:
                logger.debug("[Discord Webhook] Event hors périmètre ignoré", { eventType: payload.event.type });
                break;
        }
    }

    return respondNoContent();
}
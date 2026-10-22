/**
 * 🎫 Tickets — **enquête de satisfaction** (serveur partagé : Discord **et** dashboard).
 *
 * Un seul endroit envoie l'avis, sinon les deux chemins de clôture divergent — et c'est
 * exactement ce qui s'était produit : `internalHandleTicketClose` (bouton Discord)
 * envoyait l'enquête, `closeTicketAction` (dashboard) **aucune** ⇒ un staff qui fermait
 * depuis la boîte de réception ne déclenchait jamais le vote.
 *
 * Règles non négociables :
 *   · **aucun avis perdu en silence** — l'échec est journalisé et rendu à l'appelant ;
 *   · **repli** dans le salon fermé quand les MP sont fermés (le demandeur y garde
 *     l'accès en lecture) ; c'est le choix produit du 16/10/2026 ;
 *   · le demandeur est **mentionné** (jamais `@everyone`), et seuls des flocons valides
 *     passent (un `User.id` interne n'est pas un identifiant Discord).
 *
 * ⚠️ Fichier serveur partagé : ni `"use server"`, ni React — testable directement.
 */

import { logger } from "@/lib/logger";
import { readTicketMessagingSettings } from "@/lib/tickets/category-permissions";
import { buildCsatRows, buildTicketCsatEmbed } from "@/lib/tickets/embeds";
import { resolveTicketLang } from "@/lib/tickets/ticket-texts";
import { DISCORD_USER_AGENT, fetchWithRetry, sendChannelMessage } from "@/server/discord";

/** Flocon Discord : 17 à 20 chiffres (`@everyone` n'en est pas un). */
const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

/** Où l'avis a réellement été posé (`channel_fallback` = MP fermés, repli salon). */
export type TicketCsatOutcome = "dm" | "channel" | "channel_fallback";

export type TicketCsatResult =
    | { sent: true; where: TicketCsatOutcome }
    | {
          sent: false;
          reason: "disabled" | "no_creator" | "no_channel" | "discord_unavailable" | "send_failed";
          detail?: string;
      };

type CsatEmbed = ReturnType<typeof buildTicketCsatEmbed>;

/** L'avis dans le salon (fermé ou en repli) : mention du demandeur, `allowed_mentions` sain. */
async function sendSurveyInChannel(input: {
    channelId: string;
    creatorDiscordId: string;
    embed: CsatEmbed;
    components: ReturnType<typeof buildCsatRows>;
}): Promise<boolean> {
    try {
        const messageId = await sendChannelMessage(input.channelId, `<@${input.creatorDiscordId}>`, {
            embedTitle: input.embed.title,
            embedColor: input.embed.color,
            embedDescription: input.embed.description,
            embedFooter: input.embed.footer.text,
            components: input.components,
        });
        return Boolean(messageId);
    } catch (error) {
        logger.warn("[tickets] enquête de satisfaction : envoi salon impossible", {
            channelId: input.channelId,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/** L'avis en message privé (repli **mesuré** : un MP fermé est un échec explicite). */
async function sendSurveyInDm(input: {
    creatorDiscordId: string;
    embed: CsatEmbed;
    components: ReturnType<typeof buildCsatRows>;
}): Promise<{ ok: true } | { ok: false; reason: "discord_unavailable" | "send_failed"; detail?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { ok: false, reason: "discord_unavailable", detail: "DISCORD_BOT_TOKEN absent" };

    const headers = {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        "User-Agent": DISCORD_USER_AGENT,
    };

    try {
        const dmRes = await fetchWithRetry("/api/v10/users/@me/channels", {
            method: "POST",
            headers,
            body: JSON.stringify({ recipient_id: input.creatorDiscordId }),
        });
        if (!dmRes.ok) {
            return { ok: false, reason: "send_failed", detail: `ouverture_mp_${dmRes.status}` };
        }

        const dmChannel = (await dmRes.json()) as { id?: string };
        if (!dmChannel?.id) {
            return { ok: false, reason: "send_failed", detail: "ouverture_mp_sans_id" };
        }

        const posted = await fetchWithRetry(`/api/v10/channels/${dmChannel.id}/messages`, {
            method: "POST",
            headers,
            body: JSON.stringify({ embeds: [input.embed], components: input.components }),
        });
        if (!posted.ok) {
            return { ok: false, reason: "send_failed", detail: `envoi_mp_${posted.status}` };
        }
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            reason: "send_failed",
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Envoie l'enquête de satisfaction d'un ticket clôturé. Ne **jette jamais** : l'échec est
 * rendu (`sent: false`) pour être journalisé par l'appelant — une clôture ne doit pas
 * échouer parce que l'avis n'a pas pu partir.
 */
export async function sendTicketCsatSurvey(input: {
    ticket: {
        id: string;
        ticketNumber: number;
        creatorDiscordId: string | null;
        discordChannelId: string | null;
    };
    guildName: string;
    motifName: string;
    settingsJson?: unknown;
    enableCsat: boolean;
}): Promise<TicketCsatResult> {
    if (!input.enableCsat) return { sent: false, reason: "disabled" };

    const creatorDiscordId = String(input.ticket.creatorDiscordId ?? "").trim();
    if (!DISCORD_SNOWFLAKE.test(creatorDiscordId)) return { sent: false, reason: "no_creator" };

    const { csatDestination, ticketLanguage, csatTitle, csatDescription } = readTicketMessagingSettings(input.settingsJson);
    const embed = buildTicketCsatEmbed({
        ticketNumber: input.ticket.ticketNumber,
        motifName: input.motifName,
        guildName: input.guildName,
        lang: resolveTicketLang(ticketLanguage),
        customTitle: csatTitle,
        customDescription: csatDescription,
        creatorDiscordId,
    });
    const components = buildCsatRows(input.ticket.id);
    const channelId = input.ticket.discordChannelId;

    if (csatDestination === "TICKET") {
        if (!channelId) return { sent: false, reason: "no_channel" };
        const ok = await sendSurveyInChannel({ channelId, creatorDiscordId, embed, components });
        return ok ? { sent: true, where: "channel" } : { sent: false, reason: "send_failed" };
    }

    const dm = await sendSurveyInDm({ creatorDiscordId, embed, components });
    if (dm.ok) return { sent: true, where: "dm" };

    // MP fermés (ou Discord injoignable) : on ne perd pas l'avis — il repart dans le salon
    // fermé, où le demandeur garde l'accès en lecture.
    if (channelId) {
        const fallback = await sendSurveyInChannel({ channelId, creatorDiscordId, embed, components });
        if (fallback) {
            logger.warn("[tickets] enquête de satisfaction : MP indisponible, repli dans le salon", {
                ticketId: input.ticket.id,
                detail: dm.detail,
            });
            return { sent: true, where: "channel_fallback" };
        }
    }

    logger.error("[tickets] enquête de satisfaction NON envoyée", {
        ticketId: input.ticket.id,
        reason: dm.reason,
        detail: dm.detail,
        hasChannel: Boolean(channelId),
    });
    return { sent: false, reason: dm.reason, detail: dm.detail };
}

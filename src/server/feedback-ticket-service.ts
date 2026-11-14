// Service interne de la fusion « signalements » → `SupportTicket`.
//
// Aucune server action ici : ces fonctions sont appelées par les actions
// elles-mêmes (jamais exposées au client). Elles centralisent deux règles
// qui ne doivent pas être recopiées : la référence publique stable et le
// journal des réponses visibles par le membre.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { appendMemberReplyToTranscript, buildTicketPublicRef } from "@/lib/feedback-ticket-mapping";
import { sendChannelMessage } from "@/server/discord";

function isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Attribue `SIG-<ticketNumber>` à un ticket neuf, sans jamais écraser une
 * référence existante. En cas de collision (backfill partiel), un suffixe
 * court et stable est utilisé ; la référence reste unique et affichable.
 */
export async function ensurePublicRef(ticket: {
    id: string;
    ticketNumber: number;
    publicRef: string | null;
}): Promise<string> {
    if (ticket.publicRef) return ticket.publicRef;

    const base = buildTicketPublicRef(ticket.ticketNumber);
    const candidates = [base, `${base}-T${ticket.id.slice(-4)}`];

    for (const candidate of candidates) {
        try {
            const updated = await db.supportTicket.updateMany({
                where: { id: ticket.id, publicRef: null },
                data: { publicRef: candidate },
            });
            if (updated.count > 0) return candidate;
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }

        const fresh = await db.supportTicket.findUnique({
            where: { id: ticket.id },
            select: { publicRef: true },
        });
        if (fresh?.publicRef) return fresh.publicRef;
    }

    throw new Error("Référence publique introuvable");
}

/**
 * Ajoute une réponse au journal du signalement. Le transcript d'un ticket
 * support Discord peut être un objet : on ne l'écrase jamais, on ajoute
 * seulement un tableau `replies` s'il n'en a pas.
 */
export function appendMemberReply(
    transcript: unknown,
    entry: { kind: "member_reply"; message: string; emoji: string; byUserId: string; at: string },
): Prisma.InputJsonValue {
    return appendMemberReplyToTranscript(transcript, entry) as Prisma.InputJsonValue;
}

/**
 * Diffuse un signalement dans le canal Discord de retour (repli God).
 * Best-effort : un échec Discord ne fait jamais échouer l'écriture du ticket.
 */
export async function sendFeedbackEmbed(input: {
    publicRef: string;
    category: string;
    description: string;
    feedbackType: string;
    sourcePage: string;
    targetSlug?: string | null;
    memberName: string;
    memberGuildName: string;
    emoji: string;
    isBug: boolean;
}): Promise<void> {
    try {
        const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        const targetChannel = (platformConfig as any)?.questFeedbackChannelId
            || (platformConfig as any)?.godNotifyChannelId;
        if (!targetChannel) return;

        const appUrl = getAppBaseUrl();
        await sendChannelMessage(targetChannel, "", {
            embedTitle: `${input.emoji} Feedback — ${input.category}`,
            embedDescription: input.description,
            embedColor: input.isBug ? 0xef4444 : 0x10b981,
            embedFooter: `${input.memberName} 🏷️ ${input.memberGuildName} • SigilOS`,
            embedUrl: `${appUrl}/god/bugs?ticket=${encodeURIComponent(input.publicRef)}`,
            fields: [
                { name: "Type", value: input.feedbackType, inline: true },
                { name: "Page", value: input.sourcePage, inline: true },
                ...(input.targetSlug ? [{ name: "Cible", value: input.targetSlug, inline: true }] : []),
                { name: "Ticket", value: `#${input.publicRef}`, inline: true },
                { name: "Signalé par", value: `${input.memberName} (${input.memberGuildName})`, inline: false },
            ],
        });
    } catch (e: any) {
        logger.error("[Feedback] Discord embed failed", { error: e?.message });
    }
}

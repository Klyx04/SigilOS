// Service interne de la fusion « signalements » → `SupportTicket`.
//
// Aucune server action ici : ces fonctions sont appelées par les actions
// elles-mêmes (jamais exposées au client). Elles centralisent deux règles
// qui ne doivent pas être recopiées : la référence publique stable et le
// journal des réponses visibles par le membre.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { appendMemberReplyToTranscript, buildTicketPublicRef } from "@/lib/feedback-ticket-mapping";

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

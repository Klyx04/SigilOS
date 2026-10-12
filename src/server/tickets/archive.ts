/**
 * 🎫 Tickets v2 — **capture d'archive** (serveur partagé : dashboard **et** Discord).
 *
 * Un seul endroit produit les archives, sinon les deux chemins de fermeture divergent
 * (constat : la fermeture dashboard et la fermeture Discord dupliquaient ~70 lignes
 * de code identique, avec les mêmes défauts).
 *
 * Correctifs portés ici (audit du 24/09/2026) :
 *   · **pagination réelle** (`fetchChannelMessagesPagedDiscord`) au lieu d'un
 *     `fetch(..., 100)` présenté comme complet ;
 *   · **deux documents distincts** : `SHAREABLE` (conversation seule, jamais une note
 *     interne) et `INTERNAL` (annexe staff, créée seulement s'il y a des notes) ;
 *   · **échéance** calculée depuis la rétention de la guilde (0 = jamais) ;
 *   · un échec de capture **ne bloque pas** la fermeture et se dit dans `note`.
 *
 * ⚠️ Fichier serveur partagé : ni `"use server"`, ni React — testable directement.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { fetchChannelMessagesPagedDiscord } from "@/server/discord";
import { generateHtmlTranscript, type TranscriptMessage } from "@/lib/tickets/transcript-engine";
import {
    computeExpiry,
    evaluateCompleteness,
    shouldIncludeNotes,
    TICKET_MESSAGE_HARD_CAP,
    type TicketArchiveKind,
} from "@/lib/tickets/archive-policy";

export type TicketArchiveCapture = {
    /** Archives réellement écrites. */
    kinds: TicketArchiveKind[];
    captured: number;
    totalCount: number | null;
    partial: boolean;
    /** Phrase honnête affichée dans l'inbox et l'archive. */
    note: string;
    errors: string[];
};

export type TicketForArchive = {
    id: string;
    guildId: string;
    ticketNumber: number;
    creatorDiscordName: string;
    creatorDiscordId: string;
    claimedByName?: string | null;
    createdAt: Date;
    intakeAnswersJson?: unknown;
    discordChannelId?: string | null;
    category?: { name: string } | null;
    journey?: { name: string } | null;
    guild: { name: string };
    notes: Array<{
        id: string;
        authorDiscordId: string;
        authorName: string;
        content: string;
        createdAt: Date;
    }>;
};

function reasonNameOf(ticket: TicketForArchive): string {
    return ticket.journey?.name || ticket.category?.name || "Support";
}

/** Messages Discord → messages de transcript (aucune note interne ajoutée ici). */
export function buildConversationMessages(discordMessages: any[]): TranscriptMessage[] {
    return discordMessages.map((message) => ({
        id: message.id,
        authorId: message.author?.id || "inconnu",
        authorName: message.author?.global_name || message.author?.username || "Inconnu",
        authorAvatar: message.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`
            : null,
        isBot: Boolean(message.author?.bot),
        content: message.content || "",
        createdAt: message.timestamp,
        attachments: Array.isArray(message.attachments)
            ? message.attachments.map((attachment: any) => ({
                  url: attachment.url,
                  name: attachment.filename,
                  isImage: Boolean(attachment.content_type?.startsWith("image/")),
              }))
            : undefined,
    }));
}

/** Notes internes → messages marqués `isInternalNote` (annexe staff uniquement). */
export function buildInternalNoteMessages(ticket: TicketForArchive): TranscriptMessage[] {
    return ticket.notes.map((note) => ({
        id: note.id,
        authorId: note.authorDiscordId,
        authorName: note.authorName,
        authorAvatar: null,
        isStaff: true,
        isInternalNote: true,
        content: note.content,
        createdAt: note.createdAt,
    }));
}

function metaOf(
    ticket: TicketForArchive,
    input: { closedByName?: string | null; closedReason?: string | null; now: Date }
) {
    return {
        ticketNumber: ticket.ticketNumber,
        categoryName: reasonNameOf(ticket),
        guildName: ticket.guild.name,
        creatorName: ticket.creatorDiscordName,
        creatorId: ticket.creatorDiscordId,
        claimedByName: ticket.claimedByName,
        openedAt: ticket.createdAt,
        closedAt: input.now,
        closedByName: input.closedByName ?? null,
        closedReason: input.closedReason ?? null,
        intakeAnswers: (ticket.intakeAnswersJson as Record<string, string> | null) ?? undefined,
    };
}

const byCreatedAt = (a: TranscriptMessage, b: TranscriptMessage) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Écrit (ou réécrit) une archive d'un type donné. */
async function upsertArchive(input: {
    ticketId: string;
    guildId: string;
    kind: TicketArchiveKind;
    html: string;
    completeness: { messageCount: number; totalCount: number | null; partial: boolean };
    expiresAt: Date | null;
}): Promise<void> {
    const data = {
        storageRef: input.html,
        messageCount: input.completeness.messageCount,
        totalCount: input.completeness.totalCount,
        sizeBytes: Buffer.byteLength(input.html, "utf-8"),
        partial: input.completeness.partial,
        expiresAt: input.expiresAt,
    };

    await db.ticketTranscript.upsert({
        where: { ticketId_kind: { ticketId: input.ticketId, kind: input.kind } },
        create: {
            ticketId: input.ticketId,
            guildId: input.guildId,
            kind: input.kind,
            secretToken: crypto.randomUUID().replace(/-/g, ""),
            ...data,
        },
        update: data,
    });
}

/**
 * Capture les archives d'un ticket. **Ne jette jamais** : un échec Discord laisse la
 * fermeture se poursuivre et se contente de le dire (`note`, `errors`).
 */
export async function captureTicketArchives(input: {
    ticket: TicketForArchive;
    config?: { enableTranscripts: boolean; transcriptRetentionDays: number } | null;
    closedByName?: string | null;
    closedReason?: string | null;
    now?: Date;
}): Promise<TicketArchiveCapture> {
    const now = input.now ?? new Date();
    const ticket = input.ticket;

    if (input.config?.enableTranscripts === false) {
        return {
            kinds: [],
            captured: 0,
            totalCount: null,
            partial: false,
            note: "Archives désactivées pour cette guilde.",
            errors: [],
        };
    }

    if (!ticket.discordChannelId) {
        return {
            kinds: [],
            captured: 0,
            totalCount: null,
            partial: false,
            note: "Aucun salon Discord à archiver.",
            errors: [],
        };
    }

    const { messages, complete } = await fetchChannelMessagesPagedDiscord(
        ticket.discordChannelId,
        TICKET_MESSAGE_HARD_CAP
    );
    const conversation = buildConversationMessages(messages);
    const completeness = evaluateCompleteness({
        captured: conversation.length,
        total: complete ? conversation.length : null,
        stopped: !complete,
    });

    const expiresAt = computeExpiry(now, input.config?.transcriptRetentionDays ?? 0);
    const meta = metaOf(ticket, { closedByName: input.closedByName, closedReason: input.closedReason, now });

    const kinds: TicketArchiveKind[] = [];
    const errors: string[] = [];

    // 1. Document **partageable** : la conversation seule — jamais une note interne.
    try {
        const html = generateHtmlTranscript(meta, conversation);
        await upsertArchive({
            ticketId: ticket.id,
            guildId: ticket.guildId,
            kind: "SHAREABLE",
            html,
            completeness,
            expiresAt,
        });
        kinds.push("SHAREABLE");
    } catch (error: any) {
        logger.error("[tickets] capture de l'archive partageable impossible", {
            ticketId: ticket.id,
            error: error?.message,
        });
        errors.push("L'archive partageable n'a pas pu être écrite.");
    }

    // 2. **Annexe interne** : seulement s'il y a des notes à protéger (sinon doublon inutile).
    const notes = buildInternalNoteMessages(ticket);
    if (shouldIncludeNotes("INTERNAL") && notes.length > 0) {
        try {
            const html = generateHtmlTranscript(meta, [...conversation, ...notes].sort(byCreatedAt));
            await upsertArchive({
                ticketId: ticket.id,
                guildId: ticket.guildId,
                kind: "INTERNAL",
                html,
                completeness,
                expiresAt,
            });
            kinds.push("INTERNAL");
        } catch (error: any) {
            logger.error("[tickets] capture de l'annexe interne impossible", {
                ticketId: ticket.id,
                error: error?.message,
            });
            errors.push("L'annexe interne n'a pas pu être écrite.");
        }
    }

    return {
        kinds,
        captured: completeness.messageCount,
        totalCount: completeness.totalCount,
        partial: completeness.partial,
        note: completeness.note,
        errors,
    };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
    evaluateArchiveAccess,
    TICKET_ARCHIVE_ACCESS_MESSAGES,
} from "@/lib/tickets/archive-policy";

export const dynamic = "force-dynamic";

/**
 * Lecture d'une archive **partageable** par jeton (`/api/tickets/transcript/<token>`).
 *
 * Correctifs de la refonte (audit du 24/09/2026) :
 *   · l'**annexe interne** n'est **jamais** servie par ce jeton — elle contient les
 *     notes du staff et reste accessible au seul dashboard habilité (sinon un simple
 *     lien partagé exposait les notes) ;
 *   · le jeton peut **expirer** (`expiresAt`) ou être **révoqué** (`revokedAt`) ;
 *   · l'accès est **compté** (`accessCount`, `lastAccessedAt`) et non mis en cache ;
 *   · la régénération à la volée ne sert que le document partageable (conversation
 *     seule) si le HTML stocké est absent.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ secretToken: string }> }
) {
    const { secretToken } = await params;
    if (!secretToken) {
        return new NextResponse("Jeton manquant", { status: 400 });
    }

    try {
        const transcript = await db.ticketTranscript.findUnique({
            where: { secretToken },
            include: {
                ticket: {
                    include: {
                        category: true,
                        journey: true,
                        guild: true,
                        feedback: true,
                    },
                },
            },
        });

        const access = evaluateArchiveAccess(
            transcript
                ? { expiresAt: transcript.expiresAt, revokedAt: transcript.revokedAt }
                : null,
            new Date()
        );

        // Une annexe interne n'est pas un document public : même avec le jeton, on refuse.
        if (!transcript || !transcript.ticket || transcript.kind === "INTERNAL") {
            return new NextResponse(TICKET_ARCHIVE_ACCESS_MESSAGES.NOT_FOUND, { status: 404 });
        }

        if (!access.allowed) {
            return new NextResponse(TICKET_ARCHIVE_ACCESS_MESSAGES[access.reason], { status: 410 });
        }

        // Compteur d'accès : informatif, jamais bloquant pour la lecture.
        void db.ticketTranscript
            .update({
                where: { id: transcript.id },
                data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
            })
            .catch(() => {});

        let htmlContent = "";
        if (transcript.storageRef.trimStart().startsWith("<!DOCTYPE html>")) {
            htmlContent = transcript.storageRef;
        } else {
            try {
                const fs = await import("fs/promises");
                htmlContent = await fs.readFile(transcript.storageRef, "utf-8");
            } catch {
                const { generateHtmlTranscript } = await import("@/lib/tickets/transcript-engine");
                const ticket = transcript.ticket;
                htmlContent = generateHtmlTranscript(
                    {
                        ticketNumber: ticket.ticketNumber,
                        categoryName: ticket.journey?.name || ticket.category?.name || "Support",
                        guildName: ticket.guild.name,
                        creatorName: ticket.creatorDiscordName,
                        creatorId: ticket.creatorDiscordId,
                        claimedByName: ticket.claimedByName,
                        openedAt: ticket.createdAt,
                        closedAt: ticket.closedAt,
                        closedByName: ticket.closedByName,
                        closedReason: ticket.closedReason,
                        intakeAnswers: ticket.intakeAnswersJson as Record<string, string> | null,
                        csatRating: ticket.feedback?.rating,
                    },
                    // ⚠️ Aucune note interne ici : régénération du document partageable.
                    []
                );
            }
        }

        const isDownload = request.nextUrl.searchParams.get("download") === "1";
        const headers: Record<string, string> = {
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex, nofollow",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        };

        if (isDownload) {
            headers["Content-Disposition"] = `attachment; filename="transcript-ticket-${transcript.ticket.ticketNumber}.html"`;
        }

        return new NextResponse(htmlContent, { status: 200, headers });
    } catch (error) {
        const { logger } = await import("@/lib/logger");
        logger.error("[Transcript Route] Error:", error);
        return new NextResponse("Erreur serveur lors de la récupération du transcript", { status: 500 });
    }
}

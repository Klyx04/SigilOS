import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ secretToken: string }> }
) {
    const { secretToken } = await params;
    if (!secretToken) {
        return new NextResponse("Token manquant", { status: 400 });
    }

    try {
        const transcript = await db.ticketTranscript.findUnique({
            where: { secretToken },
            include: {
                ticket: {
                    include: {
                        category: true,
                        guild: true,
                        notes: { orderBy: { createdAt: "asc" } },
                        feedback: true,
                    },
                },
            },
        });

        if (!transcript || !transcript.ticket) {
            return new NextResponse("Transcript introuvable ou expiré", { status: 404 });
        }

        // If stored HTML content is present or file ref
        let htmlContent = "";
        if (transcript.storageRef.startsWith("<!DOCTYPE html>")) {
            htmlContent = transcript.storageRef;
        } else {
            // Read from filesystem if saved as a path
            try {
                const fs = await import("fs/promises");
                htmlContent = await fs.readFile(transcript.storageRef, "utf-8");
            } catch {
                // Fallback: regenerate on the fly
                const { generateHtmlTranscript } = await import("@/lib/tickets/transcript-engine");
                const ticket = transcript.ticket;
                htmlContent = generateHtmlTranscript(
                    {
                        ticketNumber: ticket.ticketNumber,
                        categoryName: ticket.category.name,
                        guildName: ticket.guild.name,
                        creatorName: ticket.creatorDiscordName,
                        creatorId: ticket.creatorDiscordId,
                        claimedByName: ticket.claimedByName,
                        openedAt: ticket.createdAt,
                        closedAt: ticket.closedAt,
                        closedByName: ticket.closedByName,
                        closedReason: ticket.closedReason,
                        intakeAnswers: ticket.intakeAnswersJson as any,
                        csatRating: ticket.feedback?.rating,
                    },
                    ticket.notes.map((n) => ({
                        id: n.id,
                        authorId: n.authorDiscordId,
                        authorName: n.authorName,
                        isStaff: true,
                        isInternalNote: true,
                        content: n.content,
                        createdAt: n.createdAt,
                    }))
                );
            }
        }

        const isDownload = request.nextUrl.searchParams.get("download") === "1";
        const headers: Record<string, string> = {
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex, nofollow",
        };

        if (isDownload) {
            headers["Content-Disposition"] = `attachment; filename="transcript-ticket-${transcript.ticket.ticketNumber}.html"`;
        }

        return new NextResponse(htmlContent, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("[Transcript Route] Error:", error);
        return new NextResponse("Erreur serveur lors de la récupération du transcript", { status: 500 });
    }
}

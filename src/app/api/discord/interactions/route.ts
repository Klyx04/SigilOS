import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature } from "@/server/discord";
// Imports dynamically used
// import { registerForEvent, unregisterFromEvent } from "@/server/actions/calendar-actions";
import { db } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const bodyText = await request.text();
        const isValid = await verifyDiscordSignature(request, bodyText);

        if (!isValid) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(bodyText);

        // 1. Handle Ping
        if (payload.type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 2. Handle Component Interaction (Button click)
        if (payload.type === 3) {
            const { custom_id } = payload.data;
            const { member, guild_id } = payload;

            // Expected custom_id format: "calendar:action:eventId"
            const [prefix, action, eventId] = custom_id.split(":");

            if (prefix !== "calendar") {
                return NextResponse.json({ type: 4, data: { content: "Interaction inconnue", flags: 64 } });
            }

            // Find user in DB by Discord ID
            const account = await db.account.findFirst({
                where: { provider: "discord", providerAccountId: member.user.id },
                select: { userId: true }
            });

            if (!account) {
                return NextResponse.json({
                    type: 4,
                    data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site pour utiliser ce bouton.", flags: 64 }
                });
            }

            let result;

            if (action === "join") {
                const { processRegistration } = await import("@/server/calendar-service");
                result = await processRegistration(guild_id, eventId, account.userId);
            } else if (action === "leave") {
                const { processUnregistration } = await import("@/server/calendar-service");
                result = await processUnregistration(guild_id, eventId, account.userId);
            }

            if (result?.success) {
                // Update the message is handled by the action usually, 
                // but for immediate feedback we can say "Thinking..." or "Done"
                // Type 6 = DEFERRED_UPDATE_MESSAGE (doesn't show a new message, just ack)
                // Type 7 = UPDATE_MESSAGE (allows editing the message directly here)

                // Since the action updates the embed, we just want to acknowledge so the button stops spinning.
                return NextResponse.json({ type: 6 });
            } else {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ Erreur: ${result?.error}`, flags: 64 }
                });
            }
        }

        return NextResponse.json({ error: "Unknown type" }, { status: 400 });

    } catch (error) {
        console.error("[Discord Interaction] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

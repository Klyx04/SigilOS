
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET() {
    try {
        const discordGuildId = "1290442961380835451"; // Guild ID from logs

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId }
        });

        if (!guildConfig) {
            return NextResponse.json({ error: "Guild not found" }, { status: 404 });
        }

        // Create mission
        const mission = await db.mission.create({
            data: {
                guildId: guildConfig.id,
                title: "Régulation de l'Équipage du Grolandais",

                category: "REGULATION",
                tier: 2,
                xpReward: 500,
                year: 2026,
                weekNumber: 5, // Current week approx? Or match active filter
                status: "ACTIVE",
                payload: {
                    monsterName: "Équipage du Grolandais",
                    quantity: 50
                },
                slotIndex: 5
            }
        });

        return NextResponse.json({ success: true, mission });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to seed" }, { status: 500 });
    }
}

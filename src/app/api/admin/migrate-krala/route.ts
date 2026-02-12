import { NextRequest, NextResponse } from "next/server";
import { migrateKralamoureEvents } from "@/server/actions/migrate-krala-events";

export async function POST(req: NextRequest) {
    try {
        const { guildId } = await req.json();

        if (!guildId) {
            return NextResponse.json(
                { error: "guildId requis" },
                { status: 400 }
            );
        }

        const result = await migrateKralamoureEvents(guildId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 403 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[API] Migrate Krala Error:", error);
        return NextResponse.json(
            { error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

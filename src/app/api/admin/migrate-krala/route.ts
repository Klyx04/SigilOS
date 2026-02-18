import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { migrateKralamoureEvents } from "@/server/actions/migrate-krala-events";

export async function POST(req: NextRequest) {
    // Auth gate — the server action also checks isAdmin, but we fail fast here
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    try {
        const { guildId } = await req.json();

        if (!guildId) {
            return NextResponse.json({ error: "guildId requis" }, { status: 400 });
        }

        const result = await migrateKralamoureEvents(guildId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 403 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[API] Migrate Krala Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

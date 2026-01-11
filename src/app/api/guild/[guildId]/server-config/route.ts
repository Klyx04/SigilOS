import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
    params: Promise<{ guildId: string }>;
};

/**
 * GET /api/guild/[guildId]/server-config
 * Returns the guild's Dofus server configuration
 */
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const { guildId } = await context.params;

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { dofusServerId: true, dofusServerName: true }
        });

        if (!guildConfig) {
            return NextResponse.json({ error: "Guilde non trouvée" }, { status: 404 });
        }

        return NextResponse.json({
            serverId: guildConfig.dofusServerId,
            serverName: guildConfig.dofusServerName
        });
    } catch (error) {
        console.error("[GET server-config] Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

/**
 * POST /api/guild/[guildId]/server-config
 * Updates the guild's Dofus server configuration
 * Requires admin permission
 */
export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const { guildId } = await context.params;
        const body = await request.json();
        const { serverId, serverName } = body;

        if (!serverId || !serverName) {
            return NextResponse.json({ error: "serverId et serverName requis" }, { status: 400 });
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
        });

        if (!guildConfig) {
            return NextResponse.json({ error: "Guilde non trouvée" }, { status: 404 });
        }

        // TODO: Add proper admin permission check here
        // For now, we allow any authenticated user to configure
        // In production, check if user has ADMIN_ACCESS permission

        // Update guild config
        await db.guildConfig.update({
            where: { id: guildConfig.id },
            data: {
                dofusServerId: serverId,
                dofusServerName: serverName
            }
        });

        console.log(`[server-config] Updated guild ${guildId}: ${serverName} (${serverId})`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[POST server-config] Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

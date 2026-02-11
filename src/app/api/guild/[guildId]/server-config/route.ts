import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/server/actions/user-actions";

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

        // SECURITY: Verify user is a member of this guild
        const user = await getUserContext(guildId);
        if (!user.isMember) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

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

        // SECURITY: Verify user has admin permission for this guild
        const user = await getUserContext(guildId);
        if (!user.isAdmin) {
            console.warn(`[Security] server-config blocked: User is not admin of guild ${guildId}`);
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { serverId, serverName } = body;

        if (!serverId || !serverName) {
            return NextResponse.json({ error: "serverId et serverName requis" }, { status: 400 });
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return NextResponse.json({ error: "Guilde non trouvée" }, { status: 404 });
        }

        // Update guild config
        await db.guildConfig.update({
            where: { id: guildConfig.id },
            data: {
                dofusServerId: serverId,
                dofusServerName: serverName
            }
        });


        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[POST server-config] Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}


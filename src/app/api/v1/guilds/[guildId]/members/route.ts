import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key-auth";
import { db } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId } = await context.params;
        const authResult = await validateApiKey(request, guildId, "read:members");
        if (authResult.errorResponse) return authResult.errorResponse;

        const profiles = await db.userProfile.findMany({
            where: { guildId: authResult.apiKeyRecord.guildId },
            select: {
                id: true,
                pseudoDofus: true,
                discordNickname: true,
                discordRoleName: true,
                contributionPoints: true,
                dofusLevel: true,
                classe: true,
                updatedAt: true
            },
            orderBy: { contributionPoints: "desc" }
        });

        return NextResponse.json({
            guildId: authResult.apiKeyRecord.guildId,
            guildName: authResult.apiKeyRecord.guild.name,
            totalMembers: profiles.length,
            members: profiles
        });
    } catch (err) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key-auth";
import { db } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId } = await context.params;
        const authResult = await validateApiKey(request, guildId, "read:quests");
        if (authResult.errorResponse) return authResult.errorResponse;

        const targetGuildId = authResult.apiKeyRecord.guildId;

        const [dofusList, completedProgressCount] = await Promise.all([
            db.dofusItem.findMany({
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    filterCategory: true,
                    displayOrder: true
                },
                orderBy: { displayOrder: "asc" }
            }),
            (db as any).playerDofusProgress.count({
                where: {
                    profile: { guildId: targetGuildId }
                }
            }).catch(() => 0)
        ]);

        return NextResponse.json({
            guildId: targetGuildId,
            guildName: authResult.apiKeyRecord.guild.name,
            totalDofus: dofusList.length,
            dofusCatalog: dofusList,
            totalCompletedProgress: completedProgressCount
        });
    } catch (err) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

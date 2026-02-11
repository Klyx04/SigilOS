import { NextRequest, NextResponse } from "next/server";
import { getActiveBonuses } from "@/server/actions/bonus-actions";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId } = await params;
        const result = await getActiveBonuses(guildId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ bonuses: result.data });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

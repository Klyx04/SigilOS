import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const updated = await db.dofusItem.update({
            where: { slug: "dofoozbz" },
            data: {
                imageUrl: "/module-dofus/Dofus_dofoozbz.png"
            }
        });
        return NextResponse.json({ success: true, updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}

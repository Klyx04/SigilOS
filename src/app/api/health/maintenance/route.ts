import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

// Lightweight endpoint called by middleware to check maintenance mode.
// Must be fast — no auth, no heavy processing.
export async function GET() {
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { maintenanceMode: true },
        });

        return NextResponse.json({
            maintenanceMode: config?.maintenanceMode ?? false,
        });
    } catch {
        // Fail open: if DB is unreachable, don't block all users
        return NextResponse.json({ maintenanceMode: false });
    }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET() {
    try {
        // Quick DB check
        await db.$queryRaw`SELECT 1`;
        return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() }, { status: 200 });
    } catch (error) {
        console.error("[HealthCheck] Database unreachable:", error);
        return NextResponse.json({ status: "unhealthy", error: "Database unreachable" }, { status: 503 });
    }
}

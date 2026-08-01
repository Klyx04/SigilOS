import { NextResponse } from "next/server";
import { notifyGod } from "@/server/actions/god-notif-actions";

/**
 * API: External God Notification Receiver
 * Used by VPS maintenance scripts, backups, and other external jobs.
 * 
 * Usage from Curl:
 * curl -X POST https://sigilos.fr/api/god/notify \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "title": "[VPS] Maintenance Terminée",
 *     "message": "Le script maintenance.sh a fini de purger Docker et les logs.",
 *     "type": "VPS_MAINTENANCE",
 *     "success": true,
 *     "metadata": { "docker_pruned": "3.5GB", "logs_cleared": "120MB" }
 *   }'
 */
export async function POST(req: Request) {
    console.log(`[API_GOD_NOTIFY] ☁️ Received incoming notification request...`);
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const data = await req.json();

        // Validate basic fields
        if (!data.title || !data.message || !data.type) {
            return new NextResponse("Missing required fields (title, message, type)", { status: 400 });
        }

        // Validate type (basic enum check)
        const validTypes: string[] = [
            "VPS_MAINTENANCE",
            "BACKUP",
            "WORKER_SYNC",
            "TICKET",
            "GEOGUESSER_REPORT",
            "SECURITY_ALERT",
            "SYSTEM"
        ];

        if (!validTypes.includes(data.type)) {
            return new NextResponse(`Invalid notification type. Must be one of: ${validTypes.join(", ")}`, { status: 400 });
        }

        const result = await notifyGod({
            title: data.title,
            message: data.message,
            type: data.type,
            success: data.success ?? true,
            metadata: data.metadata,
            ping: data.success === false // Ping on Discord only if it failed
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        // F-15: never leak internal error details to the client — log them server-side only.
        console.error("[API_GOD_NOTIFY] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

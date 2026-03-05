import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// DISC-2 — Discord Status Channel
//
// Sends (or edits) a "living" status embed in a Discord channel via webhook.
// The message is pinned/persistent: on each run we PATCH it instead of
// creating a new one.
//
// Required env vars:
//   SIGILOS_STATUS_WEBHOOK_URL   — Discord Webhook URL for #état-services
//   NEXT_PUBLIC_APP_URL          — Base URL (https://sigilos.fr)
//
// Trigger: call /api/cron/discord-status from a cron job (e.g. every hour)
// Protected by CRON_SECRET header.
// ---------------------------------------------------------------------------

const REDIS_KEY = "sigilos:discord_status_message_id";

async function getSystemHealth() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    try {
        const start = Date.now();
        const res = await fetch(`${appUrl}/api/health`, { cache: "no-store" });
        const latency = Date.now() - start;
        if (!res.ok) return { status: "unhealthy" as const, latency, services: null };
        const data = await res.json();
        return { status: data.status as "healthy" | "degraded" | "unhealthy", latency, services: data.services };
    } catch {
        return { status: "unhealthy" as const, latency: null, services: null };
    }
}

function buildEmbed(health: Awaited<ReturnType<typeof getSystemHealth>>) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const monitorUrl = process.env.MONITOR_URL || `${appUrl}/status`;
    const now = new Date();

    const statusIcon = {
        healthy: "🟢",
        degraded: "🟡",
        unhealthy: "🔴",
    }[health.status];

    const statusLabel = {
        healthy: "Opérationnel",
        degraded: "Dégradé",
        unhealthy: "Incident en cours",
    }[health.status];

    const color = {
        healthy: 0x22c55e,
        degraded: 0xf59e0b,
        unhealthy: 0xef4444,
    }[health.status];

    const fields = [];

    if (health.services) {
        const db = health.services.database;
        const redSvc = health.services.redis;
        fields.push({
            name: "🗄️ Base de données",
            value: db.status === "up"
                ? `✅ En ligne${db.latency ? ` (${db.latency}ms)` : ""}`
                : "❌ Hors ligne",
            inline: true
        });
        fields.push({
            name: "⚡ Redis (Cache)",
            value: redSvc.status === "up"
                ? `✅ En ligne${redSvc.latency ? ` (${redSvc.latency}ms)` : ""}`
                : redSvc.status === "not_configured"
                    ? "⚪ Non configuré"
                    : "❌ Hors ligne",
            inline: true
        });
    }

    if (health.latency !== null) {
        fields.push({
            name: "📡 Latence API",
            value: `${health.latency}ms`,
            inline: true
        });
    }

    fields.push({
        name: "🔗 Monitoring",
        value: `[Tableau de bord](${monitorUrl})`,
        inline: true
    });

    return {
        embeds: [{
            title: `${statusIcon} SigilOS — État des Services`,
            description: `**${statusLabel}**\nDernière vérification : <t:${Math.floor(now.getTime() / 1000)}:R>`,
            color,
            fields,
            footer: {
                text: `SigilOS Status • Mis à jour le ${now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
                icon_url: "https://i.imgur.com/AfFp7pu.png"
            },
            timestamp: now.toISOString(),
        }]
    };
}

export async function GET(req: Request) {
    // Security: validate cron secret header
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (secret && authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookUrl = process.env.SIGILOS_STATUS_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        return NextResponse.json({ error: "SIGILOS_STATUS_WEBHOOK_URL not configured" }, { status: 500 });
    }

    const health = await getSystemHealth();
    const body = buildEmbed(health);

    try {
        // Try to retrieve the existing message ID from Redis
        const existingMsgId = redis ? await redis.get(REDIS_KEY) : null;

        if (existingMsgId) {
            // PATCH — edit the existing message
            const patchRes = await fetch(`${webhookUrl}/messages/${existingMsgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                cache: "no-store",
            });

            if (patchRes.ok) {
                return NextResponse.json({ success: true, action: "edited", messageId: existingMsgId });
            }
            // Message no longer exists — fall through to create a new one
        }

        // POST — create new message and persist its ID
        const postRes = await fetch(`${webhookUrl}?wait=true`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        if (!postRes.ok) {
            const errText = await postRes.text();
            console.error("[StatusCron] Discord webhook error:", postRes.status, errText);
            return NextResponse.json({ error: "Discord rejected the message" }, { status: 502 });
        }

        const msg = await postRes.json() as { id: string };
        if (redis) {
            // Keep message ID for 30 days (auto-cleanup)
            await redis.set(REDIS_KEY, msg.id, "EX", 60 * 60 * 24 * 30);
        }

        return NextResponse.json({ success: true, action: "created", messageId: msg.id });
    } catch (error) {
        console.error("[StatusCron] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

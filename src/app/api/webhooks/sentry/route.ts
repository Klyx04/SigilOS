import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeEqualStrings } from "@/lib/god-route";
import { rateLimit } from "@/lib/ratelimit";

/**
 * 🔔 Relais Sentry → Discord (plan Sentry gratuit).
 *
 * Pourquoi un relais : l'action Discord native des alertes Sentry exige le plan
 * Team, et le webhook legacy de Sentry poste son JSON brut (rejeté par Discord
 * qui exige son propre format → "Failed to send test event").
 * Sentry poste ici → on reformate en embed Discord → on relaie vers le webhook
 * du salon staff.
 *
 * Sécurité (fail-closed) :
 * - `?secret=` comparé en temps constant à SENTRY_WEBHOOK_SECRET (503 si absent).
 * - SENTRY_DISCORD_WEBHOOK_URL doit pointer sur discord.com/api/webhooks/.
 * - Rate-limit IP strict (faible volume légitime).
 */

const SentryPayloadSchema = z.object({}).passthrough();

function str(v: unknown, max: number): string {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function levelColor(level: string): number {
    const l = level.toLowerCase();
    if (l === "fatal" || l === "error") return 0xef4444;
    if (l === "warning") return 0xf59e0b;
    return 0x3b82f6;
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-real-ip") || "unknown";
        const rl = await rateLimit(`sentry-relay:${ip}`, 30, 60_000);
        if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

        const url = new URL(req.url);
        const secret = url.searchParams.get("secret") || "";
        const expected = (process.env.SENTRY_WEBHOOK_SECRET || "").replace(/^['"]|['"]$/g, "").trim();
        if (!expected) {
            logger.error("[Sentry Relay] SENTRY_WEBHOOK_SECRET non configuré — relais bloqué (fail-closed)");
            return NextResponse.json({ error: "Relais non configuré" }, { status: 503 });
        }
        if (!safeEqualStrings(secret, expected)) {
            logger.warn("[Sentry Relay] Secret invalide");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const discordWebhook = (process.env.SENTRY_DISCORD_WEBHOOK_URL || "").trim();
        if (!discordWebhook.startsWith("https://discord.com/api/webhooks/")) {
            logger.error("[Sentry Relay] SENTRY_DISCORD_WEBHOOK_URL absent ou invalide — relais bloqué (fail-closed)");
            return NextResponse.json({ error: "Salon Discord non configuré" }, { status: 503 });
        }

        let body: unknown = null;
        try {
            body = SentryPayloadSchema.parse(await req.json());
        } catch {
            return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
        }
        const p = body as Record<string, unknown>;

        const project = str(p.project_name ?? p.project ?? "SigilOS", 80);
        const title = str(p.title ?? p.message ?? "Nouvelle issue Sentry", 256);
        const level = str(p.level ?? "error", 20);
        const issueUrl = typeof p.url === "string" && p.url.startsWith("https://") ? p.url : undefined;
        const culprit = str(p.culprit ?? "", 200);

        const description = [culprit ? `**Origine :** ${culprit}` : null, issueUrl ? `[Ouvrir dans Sentry](${issueUrl})` : null]
            .filter(Boolean)
            .join("\n")
            .slice(0, 2000);

        const discordRes = await fetch(discordWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [
                    {
                        title: `🐛 Sentry — ${title}`,
                        description: description || undefined,
                        color: levelColor(level),
                        fields: [
                            { name: "Projet", value: project, inline: true },
                            { name: "Niveau", value: level, inline: true },
                        ],
                        timestamp: new Date().toISOString(),
                    },
                ],
            }),
            signal: AbortSignal.timeout(8_000),
        });

        if (!discordRes.ok) {
            logger.error("[Sentry Relay] Discord a rejeté le relais", { status: discordRes.status });
            return NextResponse.json({ error: "Discord a rejeté le message" }, { status: 502 });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        logger.error("[Sentry Relay] Erreur interne", { error: e });
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}

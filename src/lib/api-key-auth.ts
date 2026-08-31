import { db } from "@/lib/prisma";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function validateApiKey(
    request: Request,
    targetGuildId: string,
    requiredScope: string
): Promise<{ errorResponse?: NextResponse; apiKeyRecord?: any }> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            errorResponse: NextResponse.json(
                { error: "Unauthorized: Missing or invalid Bearer token in Authorization header" },
                { status: 401 }
            )
        };
    }

    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken.startsWith("sigil_live_")) {
        return {
            errorResponse: NextResponse.json(
                { error: "Unauthorized: Invalid API key format" },
                { status: 401 }
            )
        };
    }

    const keyHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const apiKey = await db.guildApiKey.findUnique({
        where: { keyHash },
        include: { guild: true }
    });

    if (!apiKey) {
        return {
            errorResponse: NextResponse.json(
                { error: "Unauthorized: Unknown API key" },
                { status: 401 }
            )
        };
    }

    if (apiKey.revokedAt) {
        return {
            errorResponse: NextResponse.json(
                { error: "Forbidden: This API key has been revoked" },
                { status: 403 }
            )
        };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return {
            errorResponse: NextResponse.json(
                { error: "Forbidden: This API key has expired" },
                { status: 403 }
            )
        };
    }

    if (apiKey.guildId !== targetGuildId && apiKey.guild.discordGuildId !== targetGuildId) {
        return {
            errorResponse: NextResponse.json(
                { error: "Forbidden: This API key is not authorized for the requested guild" },
                { status: 403 }
            )
        };
    }

    if (!apiKey.scopes.includes(requiredScope)) {
        return {
            errorResponse: NextResponse.json(
                { error: `Forbidden: Missing required scope '${requiredScope}'` },
                { status: 403 }
            )
        };
    }

    // Touch lastUsedAt asynchronously
    db.guildApiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
    }).catch(() => {});

    return { apiKeyRecord: apiKey };
}

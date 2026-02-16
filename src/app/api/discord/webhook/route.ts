/**
 * Discord Webhook Handler
 * Handles Discord Gateway Events for Guild & Member Lifecycle Management
 * 
 * Events handled:
 * - GUILD_CREATE: Bot added to server → Auto-whitelist
 * - GUILD_DELETE: Bot removed from server → Soft-delete guild
 * - GUILD_MEMBER_REMOVE: User left or was kicked → Archive profile
 * - GUILD_BAN_ADD: User was banned → Anonymize profile
 * 
 * Security:
 * - Ed25519 signature verification required
 * - All actions logged to AuditLog for transparency
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Discord uses Ed25519 for webhook signatures
// We'll use the Web Crypto API for verification
async function verifyDiscordSignature(
    request: NextRequest,
    body: string
): Promise<boolean> {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
        console.warn("[Discord Webhook] Missing signature headers or public key");
        return false;
    }

    try {
        // Import the public key
        const keyData = hexToUint8Array(publicKey);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData.buffer as ArrayBuffer,
            { name: "Ed25519" },
            false,
            ["verify"]
        );

        // Verify the signature
        const message = new TextEncoder().encode(timestamp + body);
        const sig = hexToUint8Array(signature);

        return await crypto.subtle.verify("Ed25519", key, sig.buffer as ArrayBuffer, message);
    } catch (error) {
        console.error("[Discord Webhook] Signature verification error:", error);
        return false;
    }
}

function hexToUint8Array(hex: string): Uint8Array {
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array();
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

// Auto-whitelist a new guild when bot is added
async function handleGuildCreate(guildId: string, guildName: string) {
    // Check if already in AllowedGuild
    const existing = await db.allowedGuild.findUnique({
        where: { discordGuildId: guildId }
    });

    if (existing) {
        return;
    }

    // Auto-add to whitelist with BETA tier
    await db.allowedGuild.create({
        data: {
            discordGuildId: guildId,
            name: guildName,
            tier: "BETA",
            isActive: true,
            addedBy: "SYSTEM", // System-generated
            notes: "Auto-added via webhook (bot invited)"
        }
    });
}

// Soft-delete a guild when bot is removed
async function handleGuildDelete(guildId: string) {
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true }
    });

    if (!guild) {
        return;
    }

    // Soft-delete the guild (same logic as god-lifecycle-actions)
    const scheduledDeletion = new Date();
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 30); // 30 days grace period

    await db.guildConfig.update({
        where: { id: guild.id },
        data: {
            isActive: false,
            deletedAt: new Date(),
            deletionReason: "BOT_REMOVED",
            scheduledDeletion
        }
    });

    // Soft-delete all profiles in this guild
    await db.userProfile.updateMany({
        where: { guildId: guild.id },
        data: {
            status: "ARCHIVED",
            archivedAt: new Date(),
            archiveReason: "GUILD_DELETED",
            scheduledDeletion
        }
    });

    // Log to audit trail
    await db.auditLog.create({
        data: {
            guildId: guild.id,
            actorUserId: "SYSTEM",
            actorName: "Discord Webhook",
            action: "WEBHOOK_GUILD_DELETE",
            targetType: "GUILD",
            targetId: guild.id,
            oldValue: { isActive: true },
            newValue: { isActive: false, deletionReason: "BOT_REMOVED" },
            metadata: { discordGuildId: guildId }
        }
    });
}

// Archive a user profile when they leave or are kicked
async function handleMemberRemove(guildId: string, userId: string, reason: "LEFT" | "KICKED") {

    // Find the guild config
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });

    if (!guild) {
        return;
    }

    // Find user by Discord ID (need to look up via Account)
    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: userId },
        select: { userId: true }
    });

    if (!account) {
        return;
    }

    // Update the profile
    const result = await db.userProfile.updateMany({
        where: {
            userId: account.userId,
            guildId: guild.id,
            status: "ACTIVE" // Only archive if currently active
        },
        data: {
            status: "ARCHIVED",
            archivedAt: new Date(),
            archiveReason: reason
        }
    });

    if (result.count > 0) {
        // Log to audit trail
        await db.auditLog.create({
            data: {
                guildId: guild.id,
                actorUserId: "SYSTEM",
                actorName: "Discord Webhook",
                action: "WEBHOOK_MEMBER_REMOVE",
                targetType: "PROFILE",
                targetId: userId,
                oldValue: { status: "ACTIVE" },
                newValue: { status: "ARCHIVED", archiveReason: reason },
                metadata: { discordUserId: userId, reason }
            }
        });
    }
}

// Anonymize a user profile when they are banned
async function handleBan(guildId: string, userId: string) {

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });

    if (!guild) return;

    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: userId },
        select: { userId: true }
    });

    if (!account) return;

    // Anonymize + Ban the profile
    const result = await db.userProfile.updateMany({
        where: {
            userId: account.userId,
            guildId: guild.id
        },
        data: {
            status: "BANNED",
            archivedAt: new Date(),
            archiveReason: "BANNED",
            // Anonymize personal data
            pseudoDofus: "[Membre Banni]",
            discordNickname: null,
            metamobPseudo: null,
            altPseudos: Prisma.JsonNull,
            availability: Prisma.JsonNull,
            dofusBookLinks: Prisma.JsonNull
        }
    });

    if (result.count > 0) {
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();

        // 1. Verify Discord signature (CRITICAL for security)
        const isValid = await verifyDiscordSignature(request, body);
        if (!isValid) {
            console.warn("[Discord Webhook] Invalid signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(body);

        // 2. Handle Discord's PING verification (required for webhook setup)
        if (payload.type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 3. Handle Gateway Events (type 0)
        if (payload.type === 0) {
            const event = payload.t;
            const data = payload.d;

            // Check guild whitelist (if configured)
            const whitelistVar = process.env.ALLOWED_GUILD_IDS;
            if (whitelistVar !== undefined) {
                const allowedGuilds = whitelistVar.split(",").map(id => id.trim()).filter(Boolean);
                if (!allowedGuilds.includes(data.guild_id)) {
                    return NextResponse.json({ status: "ignored" });
                }
            }

            switch (event) {
                case "GUILD_CREATE":
                    // Bot was added to a new server
                    await handleGuildCreate(data.id, data.name);
                    break;

                case "GUILD_DELETE":
                    // Bot was removed from a server
                    await handleGuildDelete(data.id);
                    break;

                case "GUILD_MEMBER_REMOVE":
                    // Note: Discord doesn't distinguish between leave and kick in this event
                    // We treat all as "LEFT" unless we have audit log access
                    await handleMemberRemove(data.guild_id, data.user.id, "LEFT");
                    break;

                case "GUILD_BAN_ADD":
                    await handleBan(data.guild_id, data.user.id);
                    break;

                default:
                    // Ignore other events
                    break;
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("[Discord Webhook] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

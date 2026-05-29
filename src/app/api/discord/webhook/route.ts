/**
 * Discord Webhook Handler
 * Handles Discord Gateway Events for Guild & Member Lifecycle Management
 * 
 * Events handled:
 * - GUILD_CREATE: Bot added to server → Auto-whitelist
 * - GUILD_DELETE: Bot removed from server → Soft-delete guild
 * - GUILD_MEMBER_REMOVE: User left or was kicked → Archive profile
 * - GUILD_BAN_ADD: User was banned → Anonymize profile
 * - MESSAGE_CREATE: New message in blacklist channel → Add blacklist entry
 * - MESSAGE_UPDATE: Message edited in blacklist channel → Update blacklist entry
 * - MESSAGE_DELETE: Message deleted in blacklist channel → Remove blacklist entry
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
    const publicKey = process.env.DISCORD_APPLICATION_PUBLIC_KEY || process.env.DISCORD_PUBLIC_KEY;

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

    // --- NEW: Send Welcome Embed to the Guild ---
    try {
        const { sendGuildWelcomeEmbed, fetchGuild } = await import("@/server/discord");
        const guild = await fetchGuild(guildId) as any;
        
        // Try system channel first, then general-ish channels
        const targetChannelId = guild.system_channel_id;
        
        if (targetChannelId) {
            await sendGuildWelcomeEmbed(targetChannelId, guildName);
        } else {
            // Fallback: Find the first text channel the bot can write to
            const { fetchGuildChannels } = await import("@/server/discord");
            const channels = await fetchGuildChannels(guildId);
            const firstTextChannel = channels.find(c => c.type === 0); // 0 = GUILD_TEXT
            if (firstTextChannel) {
                await sendGuildWelcomeEmbed(firstTextChannel.id, guildName);
            }
        }
    } catch (err) {
        console.error("[handleGuildCreate] Failed to send welcome embed:", err);
    }
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

// Handle new member arrival
async function handleMemberAdd(guildId: string, memberData: any) {
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true }
    });

    if (!guild) return;

    const userId = memberData.user.id;
    const pseudo = memberData.nick || memberData.user.global_name || memberData.user.username;

    // Log the arrival
    await db.auditLog.create({
        data: {
            guildId: guild.id,
            actorUserId: "SYSTEM",
            actorName: "Discord Gateway Bot",
            action: "WEBHOOK_MEMBER_ADD",
            targetType: "PROFILE",
            targetId: userId,
            metadata: { 
                discordUserId: userId,
                description: pseudo,
                username: memberData.user.username,
                roles: memberData.roles,
                joinedAt: memberData.joined_at
            }
        }
    });

    // --- PRO-ACTIVE SYNC ---
    // If the user already has an account, we could auto-create/reactivate their profile here.
    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: userId },
        select: { userId: true }
    });

    if (account) {
        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: account.userId, guildId: guild.id } }
        });

        if (profile && profile.status === "ARCHIVED") {
            await db.userProfile.update({
                where: { id: profile.id },
                data: { 
                    status: "ACTIVE", 
                    archivedAt: null, 
                    archiveReason: null, 
                    scheduledDeletion: null,
                    discordNickname: memberData.nick || null
                }
            });
            
            await db.auditLog.create({
                data: {
                    guildId: guild.id,
                    actorUserId: "SYSTEM",
                    actorName: "Discord Gateway Bot",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: userId,
                    metadata: { description: pseudo, reason: "WEBHOOK_REJOIN" }
                }
            });
        }
    }
}

// Handle member profile updates (nickname, roles)
async function handleMemberUpdate(guildId: string, memberData: any) {
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });

    if (!guild) return;

    const userId = memberData.user.id;
    const pseudo = memberData.nick || memberData.user.global_name || memberData.user.username;

    // 1. Log the update for audit transparency
    await db.auditLog.create({
        data: {
            guildId: guild.id,
            actorUserId: "SYSTEM",
            actorName: "Discord Gateway Bot",
            action: "WEBHOOK_MEMBER_UPDATE",
            targetType: "PROFILE",
            targetId: userId,
            metadata: { 
                discordUserId: userId,
                description: pseudo,
                username: memberData.user.username,
                newNick: memberData.nick,
                newRoles: memberData.roles
            }
        }
    });

    // 2. Sync nickname to DB if profile exists
    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: userId },
        select: { userId: true }
    });

    if (account) {
        await db.userProfile.updateMany({
            where: { userId: account.userId, guildId: guild.id },
            data: { discordNickname: memberData.nick || null }
        });
    }
}

// Archive a user profile when they leave or are kicked
async function handleMemberRemove(guildId: string, userId: string, reason: "LEFT" | "KICKED", userMeta?: { username: string, global_name: string | null }) {

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
            archiveReason: reason,
            scheduledDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
    });

    if (result.count > 0) {
        // Notify God if this is the owner
        const guildOwner = await db.guildConfig.findFirst({
            where: { id: guild.id, ownerId: account.userId },
            select: { name: true }
        });

        if (guildOwner) {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            await notifyGod({
                title: "Propriétaire de Guilde Parti",
                message: `L'owner de la guilde **${guildOwner.name}** vient de quitter son serveur Discord.`,
                type: "SECURITY_ALERT",
                success: false,
                ping: true,
                metadata: {
                    guildId: guild.id,
                    guildName: guildOwner.name,
                    discordUserId: userId,
                    action: "MEMBER_REMOVE_WEBHOOK"
                }
            });
        }

        // Log to audit trail
        const pseudo = userMeta ? (userMeta.global_name || userMeta.username) : userId;

        await db.auditLog.create({
            data: {
                guildId: guild.id,
                actorUserId: "SYSTEM",
                actorName: "Discord Gateway Bot",
                action: "PLATFORM_DEPARTURE", // Platform-wide departure log
                targetType: "PROFILE",
                targetId: userId,
                oldValue: { status: "ACTIVE" },
                newValue: { status: "ARCHIVED", archiveReason: reason },
                metadata: { 
                    discordUserId: userId, 
                    description: pseudo, // NEW: UI uses this for display
                    username: userMeta?.username,
                    reason, 
                    originalAction: "WEBHOOK_MEMBER_REMOVE" 
                }
            }
        });
    }
}

// Anonymize a user profile when they are banned
async function handleBan(guildId: string, userId: string, userMeta?: { username: string, global_name: string | null }) {

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
            scheduledDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            // Anonymize personal data
            pseudoDofus: "[Membre Banni]",
            discordNickname: null,
            metamobPseudo: null,
            altPseudos: Prisma.JsonNull,
            availability: Prisma.JsonNull,
            dofusBookLinks: Prisma.JsonNull
        }
    });

    // Notify God if this is the owner
    const guildOwner = await db.guildConfig.findFirst({
        where: { id: guild.id, ownerId: account.userId },
        select: { name: true }
    });

    if (guildOwner) {
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "Propriétaire de Guilde Banni",
            message: `L'owner de la guilde **${guildOwner.name}** vient d'être banni du serveur Discord.`,
            type: "SECURITY_ALERT",
            success: false,
            ping: true,
            metadata: {
                guildId: guild.id,
                guildName: guildOwner.name,
                discordUserId: userId,
                action: "BAN_WEBHOOK"
            }
        });
    }

    if (result.count > 0) {
        // Log to audit trail
        const pseudo = userMeta ? (userMeta.global_name || userMeta.username) : userId;

        await db.auditLog.create({
            data: {
                guildId: guild.id,
                actorUserId: "SYSTEM",
                actorName: "Discord Gateway Bot",
                action: "MEMBER_BANNED",
                targetType: "PROFILE",
                targetId: userId,
                oldValue: { status: "ACTIVE" },
                newValue: { status: "BANNED" },
                metadata: { 
                    discordUserId: userId, 
                    description: pseudo,
                    username: userMeta?.username,
                    originalAction: "WEBHOOK_BAN_ADD" 
                }
            }
        });
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

                case "GUILD_MEMBER_ADD":
                    await handleMemberAdd(data.guild_id, data);
                    break;

                case "GUILD_MEMBER_REMOVE":
                    // Note: Discord doesn't distinguish between leave and kick in this event
                    // We treat all as "LEFT" unless we have audit log access
                    await handleMemberRemove(data.guild_id, data.user.id, "LEFT", data.user);
                    break;

                case "GUILD_MEMBER_UPDATE":
                    await handleMemberUpdate(data.guild_id, data);
                    break;

                case "GUILD_BAN_ADD":
                    await handleBan(data.guild_id, data.user.id, data.user);
                    break;

                case "MESSAGE_CREATE":
                    if (!data.author?.bot) {
                        const { handleDiscordBlacklistCreate } = await import("@/server/actions/blacklist-actions");
                        await handleDiscordBlacklistCreate(data.guild_id, data);
                    }
                    break;

                case "MESSAGE_UPDATE":
                    if (!data.author?.bot) {
                        const { handleDiscordBlacklistUpdate } = await import("@/server/actions/blacklist-actions");
                        await handleDiscordBlacklistUpdate(data.guild_id, data);
                    }
                    break;

                case "MESSAGE_DELETE":
                    const { handleDiscordBlacklistDelete } = await import("@/server/actions/blacklist-actions");
                    await handleDiscordBlacklistDelete(data.guild_id, data.id);
                    const { handleDiscordGalleryDelete } = await import("@/server/actions/gallery-actions");
                    await handleDiscordGalleryDelete(data.guild_id, data.id);
                    const { handleDiscordDjPostDelete } = await import("@/server/actions/dungeon-finder-actions");
                    await handleDiscordDjPostDelete(data.guild_id, data.id);
                    break;

                case "CHANNEL_DELETE":
                case "THREAD_DELETE":
                    const { handleDiscordDjChannelDelete } = await import("@/server/actions/dungeon-finder-actions");
                    await handleDiscordDjChannelDelete(data.guild_id, data.id);
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

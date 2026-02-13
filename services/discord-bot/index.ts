/**
 * SigilOS Discord Gateway Bot
 * 
 * Handles Discord guild and member lifecycle events via WebSocket Gateway.
 * Automatically syncs guild whitelist and member profiles with the database.
 * 
 * Events handled:
 * - GUILD_CREATE: Bot added to server → Auto-whitelist in AllowedGuild
 * - GUILD_DELETE: Bot removed → Soft-delete GuildConfig + archive profiles
 * - GUILD_MEMBER_REMOVE: Member left/kicked → Archive UserProfile
 */

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Env vars are injected by Docker Compose (env_file), no dotenv needed

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('[Discord Bot] ❌ DATABASE_URL not found in environment variables');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter, datasourceUrl: databaseUrl });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

// ========================
// Event: Bot Ready
// ========================
client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Discord Bot] ✅ Logged in as ${readyClient.user.tag}`);
    console.log(`[Discord Bot] 🌐 Serving ${readyClient.guilds.cache.size} guilds`);
});

// ========================
// Event: Guild Create (Bot Added)
// ========================
client.on(Events.GuildCreate, async (guild) => {
    console.log(`[Discord Bot] ➕ Guild added: ${guild.name} (${guild.id})`);

    try {
        // Check if already whitelisted
        const existing = await db.allowedGuild.findUnique({
            where: { discordGuildId: guild.id },
        });

        if (existing) {
            console.log(`[Discord Bot] Guild ${guild.name} already whitelisted`);
            return;
        }

        // Auto-add to whitelist
        await db.allowedGuild.create({
            data: {
                discordGuildId: guild.id,
                name: guild.name,
                tier: 'BETA',
                isActive: true,
                addedBy: 'SYSTEM',
                notes: `Auto-added via Gateway bot on ${new Date().toISOString()}`,
            },
        });

        // Log audit
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guild.id },
            select: { id: true },
        });

        if (guildConfig) {
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Discord Gateway Bot',
                    action: 'WEBHOOK_GUILD_CREATE',
                    targetType: 'GUILD',
                    targetId: guildConfig.id,
                    oldValue: {},
                    newValue: { whitelisted: true, tier: 'BETA' },
                    metadata: { discordGuildId: guild.id, guildName: guild.name },
                },
            });
        }

        console.log(`[Discord Bot] ✅ Auto-whitelisted: ${guild.name}`);
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_CREATE:`, error);
    }
});

// ========================
// Event: Guild Delete (Bot Removed)
// ========================
client.on(Events.GuildDelete, async (guild) => {
    console.log(`[Discord Bot] ➖ Guild removed: ${guild.name} (${guild.id})`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guild.id },
            select: { id: true, name: true },
        });

        if (!guildConfig) {
            console.log(`[Discord Bot] Guild ${guild.id} not in database, ignoring`);
            return;
        }

        // Soft-delete guild
        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + 30); // 30 days grace

        await db.guildConfig.update({
            where: { id: guildConfig.id },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletionReason: 'BOT_REMOVED',
                scheduledDeletion,
            },
        });

        // Archive all profiles
        await db.userProfile.updateMany({
            where: { guildId: guildConfig.id },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'GUILD_DELETED',
                scheduledDeletion,
            },
        });

        // Log audit
        await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId: 'SYSTEM',
                actorName: 'Discord Gateway Bot',
                action: 'WEBHOOK_GUILD_DELETE',
                targetType: 'GUILD',
                targetId: guildConfig.id,
                oldValue: { isActive: true },
                newValue: { isActive: false, deletionReason: 'BOT_REMOVED' },
                metadata: { discordGuildId: guild.id },
            },
        });

        console.log(`[Discord Bot] 🗑️ Soft-deleted guild: ${guildConfig.name}`);
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_DELETE:`, error);
    }
});

// ========================
// Event: Member Remove
// ========================
client.on(Events.GuildMemberRemove, async (member) => {
    console.log(`[Discord Bot] 👤 Member left: ${member.user.tag} from ${member.guild.name}`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: member.guild.id },
            select: { id: true },
        });

        if (!guildConfig) return;

        // Find user account
        const account = await db.account.findFirst({
            where: {
                provider: 'discord',
                providerAccountId: member.user.id,
            },
            select: { userId: true },
        });

        if (!account) return;

        // Archive profile
        const result = await db.userProfile.updateMany({
            where: {
                userId: account.userId,
                guildId: guildConfig.id,
                status: 'ACTIVE',
            },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'LEFT',
            },
        });

        if (result.count > 0) {
            // Log audit
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Discord Gateway Bot',
                    action: 'WEBHOOK_MEMBER_REMOVE',
                    targetType: 'PROFILE',
                    targetId: member.user.id,
                    oldValue: { status: 'ACTIVE' },
                    newValue: { status: 'ARCHIVED', archiveReason: 'LEFT' },
                    metadata: { discordUserId: member.user.id, username: member.user.tag },
                },
            });

            console.log(`[Discord Bot] ✅ Archived profile for ${member.user.tag}`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_REMOVE:`, error);
    }
});

// ========================
// Graceful Shutdown
// ========================
process.on('SIGTERM', async () => {
    console.log('[Discord Bot] SIGTERM received, shutting down gracefully...');
    client.destroy();
    await db.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Discord Bot] SIGINT received, shutting down gracefully...');
    client.destroy();
    await db.$disconnect();
    process.exit(0);
});

// ========================
// Start Bot
// ========================
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
    console.error('[Discord Bot] ❌ DISCORD_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

client.login(token).catch((error) => {
    console.error('[Discord Bot] ❌ Failed to login:', error);
    process.exit(1);
});

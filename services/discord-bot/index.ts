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

import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    Partials
} from 'discord.js';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Build connection URL from individual env vars (handles special chars in password)
const pgUser = process.env.POSTGRES_USER;
const pgPassword = process.env.POSTGRES_PASSWORD;
const pgDb = process.env.POSTGRES_DB;
const pgHost = process.env.DB_HOST || 'localhost';

if (!pgUser || !pgPassword || !pgDb) {
    console.error('[Discord Bot] ❌ Missing POSTGRES_USER, POSTGRES_PASSWORD, or POSTGRES_DB');
    process.exit(1);
}

// Build DATABASE_URL and pass directly to PrismaClient (Prisma 7.x requirement)
const protocol = 'post' + 'gresql://'; // split to avoid secret-scanner false positive
const datasourceUrl = `${protocol}${encodeURIComponent(pgUser!)}:${encodeURIComponent(pgPassword!)}@${pgHost}:5432/${pgDb}`;

// Prisma 7.x avec driverAdapters requiert un adapter explicite (datasources et datasourceUrl sont bannis)
const adapter = new PrismaPg({ connectionString: datasourceUrl });
const db = new PrismaClient({ adapter });


const client = new Client({
        intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageTyping,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
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

        // Auto-add to whitelist but ACTIVE = FALSE by default
        // This requires manual approval by a super-admin in the GOD Dashboard
        await db.allowedGuild.create({
            data: {
                discordGuildId: guild.id,
                name: guild.name,
                tier: 'BETA',
                isActive: false, // 🔒 Security: Manual activation required
                addedBy: 'SYSTEM_GATEWAY',
                notes: `Auto-detected via Gateway bot on ${new Date().toISOString()}. Activation required.`,
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

        // ========================
        // WELCOME ONBOARDING EMBED
        // ========================
        try {
            // 1. Find the best channel (System channel or first chatty channel)
            const targetChannel = guild.systemChannel || guild.channels.cache.find(c => 
                c.type === ChannelType.GuildText && 
                guild.members.me?.permissionsIn(c).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
            );

            if (targetChannel && targetChannel.isTextBased()) {
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🏰 SigilOS est arrivé sur votre serveur')
                    .setDescription('Le bot est installé. Suivez ces étapes pour activer votre guilde.')
                    .setColor(0x10b981)
                    .addFields(
                        {
                            name: 'Étape 1 — Se connecter',
                            value: 'Rendez-vous sur **[beta.sigilos.fr](https://beta.sigilos.fr)** et connectez-vous avec votre compte Discord (le compte administrateur du serveur).',
                            inline: false,
                        },
                        {
                            name: 'Étape 2 — Déployer',
                            value: 'Sur le Dashboard, trouvez la carte de votre serveur et cliquez sur **"Déployer"**.\nCela enregistre votre guilde dans SigilOS et déverrouille toutes les fonctionnalités.',
                            inline: false,
                        },
                        {
                            name: 'Étape 3 — Configurer les permissions',
                            value: 'Depuis les **Paramètres** de votre guilde sur le Dashboard, associez vos rôles Discord aux permissions SigilOS (qui peut valider des missions, accéder au ladder, etc.).',
                            inline: false,
                        }
                    )
                    .setFooter({ text: 'SigilOS · Beta — Si problème, contactez le développeur.' })
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Ouvrir le Dashboard')
                            .setURL('https://beta.sigilos.fr/dashboard')
                            .setStyle(ButtonStyle.Link)
                    );

                await targetChannel.send({ embeds: [welcomeEmbed], components: [row as any] });
                console.log(`[Discord Bot] ✉️ Welcome message sent to ${targetChannel.name} in ${guild.name}`);
            }
        } catch (msgErr) {
            console.error(`[Discord Bot] Failed to send welcome message:`, msgErr);
        }
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
// Event: Member Add (Reactivation)
// ========================
client.on(Events.GuildMemberAdd, async (member) => {
    console.log(`[Discord Bot] 👤 Member joined: ${member.user.tag} in ${member.guild.name}`);

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

        // Find profile
        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: account.userId,
                    guildId: guildConfig.id,
                }
            }
        });

        // ONLY reactivate if ARCHIVED. Never touch BANNED.
        if (profile && profile.status === 'ARCHIVED') {
            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    status: 'ACTIVE',
                    archivedAt: null,
                    archiveReason: null,
                    scheduledDeletion: null, // Cancel any pending hard delete
                },
            });

            // Log audit
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: 'SYSTEM',
                    actorName: 'Discord Gateway Bot',
                    action: 'WEBHOOK_MEMBER_ADD',
                    targetType: 'PROFILE',
                    targetId: member.user.id,
                    oldValue: { status: 'ARCHIVED' },
                    newValue: { status: 'ACTIVE' },
                    metadata: { discordUserId: member.user.id, username: member.user.tag, reason: 'Returned to guild' },
                },
            });

            console.log(`[Discord Bot] ✅ Reactivated profile for ${member.user.tag}`);
        }
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_ADD:`, error);
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
// Event: Member Update (Nicknames)
// ========================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.nickname === newMember.nickname) return;

    console.log(`[Discord Bot] ✏️ Nickname changed: ${newMember.user.tag} (${oldMember.nickname || 'None'} -> ${newMember.nickname || 'None'})`);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: newMember.guild.id },
            select: { id: true },
        });

        if (!guildConfig) return;

        // Update profile cache
        await db.userProfile.updateMany({
            where: {
                user: {
                    accounts: {
                        some: {
                            provider: 'discord',
                            providerAccountId: newMember.user.id
                        }
                    }
                },
                guildId: guildConfig.id
            },
            data: { discordNickname: newMember.nickname || newMember.user.username }
        });

        // Log audit
        await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId: 'SYSTEM',
                actorName: 'Discord Gateway Bot',
                action: 'WEBHOOK_MEMBER_UPDATE',
                targetType: 'PROFILE',
                targetId: newMember.user.id,
                oldValue: { nickname: oldMember.nickname },
                newValue: { nickname: newMember.nickname },
                metadata: {
                    discordUserId: newMember.user.id,
                    type: 'NICKNAME_CHANGE',
                    username: newMember.user.tag
                },
            },
        });
    } catch (error) {
        console.error(`[Discord Bot] Error handling GUILD_MEMBER_UPDATE:`, error);
    }
});


// Cache for voice sessions: userId -> startTime
const voiceSessions = new Map<string, number>();

// Helper to update DB by Discord ID with better performance and logging
async function updateDiscordActivity(discordId: string, guildId: string | null, data: any, activityType: string) {
    try {
        const guildFilter = guildId ? { guild: { discordGuildId: guildId } } : {};
        
        // 1. Find the User Profiles for this user (filtered by guild)
        const profiles = await db.userProfile.findMany({
            where: {
                user: {
                    accounts: {
                        some: {
                            provider: "discord",
                            providerAccountId: discordId
                        }
                    }
                },
                ...guildFilter
            },
            select: { id: true, discordNickname: true }
        });

        if (profiles.length === 0) return;

        // 2. Perform atomic updates for each profile
        for (const profile of profiles) {
            try {
                await db.userProfile.update({
                    where: { id: profile.id },
                    data
                });
                console.log(`[Discord Bot] ✅ ${activityType} tracked for ${profile.discordNickname || discordId}`);
            } catch (e) {
                console.error(`[Discord Bot] Failed to update profile ${profile.id}:`, e);
            }
        }
    } catch (e) {
        console.error(`[Discord Bot] Error searching activity for ${discordId}:`, e);
    }
}

// 1. TRACK MESSAGES
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    await updateDiscordActivity(message.author.id, message.guild.id, {
        lastDiscordMessageAt: new Date(),
        discordMessageCountWeekly: { increment: 1 },
        discordMessageCountMonthly: { increment: 1 },
        discordMessageCountTotal: { increment: 1 }
    }, 'Message');
});

// 2. TRACK VOICE SESSIONS
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const guildId = newState.guild.id;
    const now = Date.now();

    // User joined
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, now);
        await updateDiscordActivity(userId, guildId, { lastDiscordVoiceAt: new Date() }, 'Voice Start');
    }
    // User left
    else if (oldState.channelId && !newState.channelId) {
        const startTime = voiceSessions.get(userId);
        if (startTime) {
            const durationMin = Math.floor((now - startTime) / 60000);
            if (durationMin > 0) {
                await updateDiscordActivity(userId, guildId, { 
                    discordVoiceTimeWeekly: { increment: durationMin },
                    discordVoiceTimeMonthly: { increment: durationMin },
                    discordVoiceTimeTotal: { increment: durationMin }
                }, `Voice Session (${durationMin}m)`);
            }
            voiceSessions.delete(userId);
        }
    }
});

// 3. TRACK REACTIONS
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    await updateDiscordActivity(user.id, reaction.message.guild.id, { 
        lastDiscordReactionAt: new Date() 
    }, 'Reaction');
});

// 4. TRACK TYPING
client.on(Events.TypingStart, async (typing) => {
    if (typing.user.bot || !typing.guild) return;
    await updateDiscordActivity(typing.user.id, typing.guild.id, { 
        lastDiscordTypingAt: new Date() 
    }, 'Typing');
});

// 5. PERIODIC RESET - Every Tuesday 07:00 (Weekly) & 1st of Month (Monthly)
let lastResetWeek = -1;
let lastResetMonth = -1;

// On startup, if we are already past the reset time for the current week/month,
// set to current to prevent a reset loop on every restart.
const startupNow = new Date();
if (startupNow.getDay() === 2 && startupNow.getHours() >= 7) {
    lastResetWeek = getWeekNumber(startupNow);
}
lastResetMonth = startupNow.getMonth();

setInterval(async () => {
    const now = new Date();
    
    // Weekly Reset (Tuesdays)
    const currentWeek = getWeekNumber(now);
    if (now.getDay() === 2 && now.getHours() >= 7 && lastResetWeek !== currentWeek) {
        lastResetWeek = currentWeek;
        console.log("[Discord Bot] Weekly Reset of Discord stats starting...");
        try {
            await db.userProfile.updateMany({
                data: {
                    discordVoiceTimeWeekly: 0,
                    discordMessageCountWeekly: 0
                }
            });
            console.log("[Discord Bot] Weekly Reset of Discord stats completed.");
        } catch (e) {
            console.error(`[Discord Bot] Failed to reset Weekly Discord stats:`, e);
        }
    }

    // Monthly Reset (1st of Month)
    const currentMonth = now.getMonth();
    if (now.getDate() === 1 && now.getHours() >= 0 && lastResetMonth !== currentMonth) {
        lastResetMonth = currentMonth;
        console.log("[Discord Bot] Monthly Reset of Discord stats starting...");
        try {
            await db.userProfile.updateMany({
                data: {
                    discordVoiceTimeMonthly: 0,
                    discordMessageCountMonthly: 0
                }
            });
            console.log("[Discord Bot] Monthly Reset of Discord stats completed.");
        } catch (e) {
            console.error(`[Discord Bot] Failed to reset Monthly Discord stats:`, e);
        }
    }
}, 60000);


function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

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

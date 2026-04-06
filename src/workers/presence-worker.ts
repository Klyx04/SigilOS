import './init-env';

import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { db } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Presence Worker - Tracks real-time Discord activity (messages, voice, reactions)
 * and syncs it to the UserProfile table for admin insights.
 */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageTyping, // Needed for "qui tape"
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Cache for voice sessions: userId -> startTime
const voiceSessions = new Map<string, number>();

client.once(Events.ClientReady, (c) => {
    logger.info(`[PresenceBot] Ready! Logged in as ${c.user.tag}`);
    logger.info(`[PresenceBot] Active in ${c.guilds.cache.size} guilds: ${c.guilds.cache.map(g => g.name).join(', ')}`);
});

// Helper to update DB by Discord ID with better performance and logging
// Now supports guild scoping and uses atomic updates correctly
async function updateDiscordActivity(discordId: string, guildId: string | null, data: any) {
    try {
        const guildFilter = guildId ? { guild: { discordGuildId: guildId } } : {};
        
        // 1. Find the User Profiles for this user (optionally filtered by guild)
        const profiles = await (db as any).userProfile.findMany({
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
            select: { id: true }
        });

        if (profiles.length === 0) {
            // Member not found or not in this guild, skip
            return;
        }

        // 2. Perform atomic updates for each profile
        for (const profile of profiles) {
            try {
                await (db as any).userProfile.update({
                    where: { id: profile.id },
                    data
                });
            } catch (e) {
                logger.error(`[PresenceBot] Failed to update profile ${profile.id}:`, { error: e });
            }
        }
    } catch (e) {
        logger.error(`[PresenceBot] Error searching activity for ${discordId}:`, { error: e instanceof Error ? e.message : 'Unknown' });
    }
}

// 1. TRACK MESSAGES (qui poste)
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    await updateDiscordActivity(message.author.id, message.guild.id, {
        lastDiscordMessageAt: new Date(),
        discordMessageCountWeekly: { increment: 1 }
    });
});

// 2. TRACK VOICE SESSIONS (vocal)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const guildId = newState.guild.id;
    const now = Date.now();

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, now);
        await updateDiscordActivity(userId, guildId, { lastDiscordVoiceAt: new Date() });
    }
    
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
        const startTime = voiceSessions.get(userId);
        if (startTime) {
            const durationMin = Math.floor((now - startTime) / 60000);
            if (durationMin > 0) {
                await updateDiscordActivity(userId, guildId, { 
                    discordVoiceTimeWeekly: { increment: durationMin } 
                });
            }
            voiceSessions.delete(userId);
        }
    }
});

// 3. TRACK REACTIONS (qui réagit)
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    await updateDiscordActivity(user.id, reaction.message.guild.id, { lastDiscordReactionAt: new Date() });
});

// 4. TRACK TYPING (qui tape)
client.on(Events.TypingStart, async (typing) => {
    if (typing.user.bot || !typing.guild) return;
    await updateDiscordActivity(typing.user.id, typing.guild.id, { lastDiscordTypingAt: new Date() });
});

// 5. PERIODIC RESET - Every Tuesday morning at 07:00 (Paris time)
let lastResetWeek = -1;

setInterval(async () => {
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    
    // Check if it's Tuesday 07:00 or after, and we haven't reset for this week yet
    if (now.getDay() === 2 && now.getHours() >= 7 && lastResetWeek !== currentWeek) {
        lastResetWeek = currentWeek;
        logger.info("[PresenceBot] Weekly Reset of Discord stats starting...");
        try {
            await (db as any).userProfile.updateMany({
                data: {
                    discordVoiceTimeWeekly: 0,
                    discordMessageCountWeekly: 0
                }
            });
            logger.info("[PresenceBot] Weekly Reset of Discord stats completed.");
        } catch (e) {
            logger.error(`[PresenceBot] Failed to reset Discord stats: ${e instanceof Error ? e.message : 'Unknown'}`);
        }
    }
}, 60000);

// Simple week number helper
function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

client.login(process.env.DISCORD_BOT_TOKEN);

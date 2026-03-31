import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { db } from '../lib/prisma';
import { logger } from '../lib/logger';
import * as dotenv from 'dotenv';

dotenv.config();

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
});

// 1. TRACK MESSAGES (qui poste)
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    await updateDiscordActivity(message.author.id, {
        lastDiscordMessageAt: new Date(),
        discordMessageCountWeekly: { increment: 1 }
    });
});

// 2. TRACK VOICE SESSIONS (vocal)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const now = Date.now();

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, now);
        await updateDiscordActivity(userId, { lastDiscordVoiceAt: new Date() });
    }
    
    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
        const startTime = voiceSessions.get(userId);
        if (startTime) {
            const durationMin = Math.floor((now - startTime) / 60000);
            if (durationMin > 0) {
                await updateDiscordActivity(userId, { 
                    discordVoiceTimeWeekly: { increment: durationMin } 
                });
            }
            voiceSessions.delete(userId);
        }
    }
});

// 3. TRACK REACTIONS (qui réagit)
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    await updateDiscordActivity(user.id, { lastDiscordReactionAt: new Date() });
});

// 4. TRACK TYPING (qui tape)
client.on(Events.TypingStart, async (typing) => {
    if (typing.user.bot) return;
    await updateDiscordActivity(typing.user.id, { lastDiscordTypingAt: new Date() });
});

// Helper to update DB by Discord ID
async function updateDiscordActivity(discordId: string, data: any) {
    try {
        await db.userProfile.updateMany({
            where: {
                user: {
                    accounts: {
                        some: {
                            provider: "discord",
                            providerAccountId: discordId
                        }
                    }
                }
            },
            data
        });
    } catch (e) {
        // Log errors but don't crash the worker
    }
}

// 4. PERIODIC RESET - Every Tuesday morning at 07:00 (Paris time)
// In a real production environment, this would be a CRON job.
// For this worker, we'll just check periodically.
setInterval(async () => {
    const now = new Date();
    // Simplified Tuesday 07:00 check
    if (now.getDay() === 2 && now.getHours() === 7 && now.getMinutes() === 0) {
        logger.info("[PresenceBot] Weekly Reset of Discord stats...");
        await db.userProfile.updateMany({
            data: {
                discordVoiceTimeWeekly: 0,
                discordMessageCountWeekly: 0
            }
        });
    }
}, 60000);

client.login(process.env.DISCORD_BOT_TOKEN);

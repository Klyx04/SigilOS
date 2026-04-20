
import { Client, GatewayIntentBits, VoiceState, Collection } from "discord.js";
import { logger } from "../../lib/logger";

export interface VoiceUser {
    userId: string;
    userName: string;
    avatar: string | null;
    channelId: string;
    channelName: string;
    isMute: boolean;
    isDeaf: boolean;
    isSpeaking?: boolean;
}

/**
 * DiscordVoiceService - Gateway-based voice monitoring
 * Tracks real-time voice states across guilds.
 */
export class DiscordVoiceService {
    private static instance: DiscordVoiceService;
    private client: Client;
    private voiceStates: Map<string, Map<string, VoiceUser>> = new Map();
    private onUpdateCallback: ((guildId: string, users: VoiceUser[]) => void) | null = null;

    private constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers, // Needed to resolve nicknames
            ],
        });

        this.setupEvents();
    }

    public static getInstance(): DiscordVoiceService {
        if (!DiscordVoiceService.instance) {
            DiscordVoiceService.instance = new DiscordVoiceService();
        }
        return DiscordVoiceService.instance;
    }

    public async start() {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            logger.warn("[DiscordVoice] ⚠️ Missing DISCORD_BOT_TOKEN. Voice monitoring disabled.");
            return;
        }

        try {
            await this.client.login(token);
            logger.info("[DiscordVoice] 🚀 Gateway connected.");
        } catch (error) {
            logger.error("[DiscordVoice] ❌ Login failed:", error as any);
        }
    }

    private setupEvents() {
        this.client.on("ready", () => {
            logger.info(`[DiscordVoice] Logged in as ${this.client.user?.tag}`);
            // Initial scan of guilds already in cache
            this.client.guilds.cache.forEach(guild => this.refreshGuild(guild.id));
        });

        this.client.on("voiceStateUpdate", (oldState, newState) => {
            const guildId = newState.guild?.id || oldState.guild?.id;
            if (guildId) {
                this.refreshGuild(guildId);
            }
        });

        // Speaking events require a connection to voice, which we don't have.
        // We'll stick to basic VoiceStates (mute/deaf/channel).
    }

    private async refreshGuild(guildId: string) {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const guildMap = new Map<string, VoiceUser>();
        
        guild.voiceStates.cache.forEach((vs: VoiceState) => {
            if (!vs.member || vs.member.user.bot) return;
            
            const channel = vs.channel;
            if (!channel) return;

            guildMap.set(vs.id, {
                userId: vs.id,
                userName: vs.member.displayName,
                avatar: vs.member.user.displayAvatarURL({ extension: 'png', size: 64 }),
                channelId: channel.id,
                channelName: channel.name,
                isMute: vs.selfMute || vs.serverMute || false,
                isDeaf: vs.selfDeaf || vs.serverDeaf || false,
            });
        });

        this.voiceStates.set(guildId, guildMap);

        // Notify subscribers
        if (this.onUpdateCallback) {
            this.onUpdateCallback(guildId, Array.from(guildMap.values()));
        }
    }

    public setOnUpdate(callback: (guildId: string, users: VoiceUser[]) => void) {
        this.onUpdateCallback = callback;
    }

    public getVoiceUsers(guildId: string): VoiceUser[] {
        const map = this.voiceStates.get(guildId);
        return map ? Array.from(map.values()) : [];
    }

    public async stop() {
        await this.client.destroy();
    }
}

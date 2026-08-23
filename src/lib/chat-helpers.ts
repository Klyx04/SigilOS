// src/lib/chat-helpers.ts
// Standard helpers for the guild chat system (Redis based)

export const CHAT_TTL_SECONDS = 3600 * 24; // 24 hours
export const CHAT_HISTORY_LIMIT = 50;   // Keep last 50 messages in Redis

/**
 * Redis Key for the chat history (List of JSON messages)
 */
export function chatKey(guildId: string) {
    return `chat:history:${guildId}`;
}

/**
 * Redis Pub/Sub channel for live message broadcasting
 */
export function chatPubSubChannel(guildId: string) {
    return `chat:pubsub:${guildId}`;
}

/**
 * Redis Hash key for tracking online status
 * Format: chat:online:{guildId} -> { userId:connectionId -> JSON }
 */
export function chatOnlineUsersKey(guildId: string) {
    return `chat:online:${guildId}`;
}

/**
 * SONGES: Redis Pub/Sub channel for a specific run
 */
export function runChatPubSubChannel(runId: string) {
    return `chat:run:pubsub:${runId}`;
}

/**
 * SONGES: Redis Hash key for tracking online status in a specific run
 */
export function runChatOnlineUsersKey(runId: string) {
    return `chat:run:online:${runId}`;
}

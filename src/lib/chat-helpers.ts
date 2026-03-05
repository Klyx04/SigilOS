/**
 * Chat Helpers — Redis keys, sanitization, wordlist, constants
 * NO "use server" — safe to import from both client and server
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
export const CHAT_MAX_LENGTH = 500;
export const CHAT_HISTORY_LIMIT = 200;    // max messages stored per scope
export const CHAT_TTL_SECONDS = 86400;     // 24h TTL
export const CHAT_RATE_LIMIT = 10;         // max msgs/min
export const CHAT_RATE_WINDOW_MS = 60_000; // 1 minute
export const CHAT_COOLDOWN_MS = 1500;      // min 1.5s between messages
export const CHAT_TYPING_TTL = 5;          // seconds for typing indicator

// ─────────────────────────────────────────────────────────────────────────────
// REDIS KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
export const chatKey = (guildId: string) => `chat:guild:${guildId}:messages`;
export const chatCounterKey = (guildId: string) => `chat:guild:${guildId}:counter`;
export const chatTypingKey = (guildId: string) => `chat:guild:${guildId}:typing`;
export const chatMutedKey = (guildId: string) => `chat:guild:${guildId}:muted`;
export const chatMuteUserKey = (guildId: string, userId: string) => `chat:guild:${guildId}:mute:${userId}`;
export const chatPubSubChannel = (guildId: string) => `chat:guild:${guildId}:stream`;
export const chatLastMsgKey = (userId: string, guildId: string) => `chat:guild:${guildId}:lastmsg:${userId}`;
export const chatStatsKey = (guildId: string) => `chat:guild:${guildId}:stats:daily`;
export const chatOnlineUsersKey = (guildId: string) => `chat:guild:${guildId}:online`;

// Run-scoped keys
export const runChatKey = (runId: string) => `chat:run:${runId}:messages`;
export const runChatCounterKey = (runId: string) => `chat:run:${runId}:counter`;
export const runChatTypingKey = (runId: string) => `chat:run:${runId}:typing`;
export const runChatPubSubChannel = (runId: string) => `chat:run:${runId}:stream`;
export const runChatOnlineUsersKey = (runId: string) => `chat:run:${runId}:online`;

// User-specific keys (strikes/bans)
export const chatStrikesKey = (userId: string) => `chat:strikes:${userId}`;
export const chatGlobalBanKey = (userId: string) => `chat:banned:${userId}`;

// Platform-scoped keys
export const chatGlobalBlocklistKey = "chat:global:blocklist";


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type ChatScope = "guild" | "run";

export type ChatMessage = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorImage?: string;
    createdAt: string; // ISO string
    type: "user" | "system" | "typing" | "presence" | "poll";
    systemMeta?: Record<string, unknown>; // for system messages (mission validated, etc.)
    pollData?: {
        question: string;
        options: { id: string; text: string; votes: number }[];
        voters: Record<string, string>; // userId -> optionId
        closed?: boolean;
    };
    onlineUsers?: { id: string, name: string, image?: string }[];
    mentions?: string[]; // IDs of mentioned users or roles
    _ts?: number; // Internal timestamp for force-reacting to events
};

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

// Strip dangerous Unicode control characters, zero-width chars, RTL override
const DANGEROUS_UNICODE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

// Detect URLs — only allow whitelisted domains
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const ALLOWED_DOMAINS = ["sigilos.fr", "beta.sigilos.fr", "dofusdb.fr"];

function isAllowedUrl(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
        return false;
    }
}

export function sanitizeMessage(raw: string): string | null {
    if (!raw || typeof raw !== "string") return null;

    // Trim & normalize whitespace
    let text = raw.trim().replace(/\s+/g, " ");

    // Strip dangerous Unicode
    text = text.replace(DANGEROUS_UNICODE, "");

    // Length guard
    if (text.length === 0 || text.length > CHAT_MAX_LENGTH) return null;

    return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORDLIST (FR — Comprehensive Dataset)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Striking System Constants
 */
export const CHAT_STRIKE_THRESHOLD = 3;       // 3 strikes = temporary ban
export const CHAT_STRIKE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window to get 3 strikes
export const CHAT_BAN_DURATION_SEC = 15 * 60; // 15 minutes ban

/**
 * Base wordlist (hardcoded as requested)
 * Includes slurs, heavy insults, and toxic patterns.
 * This list is normalized during check.
 */
export const BASE_BLOCKED_WORDS = [
    // --- Insultes & Sexualisé ---
    "con", "connard", "connasse", "conne", "salope", "salopiaud", "salaud",
    "pute", "putain", "putin", "pouffiasse", "grognasse", "chiennasse", "grogniasse",
    "merde", "merdeux", "merdeuse", "emmerdeur", "emmerdeuse", "chiasse",
    "bite", "bitte", "chatte", "couille", "couilles", "fion", "trouduc", "trou du cul", "zguegue", "chibre", "teube", "teuch",
    "suce", "suceur", "suceuse", "turlute", "branleur", "branleuse", "branlette", "palucher",
    "clito", "clitoris", "nichons", "boobs", "sexe", "porno", "porn", "anal", "sperme", "ejac", "pipe", "foutre", "ramoner", "troncher", "tringler",
    // --- Slurs & Discriminations ---
    "pd", "pede", "pédé", "pédale", "tarlouze", "tapette", "gouine", "lesbienne", "faggot", "folle",
    "bougnoule", "negre", "nègre", "négro", "niackoue", "niaqoue", "gnioule", "youpin",
    "nazi", "hitler",
    "encule", "enculé", "enculée", "enculeur",
    "batard", "bâtard", "enfoire", "enfoiré", "enfoirée",
    // --- Comportement & Toxicité (Gaming & Health Slurs) ---
    "fils de pute", "fille de pute", "nique ta mere", "nique ta chienne", "nique ta race", "nique tes morts",
    "va te faire", "ferme ta gueule", "tg", "fdp", "ntm", "sac à foutre", "sac à merde",
    "va mourir", "pend toi", "suicide toi", "suicide-toi", "creve", "crève", "pend", "pends", "suicide",
    "autiste", "gogol", "trisomique", "mongol", "mongolito", "debile", "débile", "attardé",
    "noob", "casse toi", "trash", "sale gosse", "boloss", "bouffon", "clochard", "cancer", "sida", "tumeur",
    // --- Regex patterns (Smart Moderation) ---
    "/kamash?/", "/discord\\.gg\\//", "/0[67]\\s?(\\d{2}\\s?){4}/",
    "/(?:vente|vds|vends).*(?:kamas|k|m)/", "/(?:bonus|cadeau).*(?:dofus|ankama)/",
    "/p[uùû\\.\\-\\_]t[eë\\?\\!\\*]/", "/f[\\.\\-\\_\\*]d[\\.\\-\\_\\*]p/", "/n[\\.\\-\\_\\*]t[\\.\\-\\_\\*]m/",
    "/e[nñ]c?[uù]+l[eéë]+/", "/c[o0][nñ][nñ][a4]r[d_\\-\\!\\?]*?/"
];

/**
 * Core Moderation Logic
 * Checks against a provided list of words/regex.
 */
export function normalizeMessage(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/[0-9]/g, (c) => (({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "8": "b" } as any)[c] || c))
        .replace(/(.)\1+/g, "$1") // collapse repeated chars: "puuuuute" → "pute"
        .replace(/[^a-z0-9\s/]/g, ""); // strip remaining non-alphanumeric (keep / for regex checks)
}

export function checkBlockedContent(text: string, blocklist: string[]): boolean {
    const normalized = normalizeMessage(text);
    const originalLower = text.toLowerCase();

    return blocklist.some(w => {
        const word = w.trim();
        if (!word) return false;

        // Support for Regex formats /pattern/
        if (word.startsWith("/") && word.endsWith("/") && word.length > 2) {
            try {
                const regex = new RegExp(word.slice(1, -1), "i");
                // Check against both original and normalized for maximum safety
                return regex.test(text) || regex.test(normalized);
            } catch {
                return false;
            }
        }

        // Standard check
        const normalizedW = normalizeMessage(word);
        if (!normalizedW) return false;
        return normalized.includes(normalizedW) || originalLower.includes(word.toLowerCase());
    });
}

export function containsBlockedContent(text: string): boolean {
    return checkBlockedContent(text, BASE_BLOCKED_WORDS);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-REPETITION HASH (simple)
// ─────────────────────────────────────────────────────────────────────────────
export function simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

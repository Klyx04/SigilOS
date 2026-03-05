"use server";
// Note: `any` is used intentionally for Prisma JSON fields (chatBlocklist, chatMentionRules, modules, etc.)
// and for untyped external API responses (DofusDB). Scoped eslint-disable where needed below.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import { isModuleEnabled } from "./module-actions";
import { createAuditLog } from "./audit-actions";
import {
    sanitizeMessage,
    checkBlockedContent,
    simpleHash,
    chatKey, chatCounterKey, chatMutedKey, chatMuteUserKey, chatPubSubChannel, chatLastMsgKey, chatStatsKey,
    runChatKey, runChatCounterKey, runChatPubSubChannel,
    chatStrikesKey, chatGlobalBanKey, chatGlobalBlocklistKey,
    CHAT_HISTORY_LIMIT, CHAT_TTL_SECONDS, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS,
    CHAT_COOLDOWN_MS, CHAT_STRIKE_THRESHOLD, CHAT_STRIKE_WINDOW_MS, CHAT_BAN_DURATION_SEC,
    BASE_BLOCKED_WORDS,
    type ChatMessage,
} from "@/lib/chat-helpers";

export async function getBaseBlocklist(): Promise<string[]> {
    const conf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });
    const dbBase = (conf?.baseWords as string[]) ?? [];
    return dbBase.length > 0 ? dbBase : (BASE_BLOCKED_WORDS as string[]);
}

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function resolveGuildInternalId(discordGuildId: string): Promise<string | null> {
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    return guild?.id ?? null;
}

const STATS_MAP: Record<number, string> = {
    // Primary
    125: "Vitalité", 118: "Force", 126: "Intelligence", 123: "Chance", 119: "Agilité", 124: "Sagesse", 138: "Puissance",
    // Combat
    111: "PA", 128: "PM", 117: "Portée", 115: "Critique", 178: "Soin", 112: "Dommages", 174: "Initiative", 176: "Prospection",
    // Secondary
    422: "Fuite", 423: "Tacle", 160: "Esquive PA", 161: "Esquive PM", 162: "Retrait PA", 163: "Retrait PM",
    410: "Dom. Neutre", 411: "Dom. Terre", 412: "Dom. Feu", 413: "Dom. Eau", 414: "Dom. Air",
    418: "Dom. Poussée", 419: "Res. Poussée", 420: "Dom. Critiques", 421: "Res. Critiques",
    // Resistances
    210: "% Res. Neutre", 211: "% Res. Terre", 212: "% Res. Feu", 213: "% Res. Eau", 214: "% Res. Air",
    215: "Res. Neutre", 216: "Res. Terre", 217: "Res. Feu", 218: "Res. Eau", 219: "Res. Air"
};

interface DofusItem {
    effects?: { effectId: number; from?: number; to?: number }[];
    [key: string]: any;
}

function formatItemStats(item: DofusItem): string {
    if (!item.effects || !Array.isArray(item.effects)) return "";
    const stats: string[] = [];
    for (const eff of item.effects) {
        const name = STATS_MAP[eff.effectId];
        if (name && (eff.from || eff.to)) {
            const val = eff.from || eff.to;
            stats.push(`+${val} ${name}`);
        }
    }
    return stats.length > 0 ? `\nStats: ${stats.join(", ")}` : "";
}

async function requireActiveMember(discordGuildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Non authentifié" as const };

    const userId = session.user.id;
    const userName = session.user.name || "Admin";

    const guildId = await resolveGuildInternalId(discordGuildId);
    if (!guildId) return { error: "Guilde introuvable" as const };

    const profile = await db.userProfile.findFirst({
        where: { userId, guildId, status: "ACTIVE" },
        select: { id: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true, image: true } } },
    });
    if (!profile) return { error: "Accès refusé" as const };

    return { userId, userName, guildId, profile, session };
}

/**
 * MODERATION — Strike & Ban System
 */
async function processModerationStrike(userId: string, discordGuildId: string, message: string): Promise<string> {
    const strikeKey = chatStrikesKey(userId);
    const banKey = chatGlobalBanKey(userId);

    // Increment strikes & Reset timer (Sliding window)
    const strikes = await redis.incr(strikeKey);
    await redis.expire(strikeKey, CHAT_STRIKE_WINDOW_MS / 1000);

    // Immutable Log
    await createAuditLog({
        guildId: discordGuildId,
        actorUserId: userId,
        actorName: "Système de Modération",
        action: "CHAT_BLOCKED_ATTEMPT",
        targetType: "USER",
        targetId: userId,
        metadata: { message, strikes, threshold: CHAT_STRIKE_THRESHOLD }
    });

    if (strikes >= CHAT_STRIKE_THRESHOLD) {
        await redis.set(banKey, "1", "EX", CHAT_BAN_DURATION_SEC);
        return `Alerte : Trop de messages inappropriés. Ton accès au chat est suspendu pour 15 minutes.`;
    }

    const remaining = CHAT_STRIKE_THRESHOLD - strikes;
    return `Inapproprié : Ton message a été bloqué. Attention, encore ${remaining} tentative(s) avant un bannissement temporaire de 15 minutes.`;
}

async function isUserBanned(userId: string): Promise<boolean> {
    const ttl = await redis.ttl(chatGlobalBanKey(userId));
    return ttl > 0;
}

export async function getUserChatBanStatus(userId: string): Promise<{ isBanned: boolean; remainingSeconds: number }> {
    const ttl = await redis.ttl(chatGlobalBanKey(userId));
    return {
        isBanned: ttl > 0,
        remainingSeconds: Math.max(0, ttl)
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM MESSAGES — Automated Guild Feed
// ─────────────────────────────────────────────────────────────────────────────
export async function pushSystemChatMessage(
    discordGuildId: string,
    text: string,
    metadata?: Record<string, unknown>
): Promise<ActionResponse<ChatMessage>> {
    try {
        if (!text) return { success: false, error: "Empty message" };

        const msgId = await redis.incr(chatCounterKey(discordGuildId));

        const msg: ChatMessage = {
            id: msgId.toString(),
            text,
            authorId: "SYSTEM",
            authorName: "Système",
            createdAt: new Date().toISOString(),
            type: "system",
            systemMeta: metadata,
        };

        const key = chatKey(discordGuildId);
        await redis.rpush(key, JSON.stringify(msg));
        await redis.ltrim(key, -CHAT_HISTORY_LIMIT, -1);
        await redis.expire(key, CHAT_TTL_SECONDS);

        const pubSubChannel = chatPubSubChannel(discordGuildId);
        await redis.publish(pubSubChannel, JSON.stringify(msg));

        return { success: true, data: msg };
    } catch (e) {
        console.error("System chat push error:", e);
        return { success: false, error: "System error" };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GUILD CHAT — Send Message
// ─────────────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
    discordGuildId: string,
    rawText: string
): Promise<ActionResponse<ChatMessage>> {
    const ctx = await requireActiveMember(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };
    const { userId, guildId, profile } = ctx;

    // Module enabled check
    const enabled = await isModuleEnabled(discordGuildId, "chat");
    if (!enabled) return { success: false, error: "Module chat désactivé" };

    // RBAC — vérifier la permission chat:view
    const { getUserContext } = await import("./user-actions");
    const userCtx = await getUserContext(discordGuildId);
    if (!userCtx.canViewChat) return { success: false, error: "Permission insuffisante" };

    // 0. Check temporary ban
    if (await isUserBanned(userId)) {
        return { success: false, error: "Tu es temporairement banni du chat (15 min) pour non-respect des règles." };
    }

    // Rate limit — 10 msgs/min per user
    const rl = await rateLimit(`chat:${userId}:${discordGuildId}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
    if (!rl.success) return { success: false, error: "Trop de messages. Ralentis !" };

    // Cooldown — min 1.5s between messages
    const cooldownKey = chatLastMsgKey(userId, discordGuildId);
    const lastMsgTime = await redis.get(cooldownKey);
    if (lastMsgTime && Date.now() - parseInt(lastMsgTime) < CHAT_COOLDOWN_MS) {
        return { success: false, error: "Envoie plus lentement." };
    }

    // Mute check
    const muteKey = chatMutedKey(discordGuildId);
    const isMuted = await redis.sismember(muteKey, userId);
    if (isMuted) return { success: false, error: "Tu es muté dans ce chat." };

    // Sanitize
    const text = sanitizeMessage(rawText);
    if (!text) return { success: false, error: "Message invalide ou trop long." };

    // ─────────────────────────────────────────────────────────────────────────
    // 0. URL Protection — Block all external domains
    // Aggressive regex to catch domains even without http/https
    // 0. URL Protection — Block all external domains
    // Aggressive regex to catch domains even without http/https
    const DOMAIN_PATTERN = /(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?/gi;
    const matches = text.match(DOMAIN_PATTERN) || [];
    const globalConf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });

    // Merge DB allowed domains with hardcoded defaults to ensure core tools (DofusDB) always work
    const dbAllowed = (globalConf?.allowedDomains as string[]) || [];
    const defaultAllowed = ["sigilos.fr", "beta.sigilos.fr", "dofusdb.fr", "api.dofusdb.fr"];
    const whitelist = Array.from(new Set([...defaultAllowed, ...dbAllowed]));

    for (const match of matches) {
        if (!match.includes(".")) continue; // Safety: must have at least one dot to be a domain
        try {
            const urlToParse = match.includes("://") ? match : `http://${match}`;
            const { hostname } = new URL(urlToParse);
            const isAllowed = whitelist.some((d: string) => hostname === d || hostname.endsWith(`.${d}`));
            if (!isAllowed) {
                return { success: false, error: `🚫 Sécurité : Les liens externes (${hostname}) ne sont pas autorisés.` };
            }
        } catch {
            if (match.includes(".") && !match.startsWith(".")) {
                return { success: false, error: "🚫 Lien suspect détecté." };
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Wordlist Check (Global + Guild)
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Fetch blocklists (Cache global in Redis for speed)
    let globalWords = await redis.get(chatGlobalBlocklistKey).then(v => v ? JSON.parse(v) : null);
    if (!globalWords) {
        const globalConfFetch = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });
        globalWords = (globalConfFetch?.words as string[]) ?? [];
        await redis.set(chatGlobalBlocklistKey, JSON.stringify(globalWords), "EX", 300);
    }

    const guildConf = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { chatBlocklist: true },
    });
    const guildWords = (guildConf?.chatBlocklist as string[]) ?? [];

    const baseWords = await getBaseBlocklist();
    const fullBlocklist = [...baseWords, ...globalWords, ...guildWords];

    if (checkBlockedContent(text, fullBlocklist)) {
        const warning = await processModerationStrike(userId, discordGuildId, text);
        return { success: false, error: warning };
    }

    // Anti-repetition: store hash of last message
    const msgHashKey = `chat:guild:${discordGuildId}:lasthash:${userId}`;
    const hash = simpleHash(text.toLowerCase());
    const lastHash = await redis.get(msgHashKey);
    if (lastHash === hash) return { success: false, error: "Tu viens déjà d'envoyer ce message." };

    const authorName = profile.discordNickname || profile.pseudoDofus || profile.user.name || "Membre";
    const authorRoles = userCtx.roles || [];
    const isGod = userCtx.isSuperAdmin;

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Mention Rules Validation
    // ─────────────────────────────────────────────────────────────────────────
    const mentionRegex = /@(\S+)/g;
    const rawMentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        rawMentions.push(match[1].replace(/[^a-zA-Z0-9_-]/g, ""));
    }

    let finalMentions: string[] | undefined = undefined;

    if (rawMentions.length > 0) {
        // Unified profile fetch
        const profiles = await db.userProfile.findMany({
            where: { guildId: guildId, status: "ACTIVE" },
            select: { userId: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true } } }
        }) as any[];

        const { fetchGuildRoles } = await import("@/server/discord");
        let allGuildRoles: any[] = [];
        try {
            allGuildRoles = await fetchGuildRoles(discordGuildId);
        } catch (e) {
            console.error("[Chat] Failed to fetch Discord roles:", e);
        }

        // Fetch guild mention rules once
        const guildConfWithRules = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { chatMentionRules: true } as any,
        });
        const rules = (guildConfWithRules?.chatMentionRules as any) || {};

        const mentionStrings: string[] = [];
        for (const mName of rawMentions) {
            const lowName = mName.toLowerCase();
            if (lowName === "everyone" || lowName === "here") {
                mentionStrings.push(lowName);
                continue;
            }
            mentionStrings.push(lowName); // Highlight name

            // 1. Resolve Users (nickname, userId or partial nickname)
            const matchingUsers = profiles.filter((p) => {
                const lowId = p.userId.toLowerCase();
                const rawNick = (p.discordNickname || p.pseudoDofus || p.user?.name || "").toLowerCase();
                const cleanNick = rawNick.replace(/[^a-zA-Z0-9_-]/g, "");

                return lowId === lowName ||
                    cleanNick === lowName ||
                    rawNick.startsWith(lowName + " ") ||
                    rawNick.startsWith(lowName + "(");
            });
            matchingUsers.forEach((u: any) => mentionStrings.push(u.userId.toLowerCase()));

            const targetRoles = allGuildRoles.filter((r: any) => r.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "") === lowName);
            if (isGod) {
                targetRoles.forEach((r: any) => mentionStrings.push(r.id.toLowerCase()));
            } else {
                // Roles check: must follow rules
                const canMention = authorRoles.some((roleId: string) => {
                    const targets = rules[roleId];
                    return Array.isArray(targets) && targetRoles.some((tr: any) => targets.includes(tr.id));
                });
                if (canMention) {
                    targetRoles.forEach((r: any) => mentionStrings.push(r.id.toLowerCase()));
                }
            }
        }
        if (mentionStrings.length > 0) {
            finalMentions = Array.from(new Set(mentionStrings));
        }
    }

    // Increment ID
    const msgId = await redis.incr(chatCounterKey(discordGuildId));

    const msg: ChatMessage = {
        id: msgId.toString(),
        text,
        authorId: userId,
        authorName,
        authorImage: profile.user.image ?? undefined,
        createdAt: new Date().toISOString(),
        type: "user",
        mentions: finalMentions,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Slash Commands Interception (/roll)
    // ─────────────────────────────────────────────────────────────────────────
    if (text.startsWith("/")) {
        const parts = text.split(" ");
        const cmd = parts[0].toLowerCase();

        if (cmd === "/roll") {
            const maxStr = parts[1] || "100";
            const max = parseInt(maxStr, 10);
            const rollMax = isNaN(max) || max <= 0 ? 100 : Math.min(max, 10000);
            const rollResult = Math.floor(Math.random() * rollMax) + 1;

            msg.type = "user"; // Changed to user for rich bubble display
            msg.authorId = "system";
            msg.authorName = "Système";
            msg.authorImage = undefined;
            // Removed '!' to avoid card rendering, keeps it as a nice bubble
            msg.text = `🎲 **${authorName}** a lancé un dé et a obtenu **${rollResult}** / ${rollMax}.`;
        } else if (["/objet", "/pano", "/classe", "/quete", "/monstre", "/donjon"].includes(cmd)) {
            const query = parts.slice(1).join(" ");
            if (!query) {
                msg.type = "system";
                msg.authorId = "system";
                msg.authorName = "Système";
                msg.authorImage = undefined;
                msg.text = `⚠️ Utilisation: ${cmd} [recherche]`;
            } else {
                try {
                    const typeMap: Record<string, { endpoint: string, name: string, path: string }> = {
                        "/objet": { endpoint: "items", name: "l'objet", path: "object" },
                        "/pano": { endpoint: "item-sets", name: "la panoplie", path: "item-sets" },
                        "/classe": { endpoint: "breeds", name: "la classe", path: "breeds" },
                        "/quete": { endpoint: "quests", name: "la quête", path: "quest" },
                        "/monstre": { endpoint: "monsters", name: "le monstre", path: "monster" },
                        "/donjon": { endpoint: "dungeons", name: "le donjon", path: "dungeon" }
                    };
                    const config = typeMap[cmd];

                    const searchKey = "slug.fr[$search]";
                    const params = new URLSearchParams({ lang: "fr" });

                    if (cmd !== "/classe") {
                        params.append(searchKey, query);
                        params.append("$limit", "1");
                    }

                    const url = `https://api.dofusdb.fr/${config.endpoint}?${params.toString().replace(/%24/g, "$").replace(/%5B/g, "[").replace(/%5D/g, "]")}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("API DofusDB indisponible.");
                    const data = await res.json();

                    let results = Array.isArray(data.data) ? data.data : [];

                    // Local filtering for /class
                    if (cmd === "/classe") {
                        const lowQuery = query.toLowerCase();
                        results = results.filter((b: any) =>
                            b.shortName?.fr?.toLowerCase().includes(lowQuery) ||
                            b.shortName?.en?.toLowerCase().includes(lowQuery)
                        ).slice(0, 1);
                    }

                    if (results.length > 0) {
                        const item = results[0];
                        msg.type = "user"; // Changed to user for rich card display
                        msg.authorId = "system";
                        msg.authorName = "DofusDB";
                        msg.authorImage = "https://dofusdb.fr/icons/favicon.ico";

                        let displayName = "Inconnu";
                        if (typeof item.name === "string") displayName = item.name;
                        else if (item.name?.fr) displayName = item.name.fr;
                        else if (item.shortName?.fr) displayName = item.shortName.fr;
                        else if (item.slug?.fr) displayName = item.slug.fr;

                        let imgUrl = item.img || item.maleImg; // fallback for breeds
                        if (!imgUrl && cmd === "/pano" && item.items?.[0]?.img) {
                            imgUrl = item.items[0].img;
                        } else if (!imgUrl && cmd === "/donjon" && item.monsters?.length > 0) {
                            try {
                                const mParams = new URLSearchParams();
                                mParams.append("id[$in]", item.monsters.join(","));
                                mParams.append("$limit", "50");
                                const mUrl = `https://api.dofusdb.fr/monsters?${mParams.toString().replace(/%24/g, "$").replace(/%5B/g, "[").replace(/%5D/g, "]")}`;
                                const mRes = await fetch(mUrl);
                                if (mRes.ok) {
                                    const mData = await mRes.json();
                                    const boss = (mData.data || []).find((m: any) => m.isBoss);
                                    if (boss && boss.id) {
                                        imgUrl = `https://api.dofusdb.fr/img/monsters/${boss.id}.png`;
                                    }
                                }
                            } catch (e) {
                                console.error("Error fetching dungeon boss image:", e);
                            }
                        }

                        const imgMd = imgUrl ? `![${displayName}](${imgUrl})\n` : "";
                        const itemId = item.id || item._id || "unknown";

                        const itemType = item.type?.name?.fr || item.type?.name?.en || "";
                        const itemLevel = item.level ? `Niv. ${item.level}` : "";
                        const meta = [itemType, itemLevel].filter(Boolean).join(" - ");
                        const metaMd = meta ? `\n_${meta}_` : "";
                        const statsMd = formatItemStats(item);

                        // Prefix '!' triggers the rich card renderer in chat-renderer.tsx
                        msg.text = `! **${authorName}** partage ${config.name} :\n${imgMd}**[${displayName}](https://dofusdb.fr/fr/database/${config.path}/${itemId})**${metaMd}${statsMd}`;
                    } else {
                        msg.type = "system";
                        msg.authorId = "system";
                        msg.authorName = "Système";
                        msg.authorImage = undefined;
                        msg.text = `❌ Aucun(e) résultat trouvé(e) for "${query}".`;
                    }
                } catch (e) {
                    msg.type = "system";
                    msg.authorId = "system";
                    msg.authorName = "Système";
                    msg.authorImage = undefined;
                    msg.text = `❌ Erreur lors de la recherche sur DofusDB.`;
                }
            }
        } else if (cmd === "/vote" || cmd === "/votes") {
            const content = parts.slice(1).join(" ");
            const voteParts = content.split("|").map(s => s.trim()).filter(Boolean);
            if (voteParts.length < 3) {
                msg.type = "system";
                msg.authorId = "system";
                msg.authorName = "Système";
                msg.authorImage = undefined;
                msg.text = `⚠️ Utilisation: /votes Question ? | Choix 1 | Choix 2`;
            } else {
                const question = voteParts[0];
                const optTexts = voteParts.slice(1).slice(0, 8); // Limit to 8 options
                const options = optTexts.map((opt: string, i: number) => ({
                    id: `opt_${i}`,
                    text: opt,
                    votes: 0
                }));
                msg.type = "poll";
                msg.text = `Sondage : **${question}**`;
                msg.pollData = {
                    question,
                    options,
                    voters: {}
                };
            }
        }
    }

    const serialized = JSON.stringify(msg);
    const listKey = chatKey(discordGuildId);

    // Store in list + TTL + trim
    await redis.multi()
        .rpush(listKey, serialized)
        .ltrim(listKey, -CHAT_HISTORY_LIMIT, -1)
        .expire(listKey, CHAT_TTL_SECONDS)
        .set(cooldownKey, Date.now().toString(), "PX", CHAT_COOLDOWN_MS * 2)
        .set(msgHashKey, hash, "EX", 30)
        .exec();

    // Daily stats counter (per-guild, per-day)
    const today = new Date().toISOString().slice(0, 10);
    await redis.hincrby(chatStatsKey(discordGuildId), today, 1);
    await redis.expire(chatStatsKey(discordGuildId), 86400 * 30); // keep 30 days of stats

    // Publish to Pub/Sub for SSE delivery
    await redis.publish(chatPubSubChannel(discordGuildId), serialized);

    return { success: true, data: msg };
}

// ─────────────────────────────────────────────────────────────────────────────
// GUILD CHAT — Get History
// ─────────────────────────────────────────────────────────────────────────────

export async function getChatHistory(
    discordGuildId: string,
    limit = 50
): Promise<ActionResponse<ChatMessage[]>> {
    const ctx = await requireActiveMember(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const enabled = await isModuleEnabled(discordGuildId, "chat");
    if (!enabled) return { success: false, error: "Module chat désactivé" };

    const raw = await redis.lrange(chatKey(discordGuildId), -limit, -1);
    const messages = raw.map((s: string) => {
        try { return JSON.parse(s) as ChatMessage; } catch { return null; }
    }).filter(Boolean) as ChatMessage[];

    return { success: true, data: messages };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN CHAT — Send Message
// ─────────────────────────────────────────────────────────────────────────────

export async function sendRunChatMessage(
    discordGuildId: string,
    runId: string,
    rawText: string
): Promise<ActionResponse<ChatMessage>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Verify run membership (only confirmed members can write)
    const run = await db.dreamRun.findFirst({
        where: { id: runId },
        select: { id: true, guildId: true, status: true, members: { select: { userId: true } }, leaderId: true },
    });
    if (!run) return { success: false, error: "Run introuvable" };

    const isMember = run.members.some(m => m.userId === session.user!.id) || run.leaderId === session.user!.id;
    if (!isMember) return { success: false, error: "Tu n'es pas membre de cette run" };

    const authorId = session.user.id;
    const authorGlobalName = session.user.name || "Membre";

    if (run.status === "COMPLETED" || run.status === "ABANDONED" || run.status === "FAILED") {
        return { success: false, error: "Cette run est terminée" };
    }

    // 0. Check temporary ban
    if (await isUserBanned(session.user!.id)) {
        return { success: false, error: "Tu es temporairement banni du chat (15 min) pour non-respect des règles." };
    }

    // Rate limit
    const rl = await rateLimit(`chat:run:${session.user.id}:${runId}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
    if (!rl.success) return { success: false, error: "Trop de messages. Ralentis !" };

    // Need internal guild ID for UserProfile
    const guildConf = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true, chatBlocklist: true },
    });
    if (!guildConf) return { success: false, error: "Guilde introuvable" };

    // Get profile for display name
    const guildProfile = await db.userProfile.findFirst({
        where: { userId: authorId, guildId: guildConf.id, status: "ACTIVE" },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true, image: true } } },
    });

    const text = sanitizeMessage(rawText);
    if (!text) return { success: false, error: "Message invalide ou trop long." };

    // ─────────────────────────────────────────────────────────────────────────
    // 0. URL Protection
    const DOMAIN_PATTERN = /(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?/gi;
    const matches = text.match(DOMAIN_PATTERN) || [];
    const globalConf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });
    const dbAllowed = (globalConf?.allowedDomains as string[]) || [];
    const defaultAllowed = ["sigilos.fr", "beta.sigilos.fr", "dofusdb.fr", "api.dofusdb.fr"];
    const whitelist = Array.from(new Set([...defaultAllowed, ...dbAllowed]));

    for (const match of matches) {
        if (!match.includes(".")) continue;
        try {
            const urlToParse = match.includes("://") ? match : `http://${match}`;
            const { hostname } = new URL(urlToParse);
            const isAllowed = whitelist.some((d: string) => hostname === d || hostname.endsWith(`.${d}`));
            if (!isAllowed) {
                return { success: false, error: `🚫 Sécurité : Les liens externes (${hostname}) ne sont pas autorisés.` };
            }
        } catch {
            if (match.includes(".") && !match.startsWith(".")) {
                return { success: false, error: "🚫 Lien suspect détecté." };
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Moderate content (Global + Guild)
    // ─────────────────────────────────────────────────────────────────────────
    let globalWords = await redis.get(chatGlobalBlocklistKey).then(v => v ? JSON.parse(v) : null);
    if (!globalWords) {
        const globalConfFetch = await db.globalBlocklist.findFirst({ where: { id: "GLOBAL" } });
        globalWords = (globalConfFetch?.words as string[]) ?? [];
        await redis.set(chatGlobalBlocklistKey, JSON.stringify(globalWords), "EX", 300);
    }
    const baseWords = await getBaseBlocklist();
    const guildWords = (guildConf.chatBlocklist as string[]) ?? [];
    const fullBlocklist = [...baseWords, ...globalWords, ...guildWords];

    if (checkBlockedContent(text, fullBlocklist)) {
        const warning = await processModerationStrike(authorId, discordGuildId, text);
        return { success: false, error: warning };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Mention Rules Validation
    // ─────────────────────────────────────────────────────────────────────────
    const { getUserContext } = await import("./user-actions");
    const userCtx = await getUserContext(discordGuildId);
    const authorRoles = userCtx.roles || [];
    const isGod = userCtx.isSuperAdmin;

    const mentionRegex = /@(\S+)/g;
    const rawMentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        rawMentions.push(match[1].replace(/[^a-zA-Z0-9_-]/g, ""));
    }

    let finalMentions: string[] | undefined = undefined;

    if (rawMentions.length > 0) {
        // Fetch guild mention rules
        const guildConfWithRules = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { chatMentionRules: true } as any,
        });
        const rules = (guildConfWithRules?.chatMentionRules as any) || {};

        // Get Discord roles for this guild
        const { fetchGuildRoles } = await import("@/server/discord");
        let allGuildRoles: any[] = [];
        try {
            allGuildRoles = await fetchGuildRoles(discordGuildId);
        } catch (e) {
            console.error("[RunChat] Failed to fetch Discord roles:", e);
        }

        // Get all profiles to allow direct user mentions
        const profiles = await db.userProfile.findMany({
            where: { guildId: run.guildId, status: "ACTIVE" },
            select: { userId: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true } } }
        }) as any[];

        // Identify and filter mentions
        const mentionStrings: string[] = [];
        for (const mName of rawMentions) {
            const lowName = mName.toLowerCase();
            if (lowName === "everyone" || lowName === "here") {
                mentionStrings.push(lowName);
                continue;
            }

            mentionStrings.push(lowName); // Keep name for highlighting

            // 1. Resolve Users (nickname, userId or partial nickname)
            const matchingUsers = profiles.filter((p) => {
                const lowId = p.userId.toLowerCase();
                const rawNick = (p.discordNickname || p.pseudoDofus || p.user?.name || "").toLowerCase();
                const cleanNick = rawNick.replace(/[^a-zA-Z0-9_-]/g, "");

                return lowId === lowName ||
                    cleanNick === lowName ||
                    rawNick.startsWith(lowName + " ") ||
                    rawNick.startsWith(lowName + "(");
            });
            matchingUsers.forEach((u) => mentionStrings.push(u.userId.toLowerCase()));

            // 2. Resolve Roles
            const targetRoles = allGuildRoles.filter((r: any) => r.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "") === lowName);

            if (isGod) {
                targetRoles.forEach((r: any) => mentionStrings.push(r.id.toLowerCase()));
            } else {
                const canMention = authorRoles.some((roleId: string) => {
                    const targets = rules[roleId];
                    return Array.isArray(targets) && targetRoles.some((tr: any) => targets.includes(tr.id));
                });
                if (canMention) {
                    targetRoles.forEach((r: any) => mentionStrings.push(r.id.toLowerCase()));
                }
            }
        }

        if (mentionStrings.length > 0) {
            finalMentions = Array.from(new Set(mentionStrings));
        }
    }

    const authorName = guildProfile?.discordNickname || guildProfile?.pseudoDofus || authorGlobalName;
    const authorImage = guildProfile?.user.image || session.user.image || undefined;
    const msgId = await redis.incr(runChatCounterKey(runId));

    const msg: ChatMessage = {
        id: msgId.toString(),
        text,
        authorId: authorId,
        authorName,
        authorImage,
        createdAt: new Date().toISOString(),
        type: "user",
        mentions: finalMentions,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Slash Commands Interception (/roll)
    // ─────────────────────────────────────────────────────────────────────────
    if (text.startsWith("/")) {
        const parts = text.split(" ");
        const cmd = parts[0].toLowerCase();

        if (cmd === "/roll") {
            const maxStr = parts[1] || "100";
            const max = parseInt(maxStr, 10);
            const rollMax = isNaN(max) || max <= 0 ? 100 : Math.min(max, 10000);
            const rollResult = Math.floor(Math.random() * rollMax) + 1;

            msg.type = "system";
            msg.authorId = "system";
            msg.authorName = "Système";
            msg.authorImage = undefined;
            msg.text = `🎲 **${authorName}** a lancé un dé et a obtenu **${rollResult}** / ${rollMax}.`;
        } else if (["/item", "/set", "/class", "/quest", "/monster", "/dungeon"].includes(cmd)) {
            const query = parts.slice(1).join(" ");
            if (!query) {
                msg.type = "system";
                msg.authorId = "system";
                msg.authorName = "Système";
                msg.authorImage = undefined;
                msg.text = `⚠️ Utilisation: ${cmd} [recherche]`;
            } else {
                try {
                    const typeMap: Record<string, { endpoint: string, name: string, path: string }> = {
                        "/item": { endpoint: "items", name: "l'objet", path: "object" },
                        "/set": { endpoint: "item-sets", name: "la panoplie", path: "item-sets" },
                        "/class": { endpoint: "breeds", name: "la classe", path: "breeds" },
                        "/quest": { endpoint: "quests", name: "la quête", path: "quest" },
                        "/monster": { endpoint: "monsters", name: "le monstre", path: "monster" },
                        "/dungeon": { endpoint: "dungeons", name: "le donjon", path: "dungeons" }
                    };
                    const config = typeMap[cmd];

                    const searchKey = "slug.fr[$search]";
                    const params = new URLSearchParams({ lang: "fr" });

                    if (cmd !== "/class") {
                        params.append(searchKey, query);
                        params.append("$limit", "1");
                    }

                    const url = `https://api.dofusdb.fr/${config.endpoint}?${params.toString().replace(/%24/g, "$").replace(/%5B/g, "[").replace(/%5D/g, "]")}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("API DofusDB indisponible.");
                    const data = await res.json();

                    let results = Array.isArray(data.data) ? data.data : [];

                    // Local filtering for /class
                    if (cmd === "/class") {
                        const lowQuery = query.toLowerCase();
                        results = results.filter((b: any) =>
                            b.shortName?.fr?.toLowerCase().includes(lowQuery) ||
                            b.shortName?.en?.toLowerCase().includes(lowQuery)
                        ).slice(0, 1);
                    }

                    if (results.length > 0) {
                        const item = results[0];
                        msg.type = "system";
                        msg.authorId = "system";
                        msg.authorName = "DofusDB";
                        msg.authorImage = "https://dofusdb.fr/icons/favicon.ico";

                        let displayName = "Inconnu";
                        if (typeof item.name === "string") displayName = item.name;
                        else if (item.name?.fr) displayName = item.name.fr;
                        else if (item.shortName?.fr) displayName = item.shortName.fr;
                        else if (item.slug?.fr) displayName = item.slug.fr;

                        let imgUrl = item.img;
                        if (!imgUrl && cmd === "/set" && item.items?.[0]?.img) {
                            imgUrl = item.items[0].img;
                        } else if (!imgUrl && cmd === "/dungeon" && item.monsters?.length > 0) {
                            imgUrl = `https://api.dofusdb.fr/img/monsters/${item.monsters[item.monsters.length - 1]}.png`;
                        }

                        const imgMd = imgUrl ? `![${displayName}](${imgUrl})\n` : "";
                        const itemId = item.id || item._id || "unknown";

                        const itemType = item.type?.name?.fr || item.type?.name?.en || "";
                        const itemLevel = item.level ? `Niv. ${item.level}` : "";
                        const meta = [itemType, itemLevel].filter(Boolean).join(" - ");
                        const metaMd = meta ? `\n_${meta}_` : "";
                        const statsMd = formatItemStats(item);

                        msg.text = `! **${authorName}** partage ${config.name} :\n${imgMd}**[${displayName}](https://dofusdb.fr/fr/database/${config.path}/${itemId})**${metaMd}${statsMd}`;
                    } else {
                        msg.type = "system";
                        msg.authorId = "system";
                        msg.authorName = "Système";
                        msg.authorImage = undefined;
                        msg.text = `❌ Aucun(e) résultat trouvé(e) pour "${query}".`;
                    }
                } catch (e) {
                    msg.type = "system";
                    msg.authorId = "system";
                    msg.authorName = "Système";
                    msg.authorImage = undefined;
                    msg.text = `❌ Erreur lors de la recherche sur DofusDB.`;
                }
            }
        }
    }

    const serialized = JSON.stringify(msg);
    await redis.multi()
        .rpush(runChatKey(runId), serialized)
        .ltrim(runChatKey(runId), -100, -1)
        .expire(runChatKey(runId), CHAT_TTL_SECONDS * 7) // 7 days for run chat
        .exec();

    await redis.publish(runChatPubSubChannel(runId), serialized);

    return { success: true, data: msg };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN CHAT — Typing Indicator (Ephemeral)
// ─────────────────────────────────────────────────────────────────────────────

export async function setRunTypingIndicator(discordGuildId: string, runId: string): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) return;

    // Check if user is active member
    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isMember) return;

    // Throttle: max 1 typing event per 2 seconds per user
    const throttleKey = `chat:run:${runId}:typing:throttle:${session.user.id}`;
    const set = await redis.set(throttleKey, "1", "EX", 2, "NX");
    if (!set) return;

    const guildConf = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guildConf) return;

    const profile = await db.userProfile.findFirst({
        where: { userId: session.user.id, guildId: guildConf.id, status: "ACTIVE" },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { image: true } } },
    });

    const authorName = profile?.discordNickname || profile?.pseudoDofus || session.user.name || "Membre";
    const authorImage = profile?.user.image || session.user.image || undefined;

    const typingEvent: ChatMessage = {
        id: `typing:${session.user.id}`,
        text: "",
        authorId: session.user.id,
        authorName,
        authorImage,
        createdAt: new Date().toISOString(),
        type: "typing",
    };

    await redis.publish(runChatPubSubChannel(runId), JSON.stringify(typingEvent));
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN CHAT — Get History
// ─────────────────────────────────────────────────────────────────────────────

export async function getRunChatHistory(
    runId: string
): Promise<ActionResponse<ChatMessage[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId },
        select: { members: { select: { userId: true } }, leaderId: true },
    });
    if (!run) return { success: false, error: "Run introuvable" };

    const isMember = run.members.some(m => m.userId === session.user!.id) || run.leaderId === session.user!.id;
    if (!isMember) return { success: false, error: "Accès refusé" };

    const raw = await redis.lrange(runChatKey(runId), -100, -1);
    const messages = raw.map((s: string) => {
        try { return JSON.parse(s) as ChatMessage; } catch { return null; }
    }).filter(Boolean) as ChatMessage[];

    return { success: true, data: messages };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM MESSAGE — Emit event to guild chat (called internally by other modules)
// ─────────────────────────────────────────────────────────────────────────────

export async function emitChatSystemMessage(
    discordGuildId: string,
    text: string,
    meta?: Record<string, unknown>
): Promise<void> {
    try {
        const enabled = await isModuleEnabled(discordGuildId, "chat");
        if (!enabled) return;

        const msgId = await redis.incr(chatCounterKey(discordGuildId));
        const msg: ChatMessage = {
            id: msgId.toString(),
            text,
            authorId: "system",
            authorName: "SigilOS",
            createdAt: new Date().toISOString(),
            type: "system",
            systemMeta: meta,
        };

        const serialized = JSON.stringify(msg);
        await redis.multi()
            .rpush(chatKey(discordGuildId), serialized)
            .ltrim(chatKey(discordGuildId), -CHAT_HISTORY_LIMIT, -1)
            .expire(chatKey(discordGuildId), CHAT_TTL_SECONDS)
            .exec();

        await redis.publish(chatPubSubChannel(discordGuildId), serialized);
    } catch (e) {
        console.error("[Chat] Failed to emit system message:", e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR — Publish ephemeral event (no storage)
// ─────────────────────────────────────────────────────────────────────────────

export async function setTypingIndicator(discordGuildId: string): Promise<void> {
    const ctx = await requireActiveMember(discordGuildId);
    if ("error" in ctx) return;

    const enabled = await isModuleEnabled(discordGuildId, "chat");
    if (!enabled) return;

    // Throttle: max 1 typing event per 2 seconds per user (NX = set only if not exists)
    const throttleKey = `chat:guild:${discordGuildId}:typing:throttle:${ctx.userId}`;
    const set = await redis.set(throttleKey, "1", "EX", 2, "NX");
    if (!set) return;

    const typingEvent: ChatMessage = {
        id: `typing:${ctx.userId}`,
        text: "",
        authorId: ctx.userId,
        authorName: ctx.profile.discordNickname || ctx.profile.pseudoDofus || ctx.profile.user.name || "Membre",
        authorImage: ctx.profile.user.image ?? undefined,
        createdAt: new Date().toISOString(),
        type: "typing",
    };

    await redis.publish(chatPubSubChannel(discordGuildId), JSON.stringify(typingEvent));
}

// ─────────────────────────────────────────────────────────────────────────────
// MODERATION — Admin only
// ─────────────────────────────────────────────────────────────────────────────

export async function muteChatUser(
    discordGuildId: string,
    targetUserId: string,
    durationSeconds = 300
): Promise<ActionResponse<{ totalSeconds: number }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    const muteKey = chatMuteUserKey(discordGuildId, targetUserId);

    // Get current remaining TTL to stack (INCRBY instead of overwrite)
    const currentTtl = await redis.ttl(muteKey);
    const remaining = currentTtl > 0 ? currentTtl : 0;
    const totalSeconds = remaining + durationSeconds;

    // Set individual mute key with stacked duration
    await redis.set(muteKey, "1", "EX", totalSeconds);

    // Also add to legacy set for backwards compat with sendChatMessage check
    const legacyKey = chatMutedKey(discordGuildId);
    await redis.sadd(legacyKey, targetUserId);
    // Legacy set TTL only if this is the first mute or new TTL is longer
    const legacyTtl = await redis.ttl(legacyKey);
    if (legacyTtl < totalSeconds) {
        await redis.expire(legacyKey, totalSeconds);
    }

    // Fetch target user name for notification
    const targetProfile = await db.userProfile.findFirst({
        where: {
            userId: targetUserId,
            guild: { discordGuildId },
        },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
    });
    const targetName = targetProfile?.discordNickname || targetProfile?.pseudoDofus || targetProfile?.user?.name || targetUserId;

    // Format duration for display
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const durationLabel = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : m > 0 ? `${m} min${s > 0 ? ` ${s}s` : ""}` : `${s}s`;

    // Broadcast mute notification in the chat (both public + private hint for the user)
    const muteUnixExpiry = Math.floor(Date.now() / 1000) + totalSeconds;
    const notifMsg = {
        id: `mute:${Date.now()}`,
        text: `🔇 **${targetName}** est muet pour **${durationLabel}**.`,
        authorId: "system",
        authorName: "SigilOS — Modération",
        createdAt: new Date().toISOString(),
        type: "system",
        systemMeta: {
            type: "user_muted",
            targetUserId,
            targetName,
            durationSeconds: totalSeconds,
            expiresAt: muteUnixExpiry,
            muteExpiresAt: new Date(Date.now() + totalSeconds * 1000).toISOString(),
        },
    };

    const msgId = await redis.incr(chatCounterKey(discordGuildId));
    notifMsg.id = msgId.toString();

    const serialized = JSON.stringify(notifMsg);
    await redis.multi()
        .rpush(chatKey(discordGuildId), serialized)
        .ltrim(chatKey(discordGuildId), -CHAT_HISTORY_LIMIT, -1)
        .expire(chatKey(discordGuildId), CHAT_TTL_SECONDS)
        .exec();
    await redis.publish(chatPubSubChannel(discordGuildId), serialized);

    await createAuditLog({
        guildId: discordGuildId,
        actorUserId: session.user.id,
        actorName: session.user.name || "Admin",
        action: "CHAT_MUTE",
        targetType: "USER",
        targetId: targetUserId,
        newValue: { durationSeconds, totalSeconds, stacked: remaining > 0 },
    });

    return { success: true, data: { totalSeconds } };
}

export async function unmuteChatUser(
    discordGuildId: string,
    targetUserId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    // Delete both keys
    await Promise.all([
        redis.del(chatMuteUserKey(discordGuildId, targetUserId)),
        redis.srem(chatMutedKey(discordGuildId), targetUserId),
    ]);

    // Broadcast unmute notification
    const targetProfile = await db.userProfile.findFirst({
        where: { userId: targetUserId, guild: { discordGuildId } },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
    });
    const targetName = targetProfile?.discordNickname || targetProfile?.pseudoDofus || targetProfile?.user?.name || targetUserId;

    const notifMsg = {
        id: (await redis.incr(chatCounterKey(discordGuildId))).toString(),
        text: `🔊 **${targetName}** peut à nouveau parler dans le chat.`,
        authorId: "system",
        authorName: "SigilOS — Modération",
        createdAt: new Date().toISOString(),
        type: "system",
        systemMeta: { type: "user_unmuted", targetUserId, targetName },
    };

    const serialized = JSON.stringify(notifMsg);
    await redis.multi()
        .rpush(chatKey(discordGuildId), serialized)
        .ltrim(chatKey(discordGuildId), -CHAT_HISTORY_LIMIT, -1)
        .expire(chatKey(discordGuildId), CHAT_TTL_SECONDS)
        .exec();
    await redis.publish(chatPubSubChannel(discordGuildId), serialized);

    await createAuditLog({
        guildId: discordGuildId,
        actorUserId: session.user.id,
        actorName: session.user.name || "Admin",
        action: "CHAT_UNMUTE",
        targetType: "USER",
        targetId: targetUserId,
    });

    return { success: true };
}

export async function getMuteTTL(discordGuildId: string, userId: string): Promise<number> {
    const ttl = await redis.ttl(chatMuteUserKey(discordGuildId, userId));
    return Math.max(0, ttl);
}

export async function clearGuildChat(discordGuildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    await redis.del(chatKey(discordGuildId));

    // Broadcast a system clear event
    const clearMsg: ChatMessage = {
        id: "clear",
        text: "Summary: Le chat a été vidé par un administrateur.",
        authorId: "system",
        authorName: "SigilOS",
        createdAt: new Date().toISOString(),
        type: "system",
    };
    await redis.publish(chatPubSubChannel(discordGuildId), JSON.stringify(clearMsg));

    await createAuditLog({
        guildId: discordGuildId,
        actorUserId: session.user.id,
        actorName: session.user.name || "Admin",
        action: "CHAT_CLEAR",
        targetType: "CONFIG",
        targetId: discordGuildId,
    });

    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS — God Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getChatStatsForGod(): Promise<ActionResponse<Array<{
    guildId: string;
    guildName: string;
    enabled: boolean;
    messagesToday: number;
    messagesTotal: number;
    historySize: number;
}>>> {
    const { isSuperAdmin } = await import("./super-admin-actions");
    const isGod = await isSuperAdmin();
    if (!isGod) return { success: false, error: "Accès refusé" };

    const guilds = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { id: true, discordGuildId: true, name: true, modules: true },
        orderBy: { name: "asc" },
    });

    const today = new Date().toISOString().slice(0, 10);

    const stats = await Promise.all(guilds.map(async (guild) => {
        const [historySize, statsDay] = await Promise.all([
            redis.llen(chatKey(guild.discordGuildId)),
            redis.hget(chatStatsKey(guild.discordGuildId), today),
        ]);

        // Total messages = sum of all daily stats stored
        const allStats = await redis.hgetall(chatStatsKey(guild.discordGuildId));
        const messagesTotal = Object.values(allStats || {}).reduce((acc, v) => acc + parseInt(v || "0"), 0);

        return {
            guildId: guild.discordGuildId,
            guildName: guild.name,
            enabled: (guild.modules as any)?.chat ?? false,
            messagesToday: parseInt(statsDay || "0"),
            messagesTotal,
            historySize,
        };
    }));

    return { success: true, data: stats };
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL BLOCKLIST (GOD MODE)
// ─────────────────────────────────────────────────────────────────────────────

export async function getGlobalBlocklist(): Promise<ActionResponse<{
    words: string[],
    baseWords: string[],
    allowedDomains: string[]
}>> {
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Super-admin requis" };

    const conf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });
    const baseWords = (conf?.baseWords as string[]) ?? [];
    return {
        success: true,
        data: {
            words: (conf?.words as string[]) ?? [],
            baseWords: baseWords.length > 0 ? baseWords : (BASE_BLOCKED_WORDS as string[]),
            allowedDomains: (conf?.allowedDomains as string[]) ?? ["sigilos.fr", "beta.sigilos.fr"]
        }
    };
}

export async function addGlobalBlockword(word: string, listType: "CUSTOM" | "BASE" | "DOMAIN" = "CUSTOM"): Promise<ActionResponse> {
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Super-admin requis" };

    const clean = word.trim().slice(0, 100);
    if (!clean) return { success: false, error: "Valeur invalide" };

    const conf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });

    const words = (conf?.words as string[]) ?? [];
    const baseWordsRaw = (conf?.baseWords as string[]) ?? [];
    const baseWords = baseWordsRaw.length > 0 ? baseWordsRaw : (BASE_BLOCKED_WORDS as string[]);

    const domainsRaw = (conf?.allowedDomains as string[]) ?? [];
    const domains = domainsRaw.length > 0 ? domainsRaw : ["sigilos.fr", "beta.sigilos.fr"];

    const updatedData: any = {};
    if (listType === "CUSTOM") updatedData.words = [...words, clean];
    if (listType === "BASE") updatedData.baseWords = [...baseWords, clean];
    if (listType === "DOMAIN") {
        let h = clean.toLowerCase();
        try {
            if (h.includes("://")) h = new URL(h).hostname;
            else if (h.includes("/")) h = h.split("/")[0];
        } catch { }
        updatedData.allowedDomains = Array.from(new Set([...domains, h]));
    }

    await db.globalBlocklist.upsert({
        where: { id: "GLOBAL" },
        create: { id: "GLOBAL", ...updatedData },
        update: updatedData
    });

    await redis.del(chatGlobalBlocklistKey);
    return { success: true };
}

export async function removeGlobalBlockword(word: string, listType: "CUSTOM" | "BASE" | "DOMAIN" = "CUSTOM"): Promise<ActionResponse> {
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Super-admin requis" };

    const conf = await db.globalBlocklist.findUnique({ where: { id: "GLOBAL" } });

    const words = (conf?.words as string[]) ?? [];
    const baseWordsRaw = (conf?.baseWords as string[]) ?? [];
    const baseWords = baseWordsRaw.length > 0 ? baseWordsRaw : (BASE_BLOCKED_WORDS as string[]);

    const domainsRaw = (conf?.allowedDomains as string[]) ?? [];
    const domains = domainsRaw.length > 0 ? domainsRaw : ["sigilos.fr", "beta.sigilos.fr"];

    const updatedData: Record<string, string[]> = {};
    if (listType === "CUSTOM") updatedData.words = words.filter(w => w !== word);
    if (listType === "BASE") updatedData.baseWords = baseWords.filter(w => w !== word);
    if (listType === "DOMAIN") updatedData.allowedDomains = domains.filter(w => w !== word);

    await db.globalBlocklist.upsert({
        where: { id: "GLOBAL" },
        create: { id: "GLOBAL", ...updatedData },
        update: updatedData
    });

    await redis.del(chatGlobalBlocklistKey);
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// GUILD BLOCKLIST (ADMIN DASHBOARD)
// ─────────────────────────────────────────────────────────────────────────────

export async function getChatBlocklist(discordGuildId: string): Promise<ActionResponse<string[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { chatBlocklist: true },
    });

    return { success: true, data: (guild?.chatBlocklist as string[]) ?? [] };
}

export async function updateChatBlocklist(discordGuildId: string, words: string[]): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    await db.guildConfig.update({
        where: { discordGuildId },
        data: { chatBlocklist: words.map(w => w.trim().slice(0, 100)).filter(Boolean) },
    });

    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTD (MESSAGE OF THE DAY)
// ─────────────────────────────────────────────────────────────────────────────

export async function getChatMotd(discordGuildId: string): Promise<ActionResponse<string | null>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canViewChat) return { success: false, error: "Permission insuffisante" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { chatMotd: true } as any, // Cast to any to bypass Prisma type cache issues
    });

    return { success: true, data: (guild as any)?.chatMotd ?? null };
}

export async function updateChatMotd(discordGuildId: string, motd: string | null): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) return { success: false, error: "Administrateur requis" };

    // Clean up the string, limit length
    const cleanMotd = motd ? motd.trim().slice(0, 500) : null;

    await db.guildConfig.update({
        where: { discordGuildId },
        data: { chatMotd: cleanMotd || null } as any,
    });

    // Broadcast the new MOTD via PubSub as a special system message so clients can update in real-time
    const motdMsg: ChatMessage = {
        id: `motd:${Date.now()}`,
        text: cleanMotd || "",
        authorId: "system",
        authorName: "SigilOS",
        createdAt: new Date().toISOString(),
        type: "system",
        systemMeta: { "type": "motd_update", "motd": cleanMotd }
    };
    await redis.publish(chatPubSubChannel(discordGuildId), JSON.stringify(motdMsg));

    await createAuditLog({
        guildId: discordGuildId,
        actorUserId: session.user.id,
        actorName: session.user.name || "Admin",
        action: "CHAT_MOTD_UPDATE",
        targetType: "CONFIG",
        targetId: discordGuildId,
        newValue: { chatMotd: cleanMotd },
    });

    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MENTION RULES (ADMIN DASHBOARD)
// ─────────────────────────────────────────────────────────────────────────────

export async function getChatMentionRules(discordGuildId: string): Promise<ActionResponse<Record<string, string[]>>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { chatMentionRules: true } as any,
    });

    const rules = (guild as any)?.chatMentionRules;
    return { success: true, data: (typeof rules === "object" && rules !== null ? rules : {}) as Record<string, string[]> };
}

export async function updateChatMentionRules(discordGuildId: string, rules: Record<string, string[]>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canModerateChat) return { success: false, error: "Permission chat:moderate requise" };

    // Format and validate the rules object (ensure it's mostly strings)
    const cleanRules: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(rules)) {
        if (Array.isArray(value)) {
            // keep strings, trim them
            cleanRules[key.trim()] = value.filter(v => typeof v === "string").map(v => v.trim());
        }
    }

    await db.guildConfig.update({
        where: { discordGuildId },
        data: { chatMentionRules: cleanRules } as any,
    });

    return { success: true };
}

export async function getChatMentionOptions(discordGuildId: string): Promise<ActionResponse<{ type: "user" | "role"; id: string; name: string; image?: string }[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canViewChat) return { success: false, error: "Permission insuffisante" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true, chatMentionRules: true, rolesMapping: true } as any,
    });
    if (!guild) return { success: false, error: "Guilde introuvable" };

    const rules = (guild as any)?.chatMentionRules || {};
    const rolesMapping = (guild as any)?.rolesMapping || {};

    // Determine the user's roles to check mention permissions
    const userRoles = ctx.roles || [];
    const isGodMode = ctx.isAdmin; // Admins can mention everyone

    let allowedTargetRoles: string[] = [];
    if (isGodMode) {
        allowedTargetRoles = Object.keys(rolesMapping);
    } else {
        // Collect all allowed targets from all roles the user has
        const allowedSet = new Set<string>();
        for (const roleId of userRoles) {
            const targets = rules[roleId];
            if (Array.isArray(targets)) {
                targets.forEach(t => allowedSet.add(t));
            }
        }
        allowedTargetRoles = Array.from(allowedSet);
    }

    // Correctly filter by internal guild ID
    const profiles = await db.userProfile.findMany({
        where: { guildId: guild.id } as any,
        select: { userId: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true, image: true } } },
    }) as any[];

    const { fetchGuildRoles } = await import("@/server/discord");
    let discordRoles: any[] = [];
    try {
        discordRoles = await fetchGuildRoles(discordGuildId);
    } catch { }

    const roleMap = Object.fromEntries(discordRoles.map((r: any) => [r.id, r.name]));

    const options: { type: "user" | "role"; id: string; name: string; image?: string }[] = [];

    // Add roles (only those allowed)
    for (const roleId of allowedTargetRoles) {
        if (!roleId) continue;
        options.push({
            type: "role",
            id: `role_${roleId}`,
            name: roleMap[roleId] || roleId,
        });
    }

    // Add users
    for (const p of profiles) {
        const name = p.discordNickname || p.pseudoDofus || p.user?.name || "Membre";
        options.push({
            type: "user",
            id: p.userId,
            name,
            image: p.user?.image || undefined,
        });
    }

    return { success: true, data: options };
}

export async function voteInChatPoll(discordGuildId: string, messageId: string, optionId: string, runId?: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.canViewChat) return { success: false, error: "Permission insuffisante" };

    const key = runId ? runChatKey(runId) : chatKey(discordGuildId);
    const messages = await redis.lrange(key, 0, -1);
    const msgIndex = messages.findIndex(m => {
        try {
            const parsed = JSON.parse(m);
            return parsed.id === messageId;
        } catch { return false; }
    });

    if (msgIndex === -1) return { success: false, error: "Sondage introuvable ou expiré" };

    const msgObj: ChatMessage = JSON.parse(messages[msgIndex]);
    if (msgObj.type !== "poll" || !msgObj.pollData) return { success: false, error: "Ceci n'est pas un sondage" };

    const userId = session.user.id;
    if (!msgObj.pollData.voters) msgObj.pollData.voters = {}; // Safety

    const oldOptionId = msgObj.pollData.voters[userId];

    if (oldOptionId === optionId) return { success: true }; // Already voted for this

    msgObj.pollData.voters[userId] = optionId;

    // Recalculate votes
    msgObj.pollData.options.forEach(opt => opt.votes = 0);
    Object.values(msgObj.pollData.voters).forEach(optId => {
        const option = msgObj.pollData!.options.find(o => o.id === optId);
        if (option) option.votes++;
    });

    const serialized = JSON.stringify(msgObj);
    await redis.lset(key, msgIndex, serialized);

    // Broadcast updated message
    const pubChannel = runId ? runChatPubSubChannel(runId) : chatPubSubChannel(discordGuildId);
    await redis.publish(pubChannel, serialized);

    return { success: true };
}

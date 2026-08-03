'use server';

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { redis } from "@/lib/redis";

const LOBBY_CACHE_TTL = 5; // 5 seconds cache for lobby list (keep it very short for real-time games)

const getClient = () => ((db as any).geoguesserSession ? db : null) as any;

export async function createGeoguesserSession(guildId: string, maxRounds: number = 5, timePerRound: number = 30) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isMember) return { success: false, error: "Not a member" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        // Clean up ANY existing session for this host in this guild to prevent ghost rooms
        await client.geoguesserSession.deleteMany({
            where: {
                guildId,
                hostId: session.user.id
            }
        });

        const room = await client.geoguesserSession.create({
            data: {
                guildId,
                hostId: session.user.id,
                hostName: ctx.name || "Hôte",
                maxRounds,
                timePerRound,
                status: 'LOBBY',
                participants: {
                    create: {
                        userId: session.user.id,
                        userName: ctx.name || "Joueur",
                        userAvatar: session.user.image,
                    }
                }
            },
            include: {
                participants: true
            }
        });

        // Invalidate cache
        await redis.del(`lobby:guild:${guildId}`);

        revalidatePath(`/dashboard/${guildId}/mini-jeux`);
        return { success: true, data: room };
    } catch (error) {
        return { success: false, error: "Erreur de base de données" };
    }
}

export async function getActiveGeoguesserSessions(guildId: string) {
    const cacheKey = `lobby:guild:${guildId}`;

    // 1. Try Redis first
    if (redis.status === "ready") {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (e) {
            console.error("[Redis] Cache read error:", e);
        }
    }

    try {
        const client = (db as any).geoguesserSession ? db : null;
        if (!client) {
            console.error("CRITICAL: geoguesserSession model not found even in baseDb");
            return [];
        }

        const sessions = await (client as any).geoguesserSession.findMany({
            where: {
                guildId,
                status: { in: ['LOBBY', 'IN_PROGRESS'] },
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Filtre 24h d'inactivité
            },
            include: {
                _count: {
                    select: { participants: true }
                },
                participants: {
                    select: {
                        userId: true,
                        userName: true,
                        userAvatar: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Store in Redis
        if (redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(sessions), "EX", LOBBY_CACHE_TTL);
            } catch (e) {
                console.error("[Redis] Cache write error:", e);
            }
        }

        return sessions;
    } catch (error) {
        return [];
    }
}

export async function joinGeoguesserSession(sessionId: string, isSpectator: boolean = false) {
    const sessionToken = await auth();
    if (!sessionToken?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        if (isSpectator) {
             const room = await client.geoguesserSession.findUnique({ where: { id: sessionId } });
             if (!room) return { success: false, error: "Salon introuvable" };
             return { success: true };
        }

        const room = await client.geoguesserSession.findUnique({
            where: { id: sessionId },
            include: { participants: true }
        });

        if (!room) return { success: false, error: "Salon introuvable" };
        
        const isAlreadyIn = room.participants.some((p: any) => p.userId === sessionToken.user!.id);

        if (room.status !== 'LOBBY' && !isAlreadyIn) {
            return { success: false, error: "La partie a déjà commencé" };
        }
        
        if (!isAlreadyIn && room.participants.length >= 8) {
            return { success: false, error: "Le salon est complet (8 joueurs max)." };
        }

        if (!isAlreadyIn) {
            const ctx = await getUserContext(room.guildId);
            await client.geoguesserSessionPlayer.create({
                data: {
                    sessionId,
                    userId: sessionToken.user!.id,
                    userName: ctx.name || "Joueur",
                    userAvatar: sessionToken.user!.image,
                }
            });

            // Notifier le propriétaire du salon (si ce n'est pas lui-même)
            if (room.hostId !== sessionToken.user!.id && (client as any).notification) {
                try {
                    // Resolve internal guild ID for notification (room.guildId est un discordGuildId)
                    const guildConfig = await client.guildConfig.findUnique({
                        where: { discordGuildId: room.guildId },
                        select: { id: true }
                    });
                    await (client as any).notification.create({
                        data: {
                            userId: room.hostId,
                            guildId: guildConfig?.id || null,
                            title: "SigilGuesser",
                            message: `${ctx.name} a rejoint votre salon !`,
                            type: "SYSTEM_INFO",
                            category: "SYSTEM",
                            link: `/dashboard/${room.guildId}/mini-jeux`
                        }
                    });
                } catch (e) {
                    console.error("Failed to send notification:", e);
                }
            }
        }

        // --- INVALIDATE CACHE ---
        await redis.del(`lobby:guild:${room.guildId}`);

        return { success: true };
    } catch (error) {
        return { success: false, error: "Erreur de base de données" };
    }
}

export async function startGeoguesserSession(sessionId: string, targetMapIds: number[]) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        const room = await client.geoguesserSession.findUnique({
            where: { id: sessionId }
        });

        if (!room) return { success: false, error: "Room not found" };
        if (room.hostId !== session.user.id) return { success: false, error: "Only host can start" };

        await client.geoguesserSession.update({
            where: { id: sessionId },
            data: {
                status: 'IN_PROGRESS',
                targetMapIds,
                currentRound: 1
            }
        });

        // --- INVALIDATE CACHE ---
        await redis.del(`lobby:guild:${room.guildId}`);

        return { success: true };
    } catch (error) {
        console.error("Failed to start game:", error);
        return { success: false, error: "Database error" };
    }
}

export async function submitSessionGuess(
    sessionId: string,
    round: number,
    x: number,
    y: number,
    worldId: number,
    score: number,
    distance: number
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        const player = await client.geoguesserSessionPlayer.findUnique({
            where: { sessionId_userId: { sessionId, userId: session.user.id } }
        });

        if (!player) return { success: false, error: "Player not in session" };

        const currentGuesses = (player.guesses as any[]) || [];
        const newGuess = { round, x, y, score, distance, worldId };

        // Remove existing guess for this round if any (safety)
        const updatedGuesses = currentGuesses.filter(g => g.round !== round);
        updatedGuesses.push(newGuess);

        await client.geoguesserSessionPlayer.update({
            where: { id: player.id },
            data: {
                guesses: updatedGuesses,
                totalScore: { increment: score },
                hasGuessed: true
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to submit session guess:", error);
        return { success: false, error: "Database error" };
    }
}

export async function getSessionStatus(sessionId: string) {
    try {
        const client = getClient();
        if (!client) return null;

        return await client.geoguesserSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: true
            }
        });
    } catch (error) {
        return null;
    }
}

export async function advanceSessionRound(sessionId: string, newRound: number) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        await client.geoguesserSession.update({
            where: { id: sessionId },
            data: {
                currentRound: newRound,
                participants: {
                    updateMany: {
                        where: { sessionId },
                        data: { hasGuessed: false }
                    }
                }
            }
        });

        const room = await client.geoguesserSession.findUnique({ where: { id: sessionId } });
        if (room) {
            // --- INVALIDATE CACHE ---
            await redis.del(`lobby:guild:${room.guildId}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to advance round:", error);
        return { success: false, error: "Database error" };
    }
}

export async function leaveGeoguesserSession(sessionId: string) {
    const sessionToken = await auth();
    if (!sessionToken?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const client = getClient();
        if (!client) return { success: false, error: "Database client not ready" };

        const room = await client.geoguesserSession.findUnique({
            where: { id: sessionId },
            include: { participants: true }
        });

        if (!room) return { success: false, error: "Room not found" };

        // Save scores to perpetual ladder if it was a real game
        if (room.status === 'FINISHED' || room.status === 'IN_PROGRESS') {
            for (const p of room.participants) {
                if (p.totalScore > 0) {
                    await updateGeoguesserLadder(p.userName, p.totalScore);
                }
            }
        }

        if (room.hostId === sessionToken.user.id) {
            await client.geoguesserSession.delete({ where: { id: sessionId } });
        } else {
            await client.geoguesserSessionPlayer.deleteMany({
                where: { sessionId, userId: sessionToken.user.id }
            });
        }

        await redis.del(`lobby:guild:${room.guildId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Database error" };
    }
}

export async function finishGeoguesserSession(sessionId: string) {
    try {
        const client = getClient();
        if (!client) return;
        
        await client.geoguesserSession.update({
            where: { id: sessionId },
            data: { status: 'FINISHED' }
        });

        // Sync to ladder
        const room = await client.geoguesserSession.findUnique({
            where: { id: sessionId },
            include: { participants: true }
        });

        if (room) {
            for (const p of room.participants) {
                if (p.totalScore > 0) {
                    await updateGeoguesserLadder(p.userName, p.totalScore);
                }
            }
            // --- INVALIDATE CACHE ---
            await redis.del(`lobby:guild:${room.guildId}`);
        }
    } catch (e) {
        console.error("Failed to finish session:", e);
    }
}

export async function deleteGeoguesserSession(sessionId: string) {
    try {
        const client = getClient();
        if (!client) return;

        const room = await client.geoguesserSession.findUnique({ where: { id: sessionId } });
        if (room) {
            await client.geoguesserSession.delete({ where: { id: sessionId } });
            await redis.del(`lobby:guild:${room.guildId}`);
        }
    } catch (e) {
        // Silently fail if already deleted
    }
}

async function updateGeoguesserLadder(pseudo: string, score: number) {
    if (redis.status !== "ready") return;
    try {
        await redis.zincrby("sigilguesser:ladder:v1", score, pseudo);
    } catch (e) {
        console.error("Ladder update failed:", e);
    }
}

export async function getGeoguesserLadder(limit: number = 10) {
    if (redis.status !== "ready") return [];
    try {
        // ZREVRANGE returns the top scores
        const data = await redis.zrevrange("sigilguesser:ladder:v1", 0, limit - 1, "WITHSCORES");
        const results = [];
        for (let i = 0; i < data.length; i += 2) {
            results.push({
                pseudo: data[i],
                score: parseInt(data[i + 1], 10)
            });
        }
        return results;
    } catch (e) {
        return [];
    }
}

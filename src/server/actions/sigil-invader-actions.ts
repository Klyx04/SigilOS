"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redis } from "@/lib/redis";
import { getUserContext } from "./user-actions";

export type InvaderRoom = {
    roomId: string;
    hostId: string;
    hostName: string;
    guildId: string;
    playerCount: number;
    maxPlayers: number;
    state: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
    players: {
        userId: string;
        name: string;
        avatar?: string;
        score: number;
        ready: boolean;
        lives: number;
    }[];
    difficulty: number;
    wave: number;
};

const ROOM_PREFIX = "sigil_invader:room:";

export async function createInvaderRoom(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const user = await getUserContext(guildId);
    if (!user.isMember) throw new Error("Membre requis");

    const roomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const room: InvaderRoom = {
        roomId,
        hostId: session.user.id,
        hostName: session.user.name || "Inconnu",
        guildId,
        playerCount: 1,
        maxPlayers: 4,
        state: 'LOBBY',
        players: [{
            userId: session.user.id,
            name: session.user.name || "Inconnu",
            avatar: session.user.image || undefined,
            score: 0,
            ready: false,
            lives: 3
        }],
        difficulty: 1,
        wave: 1
    };

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room), "EX", 3600); // 1 hour TTL
    
    // Broadcast for dashboard
    await redis.publish(`guild:${guildId}:activity`, JSON.stringify({
        type: "INVADER_ROOM_CREATED",
        data: room
    }));

    revalidatePath(`/dashboard/${guildId}/mini-jeux`);

    return { success: true, roomId };
}

export async function getInvaderRoom(roomId: string): Promise<InvaderRoom | null> {
    const data = await redis.get(`${ROOM_PREFIX}${roomId}`);
    if (!data) return null;
    return JSON.parse(data);
}

export async function joinInvaderRoom(roomId: string, guildId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const user = await getUserContext(guildId);
    if (!user.isMember) throw new Error("Membre requis");

    const room = await getInvaderRoom(roomId);
    if (!room) throw new Error("Salon introuvable");
    if (room.state !== 'LOBBY') throw new Error("Partie déjà commencée");
    if (room.playerCount >= room.maxPlayers) throw new Error("Salon plein");

    // Check if player already in
    if (room.players.find(p => p.userId === session.user?.id)) return { success: true };

    room.players.push({
        userId: session.user.id,
        name: session.user.name || "Inconnu",
        avatar: session.user.image || undefined,
        score: 0,
        ready: false,
        lives: 3
    });
    room.playerCount = room.players.length;

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room), "EX", 3600);
    
    await redis.publish(`invader:room:${roomId}`, JSON.stringify({
        type: "PLAYER_JOINED",
        player: room.players[room.players.length - 1]
    }));

    return { success: true };
}

export async function setPlayerReady(roomId: string, ready: boolean) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const room = await getInvaderRoom(roomId);
    if (!room) throw new Error("Salon introuvable");

    const player = room.players.find(p => p.userId === session.user?.id);
    if (!player) throw new Error("Joueur non trouvé");

    player.ready = ready;

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room), "EX", 3600);
    
    await redis.publish(`invader:room:${roomId}`, JSON.stringify({
        type: "PLAYER_READY",
        userId: session.user.id,
        ready
    }));

    // Auto-start if everyone is ready and hosted by admin or host
    const allReady = room.players.every(p => p.ready);
    if (allReady && room.players.length > 0) {
        // We could auto start or wait for host
    }

    return { success: true };
}

export async function startInvaderGame(roomId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const room = await getInvaderRoom(roomId);
    if (!room) throw new Error("Salon introuvable");
    if (room.hostId !== session.user?.id) throw new Error("Seul l'hôte peut lancer");

    room.state = 'PLAYING';
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room), "EX", 3600);
    
    await redis.publish(`invader:room:${roomId}`, JSON.stringify({
        type: "GAME_STARTED"
    }));

    return { success: true };
}

export async function updatePlayerScore(roomId: string, score: number) {
    const session = await auth();
    if (!session?.user?.id) return;

    const room = await getInvaderRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.userId === session.user?.id);
    if (!player) return;

    player.score = score;
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room), "EX", 3600);
}

export async function getActiveInvaderRooms(guildId: string): Promise<InvaderRoom[]> {
    const keys = await redis.keys(`${ROOM_PREFIX}*`);
    if (keys.length === 0) return [];

    const roomsData = await redis.mget(...keys);
    const rooms: InvaderRoom[] = roomsData
        .filter((r): r is string => !!r)
        .map(r => JSON.parse(r))
        .filter(r => r.guildId === guildId && r.state === 'LOBBY');

    return rooms;
}

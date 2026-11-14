/**
 * Révocation d'accès aux rooms de guilde — règles pures (audit 13/11/2026, lot 4f).
 *
 * Mesure qui justifie ce module : le serveur WS ne vérifiait l'appartenance
 * qu'aux `*:join`. Un membre expulsé ou banni gardait donc son socket abonné à
 * `guild:<id>` (et à ses sous-rooms guide/dofus/raid-live) jusqu'à la fermeture
 * de l'onglet. Les heartbeats, eux, ne font AUCUNE requête DB : un simple
 * `leave()` ne suffirait pas, il faut couper le socket.
 *
 * Ce fichier ne connaît ni Redis ni Socket.IO : il ne contient que des règles
 * testables dans `tests/unit/ws-guild-revocation.test.ts`.
 */

import { z } from "zod";

/** Canal Redis publié par le serveur Next, écouté par le process WS. */
export const GUILD_MEMBER_REVOKED_CHANNEL = "guild:member:revoked";

/** Événement Socket.IO émis juste avant la coupure (le client rafraîchit sa page). */
export const GUILD_ACCESS_REVOKED_EVENT = "guild:access-revoked";

/** Room des sockets sans guilde — jamais révoquée. */
export const GLOBAL_GUILD_ROOM = "guild:global";

/**
 * Sweep d'appartenance : intervalle par défaut et bornes. Une valeur d'env
 * invalide retombe sur le défaut — jamais 0, qui désactiverait silencieusement
 * le filet de sécurité (fail-closed).
 */
export const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
export const MIN_SWEEP_INTERVAL_MS = 15_000;
export const MAX_SWEEP_INTERVAL_MS = 600_000;

/** Nombre maximum de couples (utilisateur, guilde) vérifiés par passe. */
export const MAX_SWEEP_PAIRS = 1_000;

/** Taille maximale d'un message de révocation accepté par le serveur WS. */
export const MAX_REVOCATION_PAYLOAD_CHARS = 2_048;

export type GuildRevocationReason = "LEFT" | "BANNED" | "ARCHIVED" | "KICKED" | "SWEEP";

/** Payload publié sur `guild:member:revoked` (Zod borné à la réception). */
export type GuildMemberRevokedPayload = {
    discordGuildId: string;
    userId?: string;
    discordId?: string;
    reason: Exclude<GuildRevocationReason, "SWEEP">;
    at?: string;
};

export type SocketGuildPair = {
    userId: string;
    guildId: string;
};

/** Extrait l'identifiant de guilde d'une room `guild:<id>` ou `guild:<id>:<sous-room>`. */
export function guildIdOfRoom(room: string): string | null {
    if (typeof room !== "string" || !room.startsWith("guild:")) return null;
    const guildId = room.slice("guild:".length).split(":", 1)[0];
    if (!guildId || guildId === "global") return null;
    return guildId;
}

/** Toutes les guildes distinctes dont un socket est membre via ses rooms. */
export function guildIdsOfRooms(rooms: Iterable<string>): string[] {
    const ids = new Set<string>();
    for (const room of rooms) {
        const guildId = guildIdOfRoom(room);
        if (guildId) ids.add(guildId);
    }
    return [...ids];
}

/** Rooms à quitter pour une guilde donnée (room principale et sous-rooms). */
export function roomsToLeaveForGuild(rooms: Iterable<string>, guildId: string): string[] {
    const toLeave: string[] = [];
    for (const room of rooms) {
        if (guildIdOfRoom(room) === guildId) toLeave.push(room);
    }
    return toLeave;
}

/**
 * Construit les couples (utilisateur, guilde) à vérifier depuis les sockets.
 * Les sockets sans identité (auth coupée) sont ignorés ; les doublons sont
 * fusionnés ; la passe est bornée pour ne jamais lancer une requête géante.
 */
export function collectSocketGuildPairs(
    sockets: Iterable<{ userId?: string | null; rooms: Iterable<string> }>,
    maxPairs: number = MAX_SWEEP_PAIRS
): { pairs: SocketGuildPair[]; truncated: boolean } {
    const cap = Math.max(1, Math.trunc(maxPairs));
    const seen = new Set<string>();
    const pairs: SocketGuildPair[] = [];
    let truncated = false;

    for (const socket of sockets) {
        if (!socket.userId) continue;
        for (const guildId of guildIdsOfRooms(socket.rooms)) {
            const key = pairKey(socket.userId, guildId);
            if (seen.has(key)) continue;
            if (pairs.length >= cap) {
                truncated = true;
                continue;
            }
            seen.add(key);
            pairs.push({ userId: socket.userId, guildId });
        }
    }

    return { pairs, truncated };
}

/**
 * Diff pure entre les couples présents côté sockets et les autorisations
 * réellement ACTIVE en base : ce qui n'est plus actif doit être révoqué.
 */
export function planRevocations(
    pairs: readonly SocketGuildPair[],
    activePairs: ReadonlySet<string>
): SocketGuildPair[] {
    const seen = new Set<string>();
    const revocations: SocketGuildPair[] = [];
    for (const pair of pairs) {
        const key = pairKey(pair.userId, pair.guildId);
        if (activePairs.has(key) || seen.has(key)) continue;
        seen.add(key);
        revocations.push(pair);
    }
    return revocations;
}

/** Intervalle du sweep, borné ; une valeur absente ou invalide retombe sur le défaut. */
export function sweepIntervalMs(raw: string | null | undefined): number {
    if (raw === undefined || raw === null || raw.trim() === "") return DEFAULT_SWEEP_INTERVAL_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SWEEP_INTERVAL_MS;
    return Math.min(MAX_SWEEP_INTERVAL_MS, Math.max(MIN_SWEEP_INTERVAL_MS, Math.trunc(parsed)));
}

const snowflakeSchema = z.string().regex(/^\d{17,20}$/);

const guildMemberRevokedSchema = z
    .object({
        discordGuildId: snowflakeSchema,
        userId: z.string().min(1).max(64).optional(),
        discordId: snowflakeSchema.optional(),
        reason: z.enum(["LEFT", "BANNED", "ARCHIVED", "KICKED"]),
        at: z.string().max(40).optional(),
    })
    .refine((payload) => Boolean(payload.userId || payload.discordId), {
        message: "userId ou discordId requis",
    });

/**
 * Parse et borne un message du canal de révocation. Retourne `null` sur tout
 * message malformé ou trop long — le canal Redis n'est jamais une entrée de
 * confiance, même s'il est interne.
 */
export function parseGuildMemberRevoked(raw: string | Buffer): GuildMemberRevokedPayload | null {
    const message = typeof raw === "string" ? raw : raw.toString("utf8");
    if (message.length === 0 || message.length > MAX_REVOCATION_PAYLOAD_CHARS) return null;
    try {
        const parsed = guildMemberRevokedSchema.safeParse(JSON.parse(message));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** Clé stable d'un couple (utilisateur, guilde) — séparateur absent des deux identifiants. */
export function pairKey(userId: string, guildId: string): string {
    return `${userId}\u0000${guildId}`;
}

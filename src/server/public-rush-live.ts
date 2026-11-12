/**
 * Rush Live des visiteurs (V2c) — **couche serveur** (Redis uniquement, aucune migration).
 *
 * Trois opérations, un invariant : le `serverId` vient **du profil** (`getPublicAccount`),
 * jamais d'un paramètre. Aucune clé ne porte de `guildId`, de `userId` ni de secret.
 *
 *  · `publishPublicRushLive` — un événement par bloc **nouvellement** coché, titre résolu en
 *    base (`GuideMilestone`, borné au guide `rush-sylvestre`) : un client ne peut pas injecter
 *    de texte ;
 *  · `refreshPublicRushPresence` / `readPublicRushPresence` — présence éphémère (ZSET + hash,
 *    TTL 45 s), **zéro écriture Postgres** ;
 *  · `readPublicRushLiveEvents` — les événements postérieurs au curseur du lecteur.
 *
 * **Fail-soft assumé** : une panne Redis ne doit pas faire échouer l'enregistrement de la
 * progression (le navigateur reste la source, la base le miroir) ni bloquer le guide. On perd
 * une notification, jamais une coche. Les lectures rendent `unavailable`, jamais un compteur
 * inventé.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { PUBLIC_RUSH_GUIDE_ID } from "@/lib/public-rush-progress";
import {
    PUBLIC_RUSH_LIVE_EVENT_TTL_SECONDS,
    PUBLIC_RUSH_LIVE_MAX_EVENTS,
    PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS,
    PUBLIC_RUSH_LIVE_MAX_MEMBERS,
    PUBLIC_RUSH_LIVE_PRESENCE_TTL_SECONDS,
    PUBLIC_RUSH_LIVE_TITLE_MAX,
    newMilestoneIds,
    publicRushLiveEventSchema,
    publicRushLiveKeys,
    publicRushLiveKind,
    publicRushLiveMemberSchema,
    publicRushLivePseudo,
    type PublicRushLiveEvent,
    type PublicRushLiveMember,
} from "@/lib/public-rush-live";

/** Le strict nécessaire du profil, déjà résolu par `getPublicAccount()`. */
export type PublicRushLiveProfile = {
    id: string;
    pseudoDofus: string | null;
    classe: string | null;
    dofusServerId: number;
    showPresence: boolean;
};

export type PublicRushPresenceSnapshot = {
    status: "live" | "unavailable";
    members: PublicRushLiveMember[];
};

/**
 * `ioredis` est configuré avec `maxRetriesPerRequest: null` : une commande envoyée hors
 * connexion **attend** indéfiniment. On ne parle donc à Redis que lorsqu'il est prêt —
 * sinon on rend l'état honnête au lieu de pendre une server action.
 */
function redisReady(): boolean {
    return redis.status === "ready";
}

/**
 * Enregistre / rafraîchit la présence d'un visiteur **consentant**. Retourne `false` quand
 * Redis n'a pas pu écrire — l'appelant le dit à l'écran, il ne compte pas un absent.
 */
export async function refreshPublicRushPresence(profile: PublicRushLiveProfile): Promise<boolean> {
    if (!redisReady()) return false;
    try {
        const keys = publicRushLiveKeys(profile.dofusServerId);
        const now = Date.now();
        const member = publicRushLiveMemberSchema.parse({
            pseudo: publicRushLivePseudo(profile.pseudoDofus),
            classe: profile.classe ?? null,
        });
        const ttl = PUBLIC_RUSH_LIVE_PRESENCE_TTL_SECONDS * 4;
        await redis
            .multi()
            .zadd(keys.presence, now, profile.id)
            .hset(keys.presenceMeta, profile.id, JSON.stringify(member))
            // Purge des battements périmés : la même clé ne grossit pas indéfiniment.
            .zremrangebyscore(keys.presence, "-inf", now - PUBLIC_RUSH_LIVE_PRESENCE_TTL_SECONDS * 1000)
            .expire(keys.presence, ttl)
            .expire(keys.presenceMeta, ttl)
            .exec();
        return true;
    } catch (error) {
        logger.warn("[Rush Live] Présence non enregistrée", { error: String(error) });
        return false;
    }
}

/** Retire la présence à la fermeture du flux (un onglet fermé n'est plus « en ligne »). */
export async function clearPublicRushPresence(profileId: string, serverId: number): Promise<void> {
    if (!redisReady()) return;
    try {
        const keys = publicRushLiveKeys(serverId);
        await redis.multi().zrem(keys.presence, profileId).hdel(keys.presenceMeta, profileId).exec();
    } catch (error) {
        logger.warn("[Rush Live] Présence non retirée", { error: String(error) });
    }
}

/** Instantané borné des présents. `unavailable` dès que la source manque. */
export async function readPublicRushPresence(serverId: number): Promise<PublicRushPresenceSnapshot> {
    if (!redisReady()) return { status: "unavailable", members: [] };
    try {
        const keys = publicRushLiveKeys(serverId);
        const since = Date.now() - PUBLIC_RUSH_LIVE_PRESENCE_TTL_SECONDS * 1000;
        const ids = await redis.zrangebyscore(
            keys.presence,
            since,
            "+inf",
            "LIMIT",
            0,
            PUBLIC_RUSH_LIVE_MAX_MEMBERS
        );
        if (ids.length === 0) return { status: "live", members: [] };

        const raw = await redis.hmget(keys.presenceMeta, ...ids);
        const members: PublicRushLiveMember[] = [];
        for (const value of raw) {
            if (!value) continue;
            try {
                const parsed = publicRushLiveMemberSchema.safeParse(JSON.parse(value));
                if (parsed.success) members.push(parsed.data);
            } catch {
                /* une entrée illisible est ignorée, elle ne casse pas l'instantané */
            }
        }
        return { status: "live", members };
    } catch (error) {
        logger.warn("[Rush Live] Présence illisible", { error: String(error) });
        return { status: "unavailable", members: [] };
    }
}

/**
 * Publie les blocs **nouvellement** cochés d'un visiteur consentant.
 *
 * Appelée en « fire-and-forget » par `savePublicRushProgress` : la progression est déjà
 * écrite, un incident Redis ne doit pas la rendre en échec.
 */
export async function publishPublicRushLive(input: {
    profile: PublicRushLiveProfile;
    previousMilestones: readonly string[];
    nextMilestones: readonly string[];
}): Promise<void> {
    // Le consentement gouverne le fait d'être vu — validations comprises.
    if (!input.profile.showPresence) return;

    const added = newMilestoneIds(input.previousMilestones, input.nextMilestones);
    if (added.length === 0) return;
    if (!redisReady()) return;

    try {
        const rows = await db.guideMilestone.findMany({
            where: {
                id: { in: added },
                // Un identifiant venu du client ne peut désigner qu'un bloc de CE guide :
                // sinon un bloc d'un autre guide ferait publier son titre ici.
                guide: { slug: PUBLIC_RUSH_GUIDE_ID },
            },
            select: { id: true, title: true, type: true },
        });
        if (rows.length === 0) return;

        const byId = new Map(rows.map((row) => [row.id, row]));
        const ordered = added
            .map((id) => byId.get(id))
            .filter((row): row is NonNullable<typeof row> => Boolean(row));
        if (ordered.length === 0) return;

        const keys = publicRushLiveKeys(input.profile.dofusServerId);
        const pseudo = publicRushLivePseudo(input.profile.pseudoDofus);

        // Une seule réservation d'identifiants : deux serveurs (ou deux onglets) qui publient
        // en même temps ne se marchent pas dessus.
        const lastId = await redis.incrby(keys.sequence, ordered.length);
        const firstId = lastId - ordered.length + 1;

        const payloads: string[] = [];
        ordered.forEach((row, index) => {
            const title = row.title.trim().slice(0, PUBLIC_RUSH_LIVE_TITLE_MAX);
            if (!title) return;
            const parsed = publicRushLiveEventSchema.safeParse({
                id: firstId + index,
                kind: publicRushLiveKind(row.type),
                milestoneId: row.id,
                title,
                pseudo,
            });
            if (parsed.success) payloads.push(JSON.stringify(parsed.data));
        });
        if (payloads.length === 0) return;

        await redis
            .multi()
            .rpush(keys.events, ...payloads)
            .ltrim(keys.events, 0, PUBLIC_RUSH_LIVE_MAX_EVENTS - 1)
            .expire(keys.events, PUBLIC_RUSH_LIVE_EVENT_TTL_SECONDS)
            .exec();
    } catch (error) {
        logger.warn("[Rush Live] Événement non publié", { error: String(error) });
    }
}

/**
 * Les événements postérieurs au curseur du lecteur, dans l'ordre de publication.
 * Le dernier identifiant reçu devient le curseur suivant côté route.
 */
export async function readPublicRushLiveEvents(
    serverId: number,
    sinceId: number
): Promise<PublicRushLiveEvent[]> {
    if (!redisReady()) return [];
    try {
        const keys = publicRushLiveKeys(serverId);
        const raw = await redis.lrange(keys.events, 0, -1);
        const out: PublicRushLiveEvent[] = [];
        for (const line of raw) {
            try {
                const parsed = publicRushLiveEventSchema.safeParse(JSON.parse(line));
                if (!parsed.success) continue;
                if (parsed.data.id <= sinceId) continue;
                out.push(parsed.data);
            } catch {
                /* une ligne illisible ne bloque pas les suivantes */
            }
        }
        return out.slice(-PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS);
    } catch (error) {
        logger.warn("[Rush Live] Événements illisibles", { error: String(error) });
        return [];
    }
}

/**
 * Curseur de départ d'une nouvelle connexion : le dernier événement **déjà** en room.
 * Sans lui, chaque ouverture rejouerait jusqu'à 100 validations passées en toasts.
 */
export async function publicRushLiveEventHead(serverId: number): Promise<number> {
    if (!redisReady()) return 0;
    try {
        const keys = publicRushLiveKeys(serverId);
        const last = await redis.lindex(keys.events, -1);
        if (!last) return 0;
        const parsed = publicRushLiveEventSchema.safeParse(JSON.parse(last));
        return parsed.success ? parsed.data.id : 0;
    } catch {
        return 0;
    }
}

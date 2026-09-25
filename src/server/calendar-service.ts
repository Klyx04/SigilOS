import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type {
    CalendarEmbedSyncStatus,
    CalendarInteractionAction,
    CalendarRegistrationOutcome,
} from "@/lib/calendar-interaction-feedback";
import { revalidatePath } from "next/cache";
import { updateChannelMessage, sendChannelMessage, fetchChannel, createForumPost } from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";
import { getDofusWeek } from "@/lib/date-utils";
import { resolveEventImageFile } from "@/lib/calendar-event-images";
import { discordIdKind, isDiscordSnowflake, isOutboxMessageId } from "@/lib/discord-ids";
import { messageHasCustomId } from "@/lib/discord-components";
import { buildClassDispatchFields, buildClassSelectRow, type DispatchEntry } from "@/server/discord-class-dispatch";

// Les visuels (génériques + dédiés par type de raid) vivent dans
// `src/lib/calendar-event-images.ts` : même source pour l'embed Discord et les
// cartes du dashboard.

// Map event types to emojis and colors
const EVENT_CONFIG: Record<string, { emoji: string; color: number; label: string }> = {
    RAID_OFFICIAL: { emoji: "⚔️", color: 0xef4444, label: "Raid 3.6" },
    EVENT_GUILD: { emoji: "🎉", color: 0x8b5cf6, label: "Event Guilde" },
    SESSION_MISSIONS: { emoji: "🎯", color: 0x3b82f6, label: "Missions Guilde" },
    SORTIE_FARM: { emoji: "🌾", color: 0x22c55e, label: "Sortie Farm" },
    // Fallbacks
    ALMANAX_BONUS: { emoji: "✨", color: 0xf59e0b, label: "Almanax" },
    GUILD_MISSION: { emoji: "📋", color: 0x06b6d4, label: "Missions" },
    SONGES_RUN: { emoji: "🌙", color: 0x6366f1, label: "Songes" },
    DUNGEON_FARM: { emoji: "🏰", color: 0xec4899, label: "Donjon" },
    SOCIAL: { emoji: "🍻", color: 0xf97316, label: "Social" },
    OFFICIAL_RESET: { emoji: "🔄", color: 0x64748b, label: "Reset" },
    OTHERS: { emoji: "💠", color: 0x94a3b8, label: "Autres" },
    // Categories for missions
    DONJON: { emoji: "⚔️", color: 0xef4444, label: "Donjon" },
    REGULATION: { emoji: "💀", color: 0x10b981, label: "Régulation" },
    ANOMALIE: { emoji: "⚡", color: 0xd946ef, label: "Anomalie" },
    SONGES: { emoji: "🌙", color: 0x22d3ee, label: "Songes" },
    EXPEDITION: { emoji: "⌛", color: 0xf59e0b, label: "Expédition" },
};

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

// ---------------------------------------------------------------------------
// ANTI-SPAM DES BOUTONS DU CALENDRIER (par membre ET par action)
// ---------------------------------------------------------------------------
// Constat beta du 18/09/2026 (events raid) : un clic « S'inscrire » suivi d'un clic
// « Se désinscrire » répondait « Patiente quelques secondes avant d'annuler ».
// La clé était `userId:eventId` : join et leave partageaient **la même** fenêtre, et
// elle était armée **avant** les gardes — un simple refus « Déjà inscrit » condamnait
// donc 10 s d'attente. Désormais : une clé par action, 5 s, armée uniquement quand
// l'inscription a réellement changé (un no-op ne consomme rien).
const INTERACTION_COOLDOWN_MS = 5 * 1000;
const interactionCooldowns = new Map<string, number>();

function cooldownKey(userId: string, eventId: string, action: CalendarInteractionAction) {
    return `${action}:${userId}:${eventId}`;
}

/** Millisecondes restantes avant de pouvoir rejouer la **même** action (0 = libre). */
function cooldownRemainingMs(userId: string, eventId: string, action: CalendarInteractionAction): number {
    const key = cooldownKey(userId, eventId, action);
    const last = interactionCooldowns.get(key) ?? 0;
    const remaining = INTERACTION_COOLDOWN_MS - (Date.now() - last);
    if (remaining <= 0) {
        interactionCooldowns.delete(key);
        return 0;
    }
    return remaining;
}

/** Arme la fenêtre après une action qui a bien modifié l'inscription. */
function armCooldown(userId: string, eventId: string, action: CalendarInteractionAction) {
    // Purge opportuniste : la map vit dans le process Next (jamais de fuite mémoire).
    if (interactionCooldowns.size > 512) interactionCooldowns.clear();
    interactionCooldowns.set(cooldownKey(userId, eventId, action), Date.now());
}

/** Places occupées : mêmes règles que l'embed (REGISTERED + CONFIRMED) + file d'attente. */
function countParticipants(rows: { status: string }[]) {
    return {
        registeredCount: rows.filter(p => p.status === "REGISTERED" || p.status === "CONFIRMED").length,
        reserveCount: rows.filter(p => p.status === "RESERVE").length,
    };
}

/** Un embed Discord existe-t-il pour cet événement ? (sinon rien à rafraîchir) */
function hasPublishedEmbed(event: { discordMessageId: string | null; discordChannelId: string | null }) {
    return Boolean(event.discordMessageId && event.discordChannelId);
}

// ---------------------------------------------------------------------------
// RÉSOLUTION DE L'ID DE MESSAGE (outbox `outbox:<jobId>` ≠ ID Discord)
// ---------------------------------------------------------------------------
// Constat beta du 19/09/2026 (raids du calendrier) : avec l'outbox active
// (`DISCORD_OUTBOX_ENABLED=true`), `publishDiscordEvent` recevait `outbox:<jobId>`
// de `sendChannelMessage` et le stockait tel quel dans
// `GuildEvent.discordMessageId`. Tous les `PATCH` d'embed partaient donc sur un
// message inexistant (404) : compteur et inscrits restaient FIGÉS à l'état de la
// publication pendant que les joueurs s'inscrivaient (et le cliqueur lisait
// « ⚠️ L'embed Discord n'a pas pu être rafraîchi »). Le worker d'écritures
// ré-ancre le VRAI snowflake dans Redis quand on lui passe `storeMessageIdKey`.

/** Clé Redis où le worker ré-ancre le vrai ID du message de l'événement. */
function eventMessageKey(eventId: string): string {
    return `calendar:msg:${eventId}`;
}

/** TTL du ré-ancre (30 j) : au-delà, l'événement est passé depuis longtemps. */
const EVENT_MESSAGE_KEY_TTL_SECONDS = 30 * 24 * 3600;

/**
 * Rend l'ID **exploitable** du message Discord d'un événement :
 *  - snowflake → tel quel ;
 *  - `outbox:<jobId>` → résolu depuis Redis (ré-ancre du worker), `null` tant que
 *    l'écriture n'est pas passée ;
 *  - toute autre valeur (nulle, vide, tronquée) → `null` : on n'écrit **jamais**
 *    dans le vide.
 */
async function resolveEventMessageId(
    stored: string | null | undefined,
    eventId: string
): Promise<string | null> {
    if (isDiscordSnowflake(stored)) return stored;
    if (!isOutboxMessageId(stored)) return null;

    try {
        const { redis } = await import("@/lib/redis");
        const resolved = await redis.get(eventMessageKey(eventId));
        return isDiscordSnowflake(resolved) ? resolved : null;
    } catch {
        // Redis injoignable : on ne PATCH pas un ID inconnu (jamais d'écriture au hasard).
        return null;
    }
}

/**
 * Tentatives de récupération déjà menées, par événement et par process : un
 * événement dont l'embed reste introuvable ne doit pas déclencher un appel
 * Discord à **chaque** clic (fail-soft, jamais de boucle d'API).
 */
const recoveryAttempted = new Set<string>();

/**
 * Récupération **best-effort** de l'embed d'un événement ancien dont l'ID stocké
 * n'est pas exploitable : `outbox:<jobId>` publié AVANT le correctif du
 * 19/09/2026 — le worker n'avait alors aucune clé Redis où ré-ancrer le vrai ID.
 *
 * On relit les derniers messages du salon et on retient celui qui porte les
 * boutons de CET événement (`calendar:join:<eventId>`). L'ID trouvé est
 * **réparé en base** (une écriture) : plus aucun coût ensuite. Une seule
 * tentative par événement et par process ; tout échec laisse l'embed en place
 * (l'opérateur peut toujours republier depuis le dashboard).
 */
async function recoverEventMessageId(
    guildConfigId: string,
    eventId: string,
    channelId: string
): Promise<string | null> {
    if (recoveryAttempted.has(eventId)) return null;
    if (recoveryAttempted.size > 512) recoveryAttempted.clear();
    recoveryAttempted.add(eventId);

    const { fetchChannelMessagesDiscord } = await import("@/server/discord");
    const messages = await fetchChannelMessagesDiscord(channelId, 100);

    // Messages rendus du plus ancien au plus récent : le DERNIER porteur du
    // bouton est l'embed de référence (une republication remplace la précédente).
    const marker = `calendar:join:${eventId}`;
    const found = [...messages]
        .reverse()
        .find((message) => messageHasCustomId(message?.components, marker));
    if (!found?.id || !isDiscordSnowflake(found.id)) return null;

    await db.guildEvent
        .update({
            where: { id: eventId, guildId: guildConfigId },
            data: { discordMessageId: found.id, discordChannelId: channelId },
        })
        .catch(() => null);

    logger.warn("[Calendar] ID de message Discord récupéré (ID outbox jamais ré-ancré) — lien réparé", {
        eventId,
        channelId,
    });
    return found.id;
}

/** Budget d'attente du PATCH d'embed : l'ACK d'une interaction doit partir < 3 s. */
const EMBED_SYNC_DEADLINE_MS = 1500;

/**
 * Rafraîchit l'embed **dans** la fenêtre d'interaction : le cliqueur reçoit un chiffre
 * exact, mais un Discord lent (429/5xx → `fetchWithRetry`) ne peut pas faire expirer
 * l'interaction (« L'application n'a pas répondu »). Au-delà du budget, le PATCH n'est
 * pas annulé : il se termine en tâche de fond et l'issue est journalisée.
 */
async function refreshEmbedWithinDeadline(guildId: string, eventId: string): Promise<CalendarEmbedSyncStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), EMBED_SYNC_DEADLINE_MS);
    });
    const outcome = await Promise.race([refreshDiscordEventEmbed(guildId, eventId), deadline]);
    if (timer) clearTimeout(timer);
    if (outcome === "timeout") {
        logger.warn("[Calendar] PATCH embed au-delà du budget d'interaction — poursuivi en tâche de fond", {
            guildId,
            eventId,
        });
        return "deferred";
    }
    return outcome;
}

export async function processRegistration(guildId: string, eventId: string, userId: string, data?: { classe?: string; comment?: string }): Promise<CalendarRegistrationOutcome> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, raidRequireKamaDonation: true, raidKamaDonationThreshold: true }
    });
    if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

    // Une seule requête : les places affichées par l'embed (REGISTERED + CONFIRMED)
    // **et** l'inscription éventuelle du cliqueur (pour un « déjà inscrit » utile).
    const event = await db.guildEvent.findUnique({
        where: { id: eventId, guildId: guildConfig.id },
        include: { participants: { select: { userId: true, status: true } } }
    });

    if (!event) return { success: false, error: "Événement introuvable" };
    if (event.status !== "PUBLISHED") return { success: false, error: "Inscriptions fermées" };

    // Places affichées par l'embed : REGISTERED + CONFIRMED (jamais les réserves).
    const counts = countParticipants(event.participants);
    const maxParticipants = event.maxParticipants || null;

    // Déjà inscrit = information, pas un refus : aucune écriture, aucun rafraîchissement
    // d'embed et aucune fenêtre d'anti-spam consommée (clic doublon ou embed périmé).
    const mine = event.participants.find(p => p.userId === userId);
    if (mine) {
        return {
            success: false,
            error: "Déjà inscrit",
            alreadyRegistered: true,
            isReserve: mine.status === "RESERVE",
            ...counts,
            maxParticipants,
        };
    }

    // RBAC: Raids require RAID_MEMBER permission to participate
    if (event.type === "RAID_OFFICIAL") {
        const discordUserId = await getDiscordId(userId);
        if (!discordUserId) {
            return { success: false, error: "Compte Discord non lié à SigilOS." };
        }
        const { internalCheckPermission } = await import("@/server/actions/user-actions");
        const { PERMISSIONS } = await import("@/lib/permissions");
        const hasPermission = await internalCheckPermission(guildId, discordUserId, PERMISSIONS.RAID_MEMBER, { module: "calendar" });
        if (!hasPermission) {
            return { success: false, error: "Permission requise: Participation aux Raids" };
        }

        // Role restriction check if event is "Guilde uniquement" and specifies allowedRoleIds
        const meta = event.metadata as any;
        if (!meta?.openToExternal && Array.isArray(meta?.allowedRoleIds) && meta.allowedRoleIds.length > 0) {
            const { fetchGuildMember } = await import("@/server/discord");
            const member = await fetchGuildMember(guildId, discordUserId);
            const userRoles: string[] = member?.roles || [];
            const hasRequiredRole = meta.allowedRoleIds.some((roleId: string) => userRoles.includes(roleId));
            
            if (!hasRequiredRole) {
                return { success: false, error: "Vous ne possédez pas l'un des rôles Discord requis pour vous inscrire à ce raid." };
            }
        }

        // Kamas gate: user must have at least 30 Purple Kamas in their balance (10 000 k = 10 Purple Kamas)
        // Only enforced when the admin toggle is ON (raidRequireKamaDonation = true, default)
        if (guildConfig.raidRequireKamaDonation) {
            const threshold = (guildConfig.raidKamaDonationThreshold ?? 3) * 10_000;
            const userProfile = await db.userProfile.findFirst({
                where: { userId, guildId: guildConfig.id },
                select: { id: true, purpleKamasConsumed: true },
            });
            if (!userProfile) {
                return { success: false, error: "Profil introuvable dans cette guilde." };
            }
            const allDonations = await db.kamaDonation.aggregate({
                _sum: { amount: true },
                where: {
                    profileId: userProfile.id,
                    status: "VALIDATED",
                },
            });
            const totalDonated = allDonations._sum.amount ?? 0;
            const purpleKamasEarned = Math.floor(totalDonated / 1000);
            const purpleKamasBalance = Math.max(0, purpleKamasEarned - (userProfile.purpleKamasConsumed || 0));
            const requiredPurpleKamas = Math.floor(threshold / 1000);

            if (purpleKamasBalance < requiredPurpleKamas) {
                return {
                    success: false,
                    error: `🪙 ${requiredPurpleKamas} Kamas Violets requis dans votre bourse pour vous inscrire aux raids (${threshold.toLocaleString("fr-FR")} k). Solde actuel : ${purpleKamasBalance} Kamas Violets (1 tranche de 10 000 k = 10 Kamas Violets).`,
                };
            }
        }
    }

    const remaining = cooldownRemainingMs(userId, eventId, "join");
    if (remaining > 0) {
        return {
            success: false,
            error: `Doucement ! Réessaie dans ${Math.ceil(remaining / 1000)} s.`,
            ...counts,
            maxParticipants,
        };
    }

    const isReserve = maxParticipants !== null && counts.registeredCount >= maxParticipants;

    await db.eventParticipant.create({
        data: {
            eventId,
            userId: userId,
            status: isReserve ? "RESERVE" : "REGISTERED",
            // Position unique : elle est recomputée à chaque désinscription.
            position: event.participants.length + 1,
            // Borne dure (RULES §4) : la classe part dans l'embed Discord, une valeur
            // libre trop longue ferait échouer le field (1000 car. max).
            classe: data?.classe?.trim().slice(0, 30) || undefined,
            comment: data?.comment
        }
    });
    armCooldown(userId, eventId, "join");

    // Le compteur annoncé au cliqueur doit être celui de l'embed : on PATCH **avant**
    // de répondre (borné à `EMBED_SYNC_DEADLINE_MS`). Avant, ce PATCH était lancé en
    // tâche de fond et perdu : l'embed gardait un chiffre faux, sans trace.
    const embedStatus = hasPublishedEmbed(event)
        ? await refreshEmbedWithinDeadline(guildId, eventId)
        : undefined;

    revalidatePath(`/dashboard/${guildId}/calendar`);
    revalidatePath(`/dashboard/${guildId}`, "layout");
    return {
        success: true,
        isReserve,
        reserveMessage: isReserve ? "Tes Kamas Violets ne seront pas déduits si tu ne participes pas au raid." : undefined,
        registeredCount: counts.registeredCount + (isReserve ? 0 : 1),
        reserveCount: counts.reserveCount + (isReserve ? 1 : 0),
        maxParticipants,
        // Confirmée au cliqueur : la classe retenue (vide = « Sans classe »).
        classe: data?.classe?.trim() || undefined,
        embedStatus,
    };
}

export async function processUnregistration(guildId: string, eventId: string, userId: string): Promise<CalendarRegistrationOutcome> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });
    if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

    const participant = await db.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId } },
        include: { event: true }
    });

    // Aucune inscription à annuler (embed périmé, désinscription déjà faite) :
    // la route le traduit en information, pas en erreur.
    if (!participant) return { success: false, error: "Non inscrit", notRegistered: true };

    // SECURITY: Block captain/creator from unregistering from a RAID — must transfer lead first
    if (participant.event.type === "RAID_OFFICIAL" && participant.event.creatorId === userId) {
        return { success: false, error: "Vous êtes le capitaine du raid. Transférez d'abord le capitanat à un autre participant avant de vous désinscrire." };
    }

    const remaining = cooldownRemainingMs(userId, eventId, "leave");
    if (remaining > 0) {
        return { success: false, error: `Doucement ! Réessaie dans ${Math.ceil(remaining / 1000)} s.` };
    }

    const wasRegistered = participant.status === "REGISTERED";

    await db.eventParticipant.delete({
        where: { id: participant.id }
    });
    // La fenêtre ne s'arme qu'ici : un « Non inscrit » ne doit jamais bloquer l'action suivante.
    armCooldown(userId, eventId, "leave");

    let promotedReserve = false;
    if (wasRegistered) {
        const firstReserve = await db.eventParticipant.findFirst({
            where: { eventId, status: "RESERVE" },
            orderBy: { position: "asc" }
        });

        if (firstReserve) {
            await db.eventParticipant.update({
                where: { id: firstReserve.id },
                data: {
                    status: "REGISTERED",
                    promotedAt: new Date()
                }
            });
            promotedReserve = true;
        }
    }

    const participants = await db.eventParticipant.findMany({
        where: { eventId },
        orderBy: { position: "asc" }
    });

    for (let i = 0; i < participants.length; i++) {
        await db.eventParticipant.update({
            where: { id: participants[i].id },
            data: { position: i + 1 }
        });
    }

    // Compteurs relevés **après** promotion + réindexation : le chiffre annoncé au
    // cliqueur est celui de l'embed (recomputé juste après, dans la même fenêtre).
    const counts = countParticipants(participants);
    const embedStatus = hasPublishedEmbed(participant.event)
        ? await refreshEmbedWithinDeadline(guildId, eventId)
        : undefined;

    revalidatePath(`/dashboard/${guildId}/calendar`);
    revalidatePath(`/dashboard/${guildId}`, "layout");
    return {
        success: true,
        promoted: promotedReserve,
        registeredCount: counts.registeredCount,
        reserveCount: counts.reserveCount,
        maxParticipants: participant.event.maxParticipants || null,
        embedStatus,
    };
}

/**
 * Met à jour la classe d'une inscription EXISTANTE (menu select Discord).
 * Retourne `{ updated: false }` si le membre n'est pas inscrit : l'appelant
 * bascule alors sur `processRegistration` (avec la classe choisie).
 * Un simple changement de classe ne consomme pas la fenêtre d'anti-spam.
 */
export async function updateRegistrationClass(
    guildId: string,
    eventId: string,
    userId: string,
    classe: string
): Promise<{ success: boolean; error?: string; updated?: boolean }> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

    const event = await db.guildEvent.findUnique({
        where: { id: eventId, guildId: guildConfig.id },
        select: { id: true, status: true, discordMessageId: true, discordChannelId: true },
    });
    if (!event) return { success: false, error: "Événement introuvable" };
    if (event.status !== "PUBLISHED") return { success: false, error: "Inscriptions fermées" };

    const mine = await db.eventParticipant.findFirst({
        where: { eventId, userId },
    });
    if (!mine) return { success: true, updated: false };

    await db.eventParticipant.update({
        where: { id: mine.id },
        data: { classe: classe.trim().slice(0, 30) },
    });

    if (event.discordMessageId && event.discordChannelId) {
        await refreshEmbedWithinDeadline(guildId, eventId);
    }
    revalidatePath(`/dashboard/${guildId}/calendar`);
    return { success: true, updated: true };
}

export async function publishDiscordEvent(guildId: string, eventId: string) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { 
                id: true, 
                calendarNotifyChannelId: true, 
                raidNotifyChannelId: true,
                raidGigalodonNotifyChannelId: true,
                raidSanctuaireNotifyChannelId: true
            }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde introuvable" };
        }

        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                profiles: {
                                    where: { guildId: guildConfig.id },
                                    select: { discordNickname: true }
                                }
                            }
                        }
                    },
                    orderBy: { position: "asc" }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        const isRaid = event.type === "RAID_OFFICIAL";
        const meta = event.metadata as any;

        let targetChannelId = guildConfig.calendarNotifyChannelId;
        if (isRaid) {
            if (meta?.raidType === "gigalodon") {
                targetChannelId = guildConfig.raidGigalodonNotifyChannelId || guildConfig.raidNotifyChannelId;
            } else if (meta?.raidType === "jardin") {
                targetChannelId = guildConfig.raidSanctuaireNotifyChannelId || guildConfig.raidNotifyChannelId;
            } else {
                targetChannelId = guildConfig.raidNotifyChannelId;
            }
        }

        if (!targetChannelId) {
            return {
                success: false,
                error: isRaid
                    ? "Canal Discord raid non configuré. Allez dans Admin > Raids."
                    : "Canal Discord non configuré. Allez dans Admin > Calendrier."
            };
        }

        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        // Visuel du raid selon `metadata.raidType` (Gigalodon / Jardins Éternels).
        const imageName = resolveEventImageFile(event.type, event.metadata);
        const publicUrl = getAppBaseUrl();
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        // Fetch Mentions from metadata
        const mentionRoleIds: string[] = meta?.mentionRoleIds || [];
        const roleMentions = mentionRoleIds.length > 0 
            ? mentionRoleIds.map(id => `<@&${id}>`).join(" ") 
            : "";
            
        const creatorDiscordId = await getDiscordId(event.creatorId);
        const creatorMention = creatorDiscordId ? `<@${creatorDiscordId}>` : "";
        const mentionContent = [creatorMention, roleMentions].filter(Boolean).join(" ");

        // Fetch Missions if any
        const missionIds = meta?.missionIds || [];
        let missions: any[] = [];
        let missionThumbnail: string | undefined = undefined;

        if (missionIds.length > 0) {
            missions = await db.mission.findMany({
                where: { id: { in: missionIds } },
                select: { title: true, category: true, payload: true }
            });

            if (missions.length > 0) {
                const first = missions[0];
                const p = first.payload as any;
                if (first.category === 'SONGES') {
                    const diff: string = (p.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                    const lvl = levelMap[p.level as string] || 1;
                    missionThumbnail = `${publicUrl}/assets/missions/${diff}${lvl}.png`;
                } else {
                    missionThumbnail = p.imageUrl || p.image;
                }
            }
        }

        const startTs = Math.floor(new Date(event.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(event.endDate).getTime() / 1000);

        const raidMeta = isRaid ? (event.metadata as any) : null;

        const registered = event.participants.filter(p => p.status === "REGISTERED" || p.status === "CONFIRMED");
        const reserve = event.participants.filter(p => p.status === "RESERVE");

        const formatParticipant = (p: any) => {
            const name = p.user.profiles[0]?.discordNickname || p.user.name || "Inconnu";
            const classe = p.classe ? `(${p.classe})` : "";
            return `• ${name} ${classe}`;
        };

        // Dispatch par classe : UN field inline PAR classe représentée (grille 3 colonnes).
        const dispatchEntries: DispatchEntry[] = registered.map((p: any) => {
            const name = p.user.profiles[0]?.discordNickname || p.user.name || "Inconnu";
            return { line: `• ${name}`, classe: p.classe ?? null };
        });
        const inscritsFields = buildClassDispatchFields(dispatchEntries, {
            emptyField: { name: `✅ Inscrits (${registered.length})`, value: "*Aucun inscrit*" },
            maxGroups: 14,
        });

        const reserveList = reserve.length > 0
            ? reserve.map(formatParticipant).join("\n")
            : "*Personne en file d'attente*";

        const reserveNote = reserve.length > 0 && isRaid
            ? "\n💡 *Tes Kamas Violets ne seront pas déduits si tu ne participes pas au raid.*"
            : "";

        const fields = [
            { name: "📅 Date", value: `<t:${startTs}:d> (<t:${startTs}:D>)`, inline: true },
            { name: "⏰ Horaire", value: `<t:${startTs}:t> - <t:${endTs}:t> (<t:${startTs}:R>)`, inline: true },
            { name: "👥 Places", value: `${registered.length}/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
        ];

        if (isRaid && raidMeta) {
            if (raidMeta.raidLabel) fields.push({ name: "⚔️ Type de Raid", value: `**${raidMeta.raidLabel}**`, inline: true });
            // Use Discord mention for captain if we can resolve the Discord ID
            const captainDiscordId = await getDiscordId(event.creatorId).catch(() => null);
            const captainDisplay = captainDiscordId 
                ? `<@${captainDiscordId}>` 
                : (raidMeta.raidCaptain || `**Le capitaine**`);
            fields.push({ name: "👑 Capitaine", value: captainDisplay, inline: true });
            fields.push({ 
                name: "🌐 Visibilité", 
                value: raidMeta.openToExternal ? "🟢 Ouvert aux extérieurs" : "🔒 Guilde uniquement", 
                inline: true 
            });
        }

        fields.push({ name: "📝 Description", value: event.description || "*Pas de description*", inline: false });

        if (missions.length > 0) {
            const missionText = missions.map(m => {
                const catConfig = EVENT_CONFIG[m.category] || { emoji: "🎯" };
                const title = m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif";
                return `${catConfig.emoji} **${title}**`;
            }).join("\n");
            fields.push({ name: "🎯 Objectifs de la session", value: missionText, inline: false });
        }

        fields.push(
            ...inscritsFields,
            { name: `⏳ File d'attente (${reserve.length})`, value: reserveList + reserveNote, inline: true },
        );

        const components = [
            {
                type: 1,
                components: [
                    { type: 2, style: 1, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                    { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                ]
            },
            // Menu classe en PLUS des boutons : choisir une classe = s'inscrire avec
            // cette classe (ou mettre à jour la sienne si déjà inscrit).
            buildClassSelectRow(`calendar:class:${event.id}`, "Choisir ma classe pour cet événement…"),
        ];

        const messageOptions = {
            embedTitle: `${typeConfig.emoji} ${event.title}`,
            embedColor: typeConfig.color,
            embedImage: imageUrl,
            embedThumbnail: missionThumbnail,
            fields: fields,
            embedFooter: "Statut: 🟢 Ouvert",
            components: components
        };

        let channel = null;
        try {
            channel = await fetchChannel(targetChannelId);
        } catch (err) {
            console.error("[Calendar Service] fetchChannel failed, falling back to text channel:", err);
        }
        let messageId: string | null = null;
        let finalChannelId = targetChannelId;

        if (channel && channel.type === 15) {
            const res = await createForumPost(
                targetChannelId,
                `${typeConfig.emoji} ${event.title}`,
                "",
                messageOptions
            );
            if (res) {
                messageId = res.messageId;
                finalChannelId = res.id;
            }
        } else {
            messageId = await sendChannelMessage(
                targetChannelId,
                mentionContent,
                {
                    ...messageOptions,
                    // Mode outbox : on demande au worker de ré-ancrer le VRAI ID du
                    // message dans Redis. Sans cette clé, la base ne garderait que
                    // `outbox:<jobId>` et TOUS les PATCH d'embed échoueraient (panne
                    // beta du 19/09/2026 : compteur + inscrits figés).
                    storeMessageIdKey: eventMessageKey(eventId),
                    storeMessageIdTTL: EVENT_MESSAGE_KEY_TTL_SECONDS,
                }
            );
        }

        if (messageId) {
            if (!isDiscordSnowflake(messageId)) {
                // Écriture encore EN FILE : l'ID réel est ré-ancre par le worker, puis
                // résolu par `resolveEventMessageId` à chaque rafraîchissement.
                logger.warn("[Calendar] Publication via l'outbox — ID de message différé", {
                    eventId,
                    idKind: discordIdKind(messageId),
                });
            }
            await db.guildEvent.update({
                where: { id: eventId },
                data: {
                    discordMessageId: messageId,
                    discordChannelId: finalChannelId,
                    status: "PUBLISHED"
                }
            });
            return { success: true };
        } else {
            return { success: false, error: "Erreur lors de l'envoi Discord" };
        }

    } catch (error) {
        console.error("[Calendar Service] publishDiscordEvent Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Reconstruit et PATCH l'embed Discord d'un événement, en **rendant l'issue**
 * (`synced` / `skipped` / `failed`) : c'est ce qui permet au parcours d'inscription
 * d'annoncer un chiffre exact, et de dire au cliqueur quand l'embed n'a pas suivi
 * (avant, l'échec partait dans un `console.error` que personne ne lisait).
 *
 * Ne **throw jamais** : les appelants historiques (actions du dashboard) s'appuient
 * sur `.catch()`. Pour un contrat `void`, utiliser `updateDiscordEventEmbed`.
 */
export async function refreshDiscordEventEmbed(guildId: string, eventId: string): Promise<CalendarEmbedSyncStatus> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                calendarNotifyChannelId: true,
                raidNotifyChannelId: true,
                raidGigalodonNotifyChannelId: true,
                raidSanctuaireNotifyChannelId: true
            }
        });
        if (!guildConfig) return "skipped";

        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                profiles: {
                                    where: { guildId: guildConfig.id },
                                    select: { discordNickname: true }
                                }
                            }
                        }
                    },
                    orderBy: { position: "asc" }
                }
            }
        });

        if (!event || !event.discordMessageId || !event.discordChannelId) return "skipped";

        // ID **réel** du message : un `outbox:<jobId>` (écriture en file) doit être
        // résolu avant tout PATCH — sinon on écrit sur un message inexistant (404) et
        // l'embed reste figé à l'état de la publication (panne beta du 19/09/2026).
        let messageId = await resolveEventMessageId(event.discordMessageId, event.id);
        if (!messageId && isOutboxMessageId(event.discordMessageId)) {
            // Dernier recours (événements publiés AVANT le correctif : leur ID outbox
            // n'a jamais été ré-ancre) : on retrouve le message par ses boutons.
            messageId = await recoverEventMessageId(guildConfig.id, event.id, event.discordChannelId);
        }
        if (!messageId) {
            logger.warn("[Calendar] ID du message Discord non exploitable — embed non rafraîchi", {
                guildId,
                eventId,
                storedIdKind: discordIdKind(event.discordMessageId),
            });
            return "skipped";
        }

        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        // Même résolution que la publication : un PATCH ne doit jamais changer le visuel.
        const imageName = resolveEventImageFile(event.type, event.metadata);
        const publicUrl = getAppBaseUrl();
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        // Fetch Missions
        const meta = event.metadata as any;
        const missionIds = meta?.missionIds || [];
        let missions: any[] = [];
        let missionThumbnail: string | undefined = undefined;

        if (missionIds.length > 0) {
            missions = await db.mission.findMany({
                where: { id: { in: missionIds } },
                select: { title: true, category: true, payload: true }
            });

            if (missions.length > 0) {
                const first = missions[0];
                const p = first.payload as any;
                if (first.category === 'SONGES') {
                    const diff: string = (p.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                    const lvl = levelMap[p.level as string] || 1;
                    missionThumbnail = `${publicUrl}/assets/missions/${diff}${lvl}.png`;
                } else {
                    missionThumbnail = p.imageUrl || p.image;
                }
            }
        }

        const registered = event.participants.filter(p => p.status === "REGISTERED" || p.status === "CONFIRMED");
        const reserve = event.participants.filter(p => p.status === "RESERVE");

        const formatParticipant = (p: any) => {
            const name = p.user.profiles[0]?.discordNickname || p.user.name || "Inconnu";
            const classe = p.classe ? `(${p.classe})` : "";
            return `• ${name} ${classe}`;
        };

        // Dispatch par classe : UN field inline PAR classe représentée (grille 3 colonnes).
        const dispatchEntries: DispatchEntry[] = registered.map((p: any) => {
            const name = p.user.profiles[0]?.discordNickname || p.user.name || "Inconnu";
            return { line: `• ${name}`, classe: p.classe ?? null };
        });
        const inscritsFields = buildClassDispatchFields(dispatchEntries, {
            emptyField: { name: `✅ Inscrits (${registered.length})`, value: "*Aucun inscrit*" },
            maxGroups: 14,
        });

        const reserveList = reserve.length > 0
            ? reserve.map(formatParticipant).join("\n")
            : "*Personne en file d'attente*";

        const startTs = Math.floor(new Date(event.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(event.endDate).getTime() / 1000);

        const isRaid = event.type === "RAID_OFFICIAL";
        const raidMeta = isRaid ? (event.metadata as any) : null;

        const reserveNote = reserve.length > 0 && isRaid
            ? "\n💡 *Tes Kamas Violets ne seront pas déduits si tu ne participes pas au raid.*"
            : "";

        const fields = [
            { name: "📅 Date", value: `<t:${startTs}:d> (<t:${startTs}:D>)`, inline: true },
            { name: "⏰ Horaire", value: `<t:${startTs}:t> - <t:${endTs}:t> (<t:${startTs}:R>)`, inline: true },
            { name: "👥 Places", value: `${registered.length}/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
        ];

        if (isRaid && raidMeta) {
            if (raidMeta.raidLabel) fields.push({ name: "⚔️ Type de Raid", value: `**${raidMeta.raidLabel}**`, inline: true });
            // Use Discord mention for captain if we can resolve the Discord ID
            const captainDiscordId = await getDiscordId(event.creatorId).catch(() => null);
            const captainDisplay = captainDiscordId 
                ? `<@${captainDiscordId}>` 
                : (raidMeta.raidCaptain || `**Le capitaine**`);
            fields.push({ name: "👑 Capitaine", value: captainDisplay, inline: true });
            fields.push({ 
                name: "🌐 Visibilité", 
                value: raidMeta.openToExternal ? "🟢 Ouvert aux extérieurs" : "🔒 Guilde uniquement", 
                inline: true 
            });
        }

        fields.push({ name: "📝 Description", value: event.description || "*Pas de description*", inline: false });

        if (missions.length > 0) {
            const missionText = missions.map(m => {
                const catConfig = EVENT_CONFIG[m.category] || { emoji: "🎯" };
                const title = m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif";
                return `${catConfig.emoji} **${title}**`;
            }).join("\n");
            fields.push({ name: "🎯 Objectifs de la session", value: missionText, inline: false });
        }

        fields.push(
            ...inscritsFields,
            { name: `⏳ File d'attente (${reserve.length})`, value: reserveList + reserveNote, inline: true },
        );

        const components = [
            {
                type: 1,
                components: [
                    { type: 2, style: 1, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                    { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                ]
            },
            // Menu classe en PLUS des boutons : choisir une classe = s'inscrire avec
            // cette classe (ou mettre à jour la sienne si déjà inscrit).
            buildClassSelectRow(`calendar:class:${event.id}`, "Choisir ma classe pour cet événement…"),
        ];

        const synced = await updateChannelMessage(
            event.discordChannelId,
            messageId,
            "",
            {
                embedTitle: `${typeConfig.emoji} ${event.title}`,
                embedColor: typeConfig.color,
                embedImage: imageUrl,
                embedThumbnail: missionThumbnail,
                fields: fields,
                embedFooter: `Statut: ${event.status === "PUBLISHED" ? "🟢 Ouvert" : "🔴 Fermé"}`,
                components: components
            }
        );

        return synced ? "synced" : "failed";
    } catch (error) {
        logger.error("[Calendar Service] refreshDiscordEventEmbed Error:", { error, guildId, eventId });
        return "failed";
    }
}

/**
 * Rafraîchit l'embed d'un événement — **contrat `void`** conservé pour les appelants
 * historiques (`src/server/actions/calendar-actions.ts`) qui enchaînent `.catch()`.
 * Préférer `refreshDiscordEventEmbed` quand l'issue compte (inscription Discord).
 */
export async function updateDiscordEventEmbed(guildId: string, eventId: string): Promise<void> {
    await refreshDiscordEventEmbed(guildId, eventId);
}

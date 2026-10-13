/**
 * Sondages **programmés** — moteur de publication (cron).
 *
 * Ce fichier n'a **pas** `"use server"`, délibérément : c'est un core serveur,
 * appelable par la route cron et par l'action « publier maintenant », jamais par
 * le client (même doctrine que `src/server/platform-module-state.ts`).
 *
 * **Revendication atomique.** Un créneau n'est publié qu'une fois : le passage
 * `SCHEDULED → PUBLISHING` se fait par un `updateMany` **avec garde d'état dans
 * le `WHERE`**. Deux exécutions simultanées du cron (ou un clic « Publier
 * maintenant » en même temps que le cron) ne peuvent pas publier deux fois :
 * la seconde voit `count === 0` et s'arrête. C'est ce qui rend le déclencheur
 * **sans état** et donc rejouable, rattrapable après un redémarrage, et
 * compatible avec plusieurs instances applicatives.
 *
 * **Fail-closed.** Trois refus explicites, jamais une publication à moitié :
 * 1. module coupé (verrou plateforme ou de guilde) ⇒ le créneau reste `SCHEDULED`
 *    (il partira à la réactivation) avec la raison dans `lastError` ;
 * 2. salon absent ou étranger à la guilde ⇒ `FAILED` (aucun embed trompeur) ;
 * 3. créateur supprimé ou erreur de transaction ⇒ `FAILED` + `lastError`.
 *
 * Le sondage créé est un **sondage normal** (`Poll`, `isScheduled = true`) :
 * mêmes options, mêmes boutons `poll:vote:`, même fiche dashboard (votants /
 * non-votants) — aucune duplication de système de vote.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { godLocksOf, resolveModuleState } from "@/lib/module-lock";
import { getPlatformModuleState } from "@/server/platform-module-state";
import { publishPollToDiscord } from "@/server/polls/publish";
import { resolveDurationHours } from "@/lib/polls/scheduling";
import { nextOccurrence, type ScheduledRepeatUnit } from "@/lib/polls/scheduling";

const LAST_ERROR_MAX_LENGTH = 300;

export interface PublishDueResult {
    /** Créneaux échus traités (revendiqués par cette exécution). */
    claimed: number;
    published: number;
    /** Créneaux non publiés parce que le module est coupé (conservés en attente). */
    blocked: number;
    failed: number;
    /** Détails lisibles (journal + télémétrie God). */
    details: string[];
}

function boundedError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, LAST_ERROR_MAX_LENGTH);
}

/** Repasse un créneau revendiqué en attente (module coupé) — publié plus tard. */
async function releaseClaim(slotId: string, reason: string): Promise<void> {
    await db.scheduledPoll.updateMany({
        where: { id: slotId, status: "PUBLISHING" },
        data: { status: "SCHEDULED", claimedAt: null, lastError: reason.slice(0, LAST_ERROR_MAX_LENGTH) },
    });
}

async function failClaim(slotId: string, reason: string): Promise<void> {
    await db.scheduledPoll.updateMany({
        where: { id: slotId, status: "PUBLISHING" },
        data: { status: "FAILED", lastError: reason.slice(0, LAST_ERROR_MAX_LENGTH) },
    });
}

/** Rôles de ping encore autorisés : re-filtrés **au moment de publier**. */
function filterAllowedRoles(roleCsv: string | null, allowed: string[]): string | undefined {
    if (!roleCsv) return undefined;
    const allowedSet = new Set(allowed);
    const kept = roleCsv.split(",").map((id) => id.trim()).filter((id) => id && allowedSet.has(id));
    return kept.length > 0 ? kept.join(",") : undefined;
}

/**
 * Publie UN créneau déjà revendiqué (`status = PUBLISHING`).
 * Toute sortie laisse le créneau dans un état terminal cohérent.
 */
async function publishClaimedSlot(slotId: string, now: Date): Promise<"published" | "blocked" | "failed"> {
    const slot = await db.scheduledPoll.findUnique({
        where: { id: slotId },
        include: {
            options: { orderBy: { order: "asc" } },
            guild: {
                select: {
                    id: true,
                    discordGuildId: true,
                    scheduledPollsChannelId: true,
                    scheduledPollsDurationH: true,
                    scheduledPollsPingRoleIds: true,
                    modules: { select: { disabledByGod: true } },
                },
            },
        },
    });
    if (!slot) return "failed";

    const discordGuildId = slot.guild.discordGuildId;

    // ① Verrou God (plateforme > guilde) : même règle pure que tout le reste de
    // l'application, donc le verrou appliqué est exactement le verrou affiché.
    const platform = await getPlatformModuleState();
    const state = resolveModuleState("scheduledPolls", { scheduledPolls: true }, {
        guildLocks: godLocksOf(slot.guild.modules),
        platformLocks: platform.locks,
        platformNotices: platform.notices,
    });
    if (!state.enabled) {
        const reason = state.lockedBy === "platform"
            ? `Module indisponible (maintenance plateforme)${state.notice ? ` : ${state.notice}` : ""}`
            : "Module désactivé (verrou de guilde)";
        await releaseClaim(slotId, reason);
        logger.warn("[ScheduledPolls] Créneau non publié — module coupé", { slotId, guildId: discordGuildId, lockedBy: state.lockedBy });
        return "blocked";
    }

    // ② Salon : jamais un embed dans un salon absent ou étranger à la guilde.
    const channelId = slot.discordChannelId || slot.guild.scheduledPollsChannelId;
    if (!channelId) {
        await failClaim(slotId, "Aucun salon Discord configuré (paramètres → Sondages programmés).");
        return "failed";
    }
    const { validateChannelBelongsToGuild } = await import("@/server/discord");
    if (!(await validateChannelBelongsToGuild(channelId, discordGuildId))) {
        await failClaim(slotId, "Salon introuvable ou n'appartenant pas à ce serveur Discord.");
        return "failed";
    }

    // ③ Créateur : la FK exige un profil vivant (jamais un sondage orphelin).
    const creator = await db.userProfile.findUnique({ where: { id: slot.createdById }, select: { id: true } });
    if (!creator) {
        await failClaim(slotId, "Créateur du créneau introuvable (profil supprimé).");
        return "failed";
    }

    const durationHours = resolveDurationHours(slot.durationHours, slot.guild.scheduledPollsDurationH);
    const expiresAt = durationHours ? new Date(now.getTime() + durationHours * 60 * 60 * 1000) : null;
    const mentionRoleId = filterAllowedRoles(slot.mentionRoleId, slot.guild.scheduledPollsPingRoleIds || []);

    let pollId: string;
    try {
        const poll = await db.$transaction(async (tx) => {
            const created = await tx.poll.create({
                data: {
                    guildId: slot.guild.id,
                    title: slot.title,
                    description: slot.description,
                    category: slot.category,
                    status: "ACTIVE",
                    creatorId: creator.id,
                    creatorName: slot.creatorName,
                    allowMultipleVotes: slot.allowMultipleVotes,
                    isAnonymous: slot.isAnonymous,
                    expiresAt,
                    mentionEveryone: false,
                    mentionRoleId: mentionRoleId ?? null,
                    externalUrl: slot.externalUrl,
                    isScheduled: true,
                },
            });

            await tx.pollOption.createMany({
                data: slot.options.map((opt, index) => ({
                    pollId: created.id,
                    label: opt.label,
                    emoji: opt.emoji,
                    order: index,
                })),
            });

            return created;
        });
        pollId = poll.id;
    } catch (error) {
        logger.error("[ScheduledPolls] Création du sondage impossible", { slotId, error });
        await failClaim(slotId, `Création du sondage impossible : ${boundedError(error)}`);
        return "failed";
    }

    // ④ Publication de l'embed (même fabrique que le module Sondages).
    await publishPollToDiscord(discordGuildId, pollId, channelId, false, mentionRoleId);

    // ⑤ Répétition : on repose l'occurrence suivante AVANT de marquer le créneau
    // publié, pour qu'un plantage entre les deux laisse un créneau `PUBLISHING`
    // (reprenable) plutôt qu'une série silencieusement arrêtée.
    let nextScheduledAt: Date | null = null;
    if (slot.repeatEvery && slot.repeatUnit) {
        const candidate = nextOccurrence(now, slot.repeatEvery, slot.repeatUnit as ScheduledRepeatUnit);
        const until = slot.repeatUntil;
        if (!until || candidate.getTime() <= until.getTime()) {
            nextScheduledAt = candidate;
        }
    }

    if (nextScheduledAt) {
        try {
            await db.scheduledPoll.create({
                data: {
                    guildId: slot.guild.id,
                    createdById: slot.createdById,
                    creatorName: slot.creatorName,
                    title: slot.title,
                    description: slot.description,
                    category: slot.category,
                    allowMultipleVotes: slot.allowMultipleVotes,
                    isAnonymous: slot.isAnonymous,
                    externalUrl: slot.externalUrl,
                    scheduledAt: nextScheduledAt,
                    durationHours: slot.durationHours,
                    repeatEvery: slot.repeatEvery,
                    repeatUnit: slot.repeatUnit,
                    repeatUntil: slot.repeatUntil,
                    discordChannelId: slot.discordChannelId,
                    mentionEveryone: slot.mentionEveryone,
                    mentionRoleId: slot.mentionRoleId,
                    options: {
                        create: slot.options.map((opt) => ({ label: opt.label, emoji: opt.emoji, order: opt.order })),
                    },
                },
            });
            logger.info("[ScheduledPolls] Occurrence suivante programmée", { slotId, nextScheduledAt, guildId: discordGuildId });
        } catch (error) {
            // Série interrompue : la contrainte (guildId, scheduledAt) protège d'un
            // doublon ; on le dit, on ne publie jamais deux fois le même créneau.
            logger.error("[ScheduledPolls] Occurrence suivante NON programmée (fin de série)", {
                slotId,
                nextScheduledAt,
                error: boundedError(error),
            });
        }
    }

    await db.scheduledPoll.updateMany({
        where: { id: slotId, status: "PUBLISHING" },
        data: {
            status: "PUBLISHED",
            publishedAt: now,
            createdPollId: pollId,
            discordChannelId: channelId,
            mentionRoleId: mentionRoleId ?? null,
            lastError: null,
        },
    });

    logger.info("[ScheduledPolls] Créneau publié", { slotId, pollId, guildId: discordGuildId });
    return "published";
}

/**
 * Publie tous les créneaux échus (`scheduledAt <= now`).
 * Idempotent et rattrapable : une minute manquée est reprise à la suivante.
 */
export async function publishDueScheduledPolls(now: Date = new Date()): Promise<PublishDueResult> {
    const due = await db.scheduledPoll.findMany({
        where: { status: "SCHEDULED", scheduledAt: { lte: now } },
        select: { id: true },
        orderBy: { scheduledAt: "asc" },
        take: 200,
    });

    const result: PublishDueResult = { claimed: 0, published: 0, blocked: 0, failed: 0, details: [] };
    if (due.length === 0) return result;

    for (const { id } of due) {
        // Revendication atomique : la garde d'état est DANS le WHERE.
        const claim = await db.scheduledPoll.updateMany({
            where: { id, status: "SCHEDULED", scheduledAt: { lte: now } },
            data: { status: "PUBLISHING", claimedAt: now },
        });
        if (claim.count === 0) continue; // déjà prise par une autre exécution
        result.claimed++;

        const outcome = await publishClaimedSlot(id, now);
        if (outcome === "published") {
            result.published++;
            result.details.push(`${id} → publié`);
        } else if (outcome === "blocked") {
            result.blocked++;
            result.details.push(`${id} → bloqué (module coupé)`);
        } else {
            result.failed++;
            result.details.push(`${id} → échec`);
        }
    }

    return result;
}

/**
 * « Publier maintenant » : revendique le créneau puis publie immédiatement.
 * Renvoie un refus explicite si le créneau a déjà été pris (le cron est passé
 * avant, ou un autre staff a cliqué en même temps).
 */
export async function publishScheduledSlotNow(slotId: string, now: Date = new Date()): Promise<{ success: boolean; error?: string }> {
    const claim = await db.scheduledPoll.updateMany({
        where: { id: slotId, status: "SCHEDULED" },
        data: { status: "PUBLISHING", claimedAt: now },
    });
    if (claim.count === 0) {
        return { success: false, error: "Ce créneau a déjà été publié, annulé ou est en cours de traitement." };
    }

    const outcome = await publishClaimedSlot(slotId, now);
    if (outcome === "published") return { success: true };
    if (outcome === "blocked") {
        return { success: false, error: "Le module est indisponible (maintenance) : le créneau reste en attente." };
    }
    const slot = await db.scheduledPoll.findUnique({ where: { id: slotId }, select: { lastError: true } });
    return { success: false, error: slot?.lastError || "Publication impossible." };
}

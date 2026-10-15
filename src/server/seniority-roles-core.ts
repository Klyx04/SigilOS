/**
 * Chantier Y — cœur du cron « Rôles automatiques par ancienneté » (lot Y-2).
 *
 * Une passe = une **réconciliation d'état**, guilde par guilde :
 * 1. ne sont lues que les guildes **actives** dont le module est **activé** et dont les
 *    paliers ne sont pas vides (fail-closed : rien d'autre n'est même chargé) ;
 * 2. le **marqueur d'activation** de la guilde est estampé à sa première passe — c'est lui
 *    qui sépare un **franchissement à venir** (à fêter) d'un **rattrapage** (marqué sans
 *    être posté, décision user du 14/10/2026) ;
 * 3. pour chaque **membre connu** (profil `ACTIVE`), l'ancienneté est calculée, les rôles
 *    réellement portés sur Discord sont lus, et le **diff pur** est appliqué
 *    (`computeSeniorityRoleDiff`) : rôles dus posés, paliers perdus retirés ;
 * 4. chaque palier franchi **depuis l'activation** est fêté **une seule fois**
 *    (`SeniorityRoleAnnouncement`, unicité `(guildId, discordId, tierDays)`).
 *
 * Ce que ce core ne fait jamais : écrire un rôle que la config ne déclare pas, annoncer un
 * palier dont les rôles n'ont pas pu être posés, ni s'acharner autrement qu'au passage
 * suivant (échec Discord = on logue, on ne fête rien, on retentera).
 *
 * Pas de directive `"use server"` : la route cron l'appelle directement.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isDiscordSnowflake } from "@/lib/discord-ids";
import { buildDiscordAvatarUrl, getDefaultDiscordAvatar } from "@/lib/discord-avatars";
import { computeSeniorityDays, resolveJoinedAt } from "@/lib/member-registry";
import {
    buildSeniorityAnnouncementValues,
    computeSeniorityRoleDiff,
    mergeSeniorityRolesConfig,
    renderSeniorityAnnouncement,
    resolveTierAnnouncement,
    shouldCelebrateSeniorityTier,
    type GuildSeniorityRolesConfig,
    type SeniorityAnnouncementConfig,
    type SeniorityTier,
} from "@/lib/seniority-roles";
import { addRoleToMember, fetchGuildMember, removeRoleFromMember, sendChannelMessage } from "@/server/discord";

/** Borne de sûreté d'un passage : une guilde ne doit pas tenir le cron des heures. */
export const MAX_SENIORITY_GUILDS_PER_RUN = 50;

export interface SeniorityRolesSyncResult {
    guildsProcessed: number;
    guildsSkipped: number;
    membersChecked: number;
    membersChanged: number;
    rolesAdded: number;
    rolesRemoved: number;
    announcementsSent: number;
    /** Paliers atteints **avant** l'activation du module : marqués sans être postés. */
    retroactiveTiersMuted: number;
    errors: string[];
    details: string[];
}

interface SeniorityGuildRow {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    seniorityRolesChannelId: string | null;
    seniorityRolesTiers: unknown;
    seniorityRolesAnnouncement: unknown;
    seniorityRolesActivatedAt: Date | null;
}

interface SeniorityMemberRow {
    guildJoinedAt: Date | null;
    discordJoinedAt: Date | null;
    createdAt: Date;
    pseudoDofus: string | null;
    discordNickname: string | null;
    user: { name: string | null; accounts: Array<{ provider: string; providerAccountId: string }> } | null;
}

/** Id Discord d'un profil : le compte **discord** (jamais « le premier venu »). */
function resolveProfileDiscordId(
    accounts: Array<{ provider: string; providerAccountId: string }> | null | undefined,
): string | null {
    const account = (accounts ?? []).find((entry) => entry.provider === "discord");
    return isDiscordSnowflake(account?.providerAccountId) ? account.providerAccountId : null;
}

/** Miniature de l'embed : la PP Discord du membre (défaut), l'icône de guilde, ou rien. */
function resolveAnnouncementThumbnail(input: {
    source: SeniorityAnnouncementConfig["thumbnail"];
    discordId: string;
    member: { avatar?: string | null; user?: { avatar?: string | null } | null };
    guildIconUrl: string | null;
}): string | undefined {
    if (input.source === "guild") return input.guildIconUrl ?? undefined;
    if (input.source === "none") return undefined;
    const hash = input.member.avatar ?? input.member.user?.avatar ?? null;
    return buildDiscordAvatarUrl(input.discordId, hash, 256) ?? getDefaultDiscordAvatar(input.discordId) ?? undefined;
}

/** Revendication atomique : `true` si c'est **nous** qui fêtons ce palier. */
async function claimAnnouncement(guildId: string, discordId: string, tierDays: number): Promise<boolean> {
    try {
        await db.seniorityRoleAnnouncement.create({ data: { guildId, discordId, tierDays } });
        return true;
    } catch (error) {
        // P2002 = une autre passe (ou un autre worker) a revendiqué le palier : c'est le
        // filet anti-double annonce, jamais un échec à remonter.
        if ((error as { code?: string } | null)?.code === "P2002") return false;
        throw error;
    }
}

/**
 * Lâche la revendication quand l'envoi a échoué : le palier n'a **pas** été fêté, la passe
 * suivante doit pouvoir le refaire (sinon il serait perdu à jamais).
 */
async function releaseAnnouncement(guildId: string, discordId: string, tierDays: number): Promise<void> {
    await db.seniorityRoleAnnouncement.deleteMany({ where: { guildId, discordId, tierDays } });
}

/** Une passe complète sur toutes les guildes éligibles. Idempotente, jamais fatale. */
export async function syncSeniorityRolesCore(options: { now?: Date } = {}): Promise<SeniorityRolesSyncResult> {
    const now = options.now ?? new Date();
    const result: SeniorityRolesSyncResult = {
        guildsProcessed: 0,
        guildsSkipped: 0,
        membersChecked: 0,
        membersChanged: 0,
        rolesAdded: 0,
        rolesRemoved: 0,
        announcementsSent: 0,
        retroactiveTiersMuted: 0,
        errors: [],
        details: [],
    };

    if (!process.env.DISCORD_BOT_TOKEN) {
        result.errors.push("DISCORD_BOT_TOKEN manquant : aucune synchronisation possible");
        return result;
    }

    const guilds = await db.guildConfig.findMany({
        where: { isActive: true, seniorityRolesEnabled: true },
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            iconUrl: true,
            seniorityRolesChannelId: true,
            seniorityRolesTiers: true,
            seniorityRolesAnnouncement: true,
            seniorityRolesActivatedAt: true,
        },
        take: MAX_SENIORITY_GUILDS_PER_RUN,
    });

    for (const guild of guilds) {
        const config = mergeSeniorityRolesConfig(guild);
        if (!config.enabled || config.tiers.length === 0) {
            result.guildsSkipped += 1;
            continue;
        }

        try {
            await syncGuild(guild, config, now, result);
            result.guildsProcessed += 1;
        } catch (error) {
            // Une guilde en échec (Discord muet, base) ne prive pas les autres de leur passe.
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`${guild.discordGuildId} : ${message}`);
            logger.error("[SeniorityRoles] Guilde en échec", { guildId: guild.discordGuildId, error: message });
        }
    }

    return result;
}

/** Le travail d'une guilde : marqueur d'activation, membres connus, diff, annonces. */
async function syncGuild(
    guild: SeniorityGuildRow,
    config: GuildSeniorityRolesConfig,
    now: Date,
    result: SeniorityRolesSyncResult,
): Promise<void> {
    // ① Marqueur d'activation : estampé à la première passe, jamais déplacé ensuite. Le jour
    //    où l'écran existe (Y-3), c'est lui qui l'estampera à l'activation du module.
    let activatedAt = guild.seniorityRolesActivatedAt;
    if (!activatedAt) {
        activatedAt = now;
        await db.guildConfig.update({
            where: { id: guild.id },
            data: { seniorityRolesActivatedAt: activatedAt },
        });
        result.details.push(
            `${guild.name} : module activé — les paliers déjà atteints sont posés en silence, seuls les franchissements à venir sont fêtés`,
        );
    }
    const activatedAtIso = activatedAt.toISOString();

    // ② Membres **connus** de la guilde (profils actifs) : un inconnu ne reçoit jamais rien.
    const profiles = await db.userProfile.findMany({
        where: { guildId: guild.id, status: "ACTIVE" },
        select: {
            guildJoinedAt: true,
            discordJoinedAt: true,
            createdAt: true,
            pseudoDofus: true,
            discordNickname: true,
            user: { select: { name: true, accounts: { select: { provider: true, providerAccountId: true } } } },
        },
    });

    // ③ Paliers déjà fêtés (une lecture, une garde locale ; la contrainte unique reste le filet).
    const announcedRows = await db.seniorityRoleAnnouncement.findMany({
        where: { guildId: guild.id },
        select: { discordId: true, tierDays: true },
    });
    const announced = new Set(announcedRows.map((row) => `${row.discordId}:${row.tierDays}`));

    for (const profile of profiles) {
        result.membersChecked += 1;
        const discordId = resolveProfileDiscordId(profile.user?.accounts);
        if (!discordId) continue; // profil sans compte Discord : rien à synchroniser

        const joinedAtIso = resolveJoinedAt({
            guildJoinedAt: profile.guildJoinedAt ? profile.guildJoinedAt.toISOString() : null,
            discordJoinedAt: profile.discordJoinedAt ? profile.discordJoinedAt.toISOString() : null,
            createdAt: profile.createdAt.toISOString(),
        });
        const seniorityDays = computeSeniorityDays(joinedAtIso, now);

        const member = await fetchGuildMember(guild.discordGuildId, discordId);
        if (!member) continue; // plus sur le serveur Discord (404) : rien à faire

        const diff = computeSeniorityRoleDiff({ config, seniorityDays, currentRoleIds: member.roles ?? [] });
        if (!diff.changed && diff.targetTierIndex < 0) continue; // rien à poser, aucun palier atteint

        // ④ Rôles : ajouts puis retraits. Un échec Discord n'interrompt pas les autres membres,
        //    mais **interdit l'annonce** de celui-ci (on ne fête jamais un palier dont les rôles
        //    n'ont pas pu être posés) — le passage suivant réessaiera, le diff étant recalculé
        //    sur les rôles réellement portés.
        let rolesFailed = false;
        for (const roleId of diff.toAdd) {
            const ok = await addRoleToMember(guild.discordGuildId, discordId, roleId);
            if (ok) result.rolesAdded += 1;
            else rolesFailed = true;
        }
        for (const roleId of diff.toRemove) {
            const ok = await removeRoleFromMember(guild.discordGuildId, discordId, roleId);
            if (ok) result.rolesRemoved += 1;
            else rolesFailed = true;
        }
        if (diff.changed) result.membersChanged += 1;

        // ⑤ Annonces : un palier franchi **depuis l'activation**, une seule fois, du plus ancien
        //    au plus récent.
        for (let index = 0; index <= diff.targetTierIndex; index += 1) {
            const tier = config.tiers[index];
            const key = `${discordId}:${tier.days}`;
            if (announced.has(key)) continue;

            if (!shouldCelebrateSeniorityTier({ joinedAtIso, tierDays: tier.days, activatedAtIso })) {
                // Rattrapage : les rôles sont dus (posés ci-dessus), mais le salon reste muet.
                result.retroactiveTiersMuted += 1;
                continue;
            }
            if (rolesFailed || !config.channelId) continue;

            if (!(await claimAnnouncement(guild.id, discordId, tier.days))) {
                announced.add(key);
                continue;
            }

            const sent = await sendSeniorityAnnouncement({
                guild,
                config,
                discordId,
                profile,
                member,
                seniorityDays,
                tier,
            });
            if (sent) {
                result.announcementsSent += 1;
                announced.add(key);
            } else {
                // Envoi refusé (salon en pause, outbox muet) : on relâche la revendication pour
                // que la passe suivante refête ce palier — il ne doit pas être perdu.
                await releaseAnnouncement(guild.id, discordId, tier.days);
            }
        }
    }
}

/**
 * L'embed de félicitation, construit par le **même rendu pur** que l'aperçu de l'écran
 * (Y-3) : ce qui est montré est exactement ce qui part.
 */
async function sendSeniorityAnnouncement(input: {
    guild: SeniorityGuildRow;
    config: GuildSeniorityRolesConfig;
    discordId: string;
    profile: SeniorityMemberRow;
    member: { avatar?: string | null; user?: { avatar?: string | null } | null };
    seniorityDays: number;
    tier: SeniorityTier;
}): Promise<boolean> {
    const channelId = input.config.channelId;
    if (!channelId) return false;

    const displayName =
        input.profile.pseudoDofus || input.profile.discordNickname || input.profile.user?.name || "Membre";
    const values = buildSeniorityAnnouncementValues({
        member: { discordId: input.discordId, displayName },
        guildName: input.guild.name,
        seniorityDays: input.seniorityDays,
        awardedRoleIds: input.tier.roleIds,
    });
    const rendered = renderSeniorityAnnouncement({
        // Le texte du **palier** s'il est personnalisé, sinon le message global de la guilde.
        announcement: resolveTierAnnouncement({ announcement: input.config.announcement, tier: input.tier }),
        values,
    });

    const messageId = await sendChannelMessage(channelId, "", {
        // La ligne de ping part en `mentionContent` : c'est elle qui notifie, jamais l'embed.
        mentionContent: rendered.content,
        embedTitle: rendered.embedTitle,
        embedDescription: rendered.embedDescription,
        embedColor: rendered.color,
        embedThumbnail: resolveAnnouncementThumbnail({
            source: rendered.thumbnail,
            discordId: input.discordId,
            member: input.member,
            guildIconUrl: input.guild.iconUrl,
        }),
        embedFooter: `${input.guild.name} • Rôles par ancienneté`,
    });

    return messageId !== null;
}
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
import { getAppBaseUrl } from "@/lib/utils";
import {
    SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS,
    buildSeniorityAnnouncementValues,
    buildSeniorityNotRegisteredField,
    computeSeniorityRoleDiff,
    mergeSeniorityRolesConfig,
    renderSeniorityAnnouncement,
    resolveTierAnnouncement,
    shouldCelebrateSeniorityTier,
    type GuildSeniorityRolesConfig,
    type SeniorityAnnouncementConfig,
    type SeniorityTier,
} from "@/lib/seniority-roles";
import {
    addRoleToMember,
    fetchAllGuildMembersDetailed,
    removeRoleFromMember,
    sendChannelMessage,
} from "@/server/discord";

/** Borne de sûreté d'un passage : une guilde ne doit pas tenir le cron des heures. */
export const MAX_SENIORITY_GUILDS_PER_RUN = 50;

/** Plafond de membres lus par guilde : au-delà, la liste est tronquée et **dit**. */
export const MAX_SENIORITY_MEMBERS_PER_GUILD = 5_000;

/**
 * Plafond du **rattrapage** par passe et par guilde. La valeur vit dans la règle pure
 * (`SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS`) : l'écran l'affiche, le cron l'applique.
 */
export const MAX_RETRO_ANNOUNCEMENTS_PER_PASS = SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS;

/** Temporisation entre deux écritures de rôle (Discord limite les écritures par guilde). */
export const SENIORITY_ROLE_WRITE_THROTTLE_MS = 100;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface SeniorityRolesSyncResult {
    guildsProcessed: number;
    guildsSkipped: number;
    /** Guildes dont la passe a **levé** (Discord muet, intent manquant, base). */
    guildsErrored: number;
    membersChecked: number;
    /** Membres Discord **sans profil** : ils reçoivent le CTA « crée ton profil ». */
    membersUnregistered: number;
    membersChanged: number;
    rolesAdded: number;
    rolesRemoved: number;
    announcementsSent: number;
    /** Paliers franchis **avant** l'activation du module (marqués sans être postés). */
    retroactiveTiersMuted: number;
    /** Cartes de rattrapage envoyées par cette passe (plafonnées). */
    retroactiveAnnouncementsSent: number;
    /** Paliers éligibles au rattrapage mais **non** envoyés (budget de la passe, échec). */
    retroactiveAnnouncementsPending: number;
    errors: string[];
    details: string[];
    /**
     * Une ligne lisible **par guilde** (clé = nom de guilde, jamais un snowflake). La modale
     * du panneau God rend déjà cet objet : c'est ce qui fait dire à l'écran *pourquoi* une
     * guilde est sautée, au lieu du seul « 0 guilde traitée » (mesure du 18/10/2026).
     */
    telemetryDetails: Record<string, string>;
}

export interface SeniorityRolesSyncOptions {
    now?: Date;
    /** Ne traite qu'une guilde (bouton « Synchroniser maintenant ») — id interne `GuildConfig`. */
    onlyGuildId?: string;
    /**
     * Rattrapage **explicite** : fête le palier le **plus haut** déjà atteint, jamais tous
     * (une carte par membre), et seulement dans la limite de `MAX_RETRO_ANNOUNCEMENTS_PER_PASS`.
     * Jamais activé par le cron : un déploiement ne doit pas inonder un salon.
     */
    announceRetroactive?: boolean;
}

interface SeniorityGuildRow {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    /**
     * ⚠️ **Lu, pas seulement filtré** : `mergeSeniorityRolesConfig` exige ce champ. Son
     * absence du `select` faisait sauter **toutes** les guildes en silence (« 0 guilde
     * traitée », 19 ms) — bug mesuré le 18/10/2026 sur la bêta. L'annotation
     * `SeniorityGuildRow[]` sur le `findMany` empêche la rechute **à la compilation**.
     */
    seniorityRolesEnabled: boolean;
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

/** Membre Discord tel que la couche anti-corruption le rend (rôles + arrivée). */
interface SeniorityDiscordMember {
    user: { id: string; username: string; global_name?: string | null; bot?: boolean; avatar?: string | null };
    nick?: string | null;
    avatar?: string | null;
    roles: string[];
    joined_at?: string;
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
export async function syncSeniorityRolesCore(
    options: SeniorityRolesSyncOptions = {},
): Promise<SeniorityRolesSyncResult> {
    const now = options.now ?? new Date();
    const result: SeniorityRolesSyncResult = {
        guildsProcessed: 0,
        guildsSkipped: 0,
        guildsErrored: 0,
        membersChecked: 0,
        membersUnregistered: 0,
        membersChanged: 0,
        rolesAdded: 0,
        rolesRemoved: 0,
        announcementsSent: 0,
        retroactiveTiersMuted: 0,
        retroactiveAnnouncementsSent: 0,
        retroactiveAnnouncementsPending: 0,
        errors: [],
        details: [],
        telemetryDetails: {},
    };

    if (!process.env.DISCORD_BOT_TOKEN) {
        result.errors.push("DISCORD_BOT_TOKEN manquant : aucune synchronisation possible");
        return result;
    }

    // `SeniorityGuildRow[]` est une **garde de compilation** : retirer un champ du `select`
    // (par exemple `seniorityRolesEnabled`, cause racine du 18/10/2026) ne compile plus.
    const guilds: SeniorityGuildRow[] = await db.guildConfig.findMany({
        where: options.onlyGuildId
            ? { id: options.onlyGuildId }
            : { isActive: true, seniorityRolesEnabled: true },
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            iconUrl: true,
            seniorityRolesEnabled: true,
            seniorityRolesChannelId: true,
            seniorityRolesTiers: true,
            seniorityRolesAnnouncement: true,
            seniorityRolesActivatedAt: true,
        },
        take: MAX_SENIORITY_GUILDS_PER_RUN,
    });

    for (const guild of guilds) {
        const config = mergeSeniorityRolesConfig(guild);
        // Le compte **brut** dit pourquoi une config valide en apparence peut être vide :
        // « 4 paliers lus, 0 retenu » n'est pas « module coupé ».
        const rawTiers = Array.isArray(guild.seniorityRolesTiers) ? guild.seniorityRolesTiers.length : 0;

        if (!config.enabled || config.tiers.length === 0) {
            result.guildsSkipped += 1;
            const reason = !config.enabled
                ? "module désactivé (activation non lue en base)"
                : `${rawTiers} palier(s) lu(s), 0 retenu(s) après validation`;
            result.details.push(`${guild.name} : sautée — ${reason}`);
            result.telemetryDetails[guild.name] = `sautée — ${reason}`;
            // ⚠️ Un saut n'est pas une erreur produit, mais il doit **se voir** : sans cette
            // ligne, le panneau God affichait « 0 guilde traitée » sans cause possible.
            logger.warn("[SeniorityRoles] Guilde sautée", { guild: guild.name, reason });
            continue;
        }

        try {
            await syncGuild(guild, config, now, result, {
                announceRetroactive: options.announceRetroactive === true,
            });
            result.guildsProcessed += 1;
        } catch (error) {
            // Une guilde en échec (Discord muet, base) ne prive pas les autres de leur passe.
            // Le nom remplace le snowflake : `AGENTS.md` §5.7 interdit l'identifiant en log.
            const message = error instanceof Error ? error.message : String(error);
            result.guildsErrored += 1;
            result.errors.push(`${guild.name} : ${message}`);
            result.telemetryDetails[guild.name] = `erreur — ${message}`;
            logger.error("[SeniorityRoles] Guilde en échec", { guild: guild.name, error: message });
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
    options: { announceRetroactive: boolean },
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

    // ② Profils du dashboard — **tous statuts** : un profil archivé reste « inscrit » (il ne
    //    doit pas recevoir le CTA « crée ton profil »). Ils servent à nommer et à dater.
    const profiles = await db.userProfile.findMany({
        where: { guildId: guild.id },
        select: {
            guildJoinedAt: true,
            discordJoinedAt: true,
            createdAt: true,
            pseudoDofus: true,
            discordNickname: true,
            user: { select: { name: true, accounts: { select: { provider: true, providerAccountId: true } } } },
        },
    });
    const profileByDiscordId = new Map<string, SeniorityMemberRow>();
    for (const profile of profiles) {
        const discordId = resolveProfileDiscordId(profile.user?.accounts);
        if (discordId) profileByDiscordId.set(discordId, profile);
    }

    // ③ Source de vérité : **les membres du serveur Discord**, inscrits ou non (demande user
    //    du 18/10/2026). Une liste paginée remplace N appels `fetchGuildMember`.
    const { members, truncated } = await fetchAllGuildMembersDetailed(
        guild.discordGuildId,
        MAX_SENIORITY_MEMBERS_PER_GUILD,
    );
    const humans = members.filter(
        (member): member is SeniorityDiscordMember => !member.user?.bot && isDiscordSnowflake(member.user?.id),
    );
    if (truncated) {
        result.details.push(
            `${guild.name} : liste tronquée à ${MAX_SENIORITY_MEMBERS_PER_GUILD} membres — le reste sera lu à la passe suivante`,
        );
        logger.warn("[SeniorityRoles] Liste de membres tronquée", {
            guild: guild.name,
            max: MAX_SENIORITY_MEMBERS_PER_GUILD,
        });
    }

    // ④ Paliers déjà fêtés (une lecture, une garde locale ; la contrainte unique reste le filet).
    const announcedRows = await db.seniorityRoleAnnouncement.findMany({
        where: { guildId: guild.id },
        select: { discordId: true, tierDays: true },
    });
    const announced = new Set(announcedRows.map((row) => `${row.discordId}:${row.tierDays}`));

    const beforeRoles = result.rolesAdded;
    const beforeAnnouncements = result.announcementsSent;
    const beforeMuted = result.retroactiveTiersMuted;
    const beforeRetro = result.retroactiveAnnouncementsSent;
    let registeredCount = 0;
    let unregisteredCount = 0;

    /** Candidats au rattrapage : une carte par membre, au palier **le plus haut**. */
    const retroCandidates: Array<{
        discordId: string;
        displayName: string;
        member: SeniorityDiscordMember;
        seniorityDays: number;
        tier: SeniorityTier;
        registered: boolean;
    }> = [];

    for (const member of humans) {
        result.membersChecked += 1;
        const discordId = member.user.id;
        const profile = profileByDiscordId.get(discordId) ?? null;
        if (profile) registeredCount += 1;
        else {
            unregisteredCount += 1;
            result.membersUnregistered += 1;
        }

        // Arrivée : le réglage **staff** prime, puis la **date Discord réelle**. `createdAt`
        // n'est qu'un dernier recours (inscription au dashboard, souvent récente) — c'est ce
        // repli qui comptait 0 jour à des vétérans (mesure du 18/10/2026).
        const joinedAtIso = resolveJoinedAt({
            guildJoinedAt: profile?.guildJoinedAt ? profile.guildJoinedAt.toISOString() : null,
            discordJoinedAt:
                member.joined_at ?? (profile?.discordJoinedAt ? profile.discordJoinedAt.toISOString() : null),
            createdAt: profile?.createdAt
                ? profile.createdAt.toISOString()
                : (member.joined_at ?? now.toISOString()),
        });
        const seniorityDays = computeSeniorityDays(joinedAtIso, now);

        const diff = computeSeniorityRoleDiff({ config, seniorityDays, currentRoleIds: member.roles ?? [] });
        if (!diff.changed && diff.targetTierIndex < 0) continue; // rien à poser, aucun palier atteint

        const displayName =
            (profile ? profile.pseudoDofus || profile.discordNickname || profile.user?.name : null) ||
            member.nick ||
            member.user.global_name ||
            member.user.username;

        // ⑤ Rôles : ajouts puis retraits, séparés par une temporisation (Discord limite les
        //    écritures par guilde). Un échec n'interrompt pas les autres membres, mais
        //    **interdit l'annonce** de celui-ci — le passage suivant réessaiera.
        let rolesFailed = false;
        for (const roleId of diff.toAdd) {
            const ok = await addRoleToMember(guild.discordGuildId, discordId, roleId);
            if (ok) result.rolesAdded += 1;
            else rolesFailed = true;
            await sleep(SENIORITY_ROLE_WRITE_THROTTLE_MS);
        }
        for (const roleId of diff.toRemove) {
            const ok = await removeRoleFromMember(guild.discordGuildId, discordId, roleId);
            if (ok) result.rolesRemoved += 1;
            else rolesFailed = true;
            await sleep(SENIORITY_ROLE_WRITE_THROTTLE_MS);
        }
        if (diff.changed) result.membersChanged += 1;

        // ⑥ Annonces : un palier franchi **depuis l'activation**, une seule fois, du plus ancien
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
                displayName,
                member,
                seniorityDays,
                tier,
                registered: profile !== null,
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

        // ⑦ Candidat au rattrapage : le palier **le plus haut**, s'il précède l'activation et
        //    n'a jamais été fêté. Rien n'est envoyé ici : on trie et on borne après la boucle.
        if (diff.targetTierIndex >= 0 && !rolesFailed) {
            const topTier = config.tiers[diff.targetTierIndex];
            const key = `${discordId}:${topTier.days}`;
            if (
                !announced.has(key) &&
                !shouldCelebrateSeniorityTier({ joinedAtIso, tierDays: topTier.days, activatedAtIso })
            ) {
                retroCandidates.push({
                    discordId,
                    displayName,
                    member,
                    seniorityDays,
                    tier: topTier,
                    registered: profile !== null,
                });
            }
        }
    }

    // ⑧ Rattrapage **explicite** : jamais par le cron. Le palier le plus haut d'abord, puis
    //    alphabétique ; les non-servis restent sans revendication ⇒ repris à la passe suivante.
    if (options.announceRetroactive && config.channelId) {
        retroCandidates.sort((a, b) => b.tier.days - a.tier.days || a.displayName.localeCompare(b.displayName));
        for (const candidate of retroCandidates.slice(0, MAX_RETRO_ANNOUNCEMENTS_PER_PASS)) {
            if (!(await claimAnnouncement(guild.id, candidate.discordId, candidate.tier.days))) continue;
            const sent = await sendSeniorityAnnouncement({
                guild,
                config,
                discordId: candidate.discordId,
                displayName: candidate.displayName,
                member: candidate.member,
                seniorityDays: candidate.seniorityDays,
                tier: candidate.tier,
                registered: candidate.registered,
            });
            if (sent) result.retroactiveAnnouncementsSent += 1;
            else await releaseAnnouncement(guild.id, candidate.discordId, candidate.tier.days);
        }
    }
    result.retroactiveAnnouncementsPending +=
        retroCandidates.length - (result.retroactiveAnnouncementsSent - beforeRetro);

    // ⑨ Ce que la passe a RÉELLEMENT fait, par guilde : la ligne que le panneau God n'avait pas
    //    (« 0 guilde traitée » sans cause possible, mesure du 18/10/2026).
    const rolesHere = result.rolesAdded - beforeRoles;
    const announcementsHere = result.announcementsSent - beforeAnnouncements;
    const mutedHere = result.retroactiveTiersMuted - beforeMuted;
    result.details.push(
        `${guild.name} : ${humans.length} membre(s) Discord (${registeredCount} inscrit(s), ${unregisteredCount} sans profil) · ${rolesHere} rôle(s) posé(s) · ${announcementsHere} annonce(s) · ${mutedHere} palier(s) rétroactif(s) silencieux`,
    );
    result.telemetryDetails[guild.name] =
        `${humans.length} membre(s) — ${registeredCount} inscrit(s), ${unregisteredCount} sans profil · ` +
        `${rolesHere} rôle(s) posé(s) · ${announcementsHere} annonce(s) · ${mutedHere} rattrapage(s) silencieux`;
}

/**
 * L'embed de félicitation, construit par le **même rendu pur** que l'aperçu de l'écran
 * (Y-3) : ce qui est montré est exactement ce qui part.
 */
async function sendSeniorityAnnouncement(input: {
    guild: SeniorityGuildRow;
    config: GuildSeniorityRolesConfig;
    discordId: string;
    displayName: string;
    member: { avatar?: string | null; user?: { avatar?: string | null } | null };
    seniorityDays: number;
    tier: SeniorityTier;
    /** `false` ⇒ le membre n'a **aucun profil** : l'embed porte l'appel à en créer un. */
    registered: boolean;
}): Promise<boolean> {
    const channelId = input.config.channelId;
    if (!channelId) return false;

    // Lien **de l'environnement** (bêta ↔ prod), jamais un littéral : un embed de bêta ne doit
    // pas renvoyer vers la prod (dette « origine unique » du reste du dépôt).
    const dashboardUrl = `${getAppBaseUrl()}/dashboard`;
    const values = buildSeniorityAnnouncementValues({
        member: { discordId: input.discordId, displayName: input.displayName },
        guildName: input.guild.name,
        seniorityDays: input.seniorityDays,
        awardedRoleIds: input.tier.roleIds,
    });
    const rendered = renderSeniorityAnnouncement({
        // Le texte du **palier** s'il est personnalisé, sinon le message global de la guilde.
        announcement: resolveTierAnnouncement({ announcement: input.config.announcement, tier: input.tier }),
        values,
        // `{lien}` : disponible dans les modèles, sans dépendre du membre.
        extras: { lien: dashboardUrl },
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
        // Le CTA n'apparaît **que** pour un membre sans profil : les inscrits n'ont pas à lire
        // « crée ton profil ».
        fields: input.registered ? undefined : [buildSeniorityNotRegisteredField(dashboardUrl)],
    });

    return messageId !== null;
}
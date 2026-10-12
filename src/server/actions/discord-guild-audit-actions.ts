"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditStatus = "operational" | "warning" | "blocked" | "unknown" | "not_applicable";

export type ChannelSuggestion = {
    channelType: "TEXT" | "ANNOUNCEMENT" | "FORUM";
    suggestedName: string;
    purpose: string;
    steps: string[];
};

export type AuditFinding = {
    capabilityId: string;
    status: AuditStatus;
    title: string;
    impact?: string;
    remedy?: string;
    technicalDetail?: string;
    settingsHref?: string;
    /** Présent quand le salon n'est pas encore configuré → guide de setup */
    suggestion?: ChannelSuggestion;
};

export type AuditReport = {
    guildName: string;
    discordGuildId: string;
    generatedAt: string;
    globalStatus: "ok" | "degraded" | "unavailable";
    globalError?: string;
    findings: AuditFinding[];
    summary: { operational: number; warning: number; blocked: number; unknown: number };
};

// ─── Permissions Discord (bitfield) ───────────────────────────────────────────

const PERM = {
    VIEW_CHANNEL:           1n << 10n,
    SEND_MESSAGES:          1n << 11n,
    MANAGE_MESSAGES:        1n << 13n,
    EMBED_LINKS:            1n << 14n,
    READ_MESSAGE_HISTORY:   1n << 16n,
    USE_EXTERNAL_EMOJIS:    1n << 18n,
    MANAGE_ROLES:           1n << 28n,
    MANAGE_CHANNELS:        1n << 4n,
    CREATE_PUBLIC_THREADS:  1n << 35n,
    ADMINISTRATOR:          1n << 3n,
} as const;

const POST_EMBED = PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES | PERM.EMBED_LINKS;

type DiscordChannel = {
    id: string;
    name: string | null;
    type: number;
    position: number;
    permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
};

type DiscordRole = {
    id: string;
    name: string;
    position: number;
    permissions: string;
    managed?: boolean;
};

// ─── Contexte d'audit ─────────────────────────────────────────────────────────

type AuditContext = {
    guildId: string;
    internalGuildId: string;
    config: Record<string, unknown>;
    modules: Record<string, boolean | undefined>;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    botUserId: string;
    botRoleIds: string[];
    botHighestPosition: number;
    botGlobalPerms: bigint;
};

// ─── Calcul des permissions effectives ────────────────────────────────────────

function computeBasePerms(ctx: AuditContext): bigint {
    let basePerm = 0n;
    for (const role of ctx.roles) {
        if (role.id === ctx.guildId || ctx.botRoleIds.includes(role.id)) {
            basePerm |= BigInt(role.permissions);
        }
    }
    return basePerm;
}

function computeEffectivePermissions(ctx: AuditContext, channel: DiscordChannel): bigint {
    let basePerm = computeBasePerms(ctx);
    if (basePerm & PERM.ADMINISTRATOR) return ~0n;

    const overwrites = channel.permission_overwrites ?? [];

    const everyoneOw = overwrites.find(o => o.id === ctx.guildId && o.type === 0);
    if (everyoneOw) {
        basePerm &= ~BigInt(everyoneOw.deny);
        basePerm |= BigInt(everyoneOw.allow);
    }

    let roleAllow = 0n, roleDeny = 0n;
    for (const ow of overwrites) {
        if (ow.type === 0 && ctx.botRoleIds.includes(ow.id)) {
            roleAllow |= BigInt(ow.allow);
            roleDeny |= BigInt(ow.deny);
        }
    }
    basePerm &= ~roleDeny;
    basePerm |= roleAllow;

    const memberOw = overwrites.find(o => o.id === ctx.botUserId && o.type === 1);
    if (memberOw) {
        basePerm &= ~BigInt(memberOw.deny);
        basePerm |= BigInt(memberOw.allow);
    }

    return basePerm;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function permNames(missing: bigint): string[] {
    const names: string[] = [];
    for (const [name, bit] of Object.entries(PERM)) {
        if (missing & (bit as bigint)) names.push(name);
    }
    return names;
}

function checkChannelPerms(
    ctx: AuditContext,
    channelId: string | null | undefined,
    capabilityId: string,
    opts: {
        label: string;
        impact: string;
        remedy: string;
        settingsHref?: string;
        requiredPerms?: bigint;
        suggestion?: ChannelSuggestion;
    },
): AuditFinding {
    if (!channelId) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — salon à configurer`,
            impact: opts.impact,
            remedy: opts.suggestion
                ? `Créez le salon sur Discord, puis configurez-le dans SigilOS.`
                : `Configurez un salon dans les réglages : ${opts.remedy}`,
            settingsHref: opts.settingsHref,
            suggestion: opts.suggestion,
        };
    }

    const channel = ctx.channels.find(c => c.id === channelId);
    if (!channel) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — salon introuvable ou inaccessible`,
            impact: opts.impact,
            remedy: `Le salon configuré (ID ${channelId}) est introuvable ou le bot n'y a pas accès. ${opts.remedy}`,
            technicalDetail: `Canal ID ${channelId} absent de la liste des salons visibles par le bot.`,
            settingsHref: opts.settingsHref,
        };
    }

    const required = opts.requiredPerms ?? POST_EMBED;
    const effective = computeEffectivePermissions(ctx, channel);
    const missing = required & ~effective;

    if (missing !== 0n) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — permissions insuffisantes dans #${channel.name ?? channelId}`,
            impact: opts.impact,
            remedy: `Dans les paramètres Discord de #${channel.name ?? channelId}, autorisez le bot : ${permNames(missing).join(", ")}. ${opts.remedy}`,
            technicalDetail: `Permissions manquantes : ${permNames(missing).join(", ")} dans #${channel.name} (ID ${channelId}).`,
            settingsHref: opts.settingsHref,
        };
    }

    return {
        capabilityId,
        status: "operational",
        title: opts.label,
        technicalDetail: `#${channel.name ?? channelId} — accessible, permissions OK.`,
        settingsHref: opts.settingsHref,
    };
}

function checkRoleHierarchy(
    ctx: AuditContext,
    roleId: string | null | undefined,
    capabilityId: string,
    label: string,
    impact: string,
    settingsHref?: string,
): AuditFinding | null {
    if (!roleId) return null;

    const role = ctx.roles.find(r => r.id === roleId);
    if (!role) {
        return {
            capabilityId,
            status: "warning",
            title: `${label} — rôle introuvable`,
            impact,
            remedy: `Le rôle configuré (ID ${roleId}) n'existe plus sur Discord. Vérifiez qu'il n'a pas été supprimé.`,
            settingsHref,
        };
    }

    if (ctx.botHighestPosition <= role.position) {
        return {
            capabilityId,
            status: "blocked",
            title: `${label} — rôle du bot trop bas dans la hiérarchie`,
            impact,
            remedy: `Dans les paramètres Discord de votre serveur (Rôles), placez le rôle du bot au-dessus du rôle « ${role.name} ». Le bot (position ${ctx.botHighestPosition}) doit être plus haut que la cible (position ${role.position}).`,
            technicalDetail: `Bot position ${ctx.botHighestPosition}, rôle cible « ${role.name} » position ${role.position}.`,
            settingsHref,
        };
    }

    return null;
}

function moduleEnabled(modules: Record<string, boolean | undefined>, key: string): boolean {
    return modules[key] === true;
}

// ─── Registre des capacités ───────────────────────────────────────────────────

type CapabilityDef = {
    id: string;
    module: string;
    appliesTo: (config: Record<string, unknown>, modules: Record<string, boolean | undefined>) => boolean;
    check: (ctx: AuditContext) => AuditFinding[] | Promise<AuditFinding[]>;
};

function sHref(guildId: string, path: string): string {
    return `/dashboard/${guildId}/admin/${path}`;
}

function buildCapabilities(guildId: string): CapabilityDef[] {
    return [
        // ── PERMISSIONS GLOBALES DU BOT ──
        {
            id: "bot-global-perms", module: "Bot Discord",
            appliesTo: () => true,
            check: (ctx) => {
                const findings: AuditFinding[] = [];
                const perms = ctx.botGlobalPerms;

                if (perms & PERM.ADMINISTRATOR) {
                    // Admin = tout OK, pas besoin de vérifier le reste
                    return [{
                        capabilityId: "bot-global-perms",
                        status: "operational",
                        title: "Permissions globales du bot",
                        technicalDetail: "Le bot a la permission ADMINISTRATOR — toutes les opérations sont autorisées.",
                    }];
                }

                const required: { bit: bigint; name: string; impact: string }[] = [
                    { bit: PERM.SEND_MESSAGES, name: "Envoyer des messages", impact: "Le bot ne pourra poster aucun message sur le serveur." },
                    { bit: PERM.EMBED_LINKS, name: "Intégrer des liens", impact: "Les embeds (cartes colorées) ne s'afficheront pas." },
                    { bit: PERM.READ_MESSAGE_HISTORY, name: "Voir les anciens messages", impact: "Le bot ne pourra pas modifier ni supprimer ses propres messages." },
                    { bit: PERM.USE_EXTERNAL_EMOJIS, name: "Utiliser des emojis externes", impact: "Les emojis personnalisés dans les messages du bot ne s'afficheront pas." },
                ];

                const missing = required.filter(r => !(perms & r.bit));

                if (missing.length > 0) {
                    findings.push({
                        capabilityId: "bot-global-perms",
                        status: "warning",
                        title: `Permissions globales insuffisantes (${missing.length} manquante${missing.length > 1 ? "s" : ""})`,
                        impact: missing.map(m => m.impact).join(" "),
                        remedy: `Dans les paramètres Discord du serveur → Rôles → rôle du bot, activez : ${missing.map(m => m.name).join(", ")}. Ces permissions peuvent aussi être accordées salon par salon si vous préférez un contrôle plus fin.`,
                        technicalDetail: `Permissions manquantes au niveau serveur : ${missing.map(m => m.name).join(", ")}.`,
                    });
                } else {
                    findings.push({
                        capabilityId: "bot-global-perms",
                        status: "operational",
                        title: "Permissions globales du bot",
                        technicalDetail: "SEND_MESSAGES, EMBED_LINKS, READ_MESSAGE_HISTORY, USE_EXTERNAL_EMOJIS — OK au niveau serveur.",
                    });
                }

                // Vérifier MANAGE_ROLES si des rôles sont configurés
                const hasRoleFeatures = !!(ctx.config.arrivingRoleId || ctx.config.trialRoleId || ctx.config.confirmedRoleId);
                if (hasRoleFeatures && !(perms & PERM.MANAGE_ROLES)) {
                    findings.push({
                        capabilityId: "bot-global-manage-roles",
                        status: "blocked",
                        title: "Gestion des rôles — permission manquante",
                        impact: "Le bot ne pourra pas attribuer ni retirer les rôles de recrue, essai et membre confirmé.",
                        remedy: "Dans les paramètres Discord du serveur → Rôles → rôle du bot, activez « Gérer les rôles ».",
                        technicalDetail: "MANAGE_ROLES manquant au niveau serveur alors que des rôles de cycle de vie sont configurés.",
                    });
                }

                return findings;
            },
        },

        // ── SALON SYSTÈME (alertes SigilOS) ──
        {
            id: "system-notify", module: "Bot Discord",
            appliesTo: () => true,
            check: (ctx) => {
                const channelId = ctx.config.systemNotifyChannelId as string | null;
                if (!channelId) {
                    return [{
                        capabilityId: "system-notify",
                        status: "warning",
                        title: "Salon système non configuré",
                        impact: "SigilOS ne pourra pas envoyer d'alertes automatiques sur Discord (salons supprimés, incidents, rapport quotidien…). Le cron de surveillance des salons ne notifiera pas cette guilde.",
                        remedy: "Configurez un salon système dans les réglages généraux.",
                        settingsHref: sHref(guildId, "settings"),
                        suggestion: {
                            channelType: "TEXT",
                            suggestedName: "sigilos-alertes",
                            purpose: "Reçoit toutes les alertes internes de SigilOS : départs de membres, salons supprimés, incidents bot, rapport quotidien. Accès staff uniquement recommandé.",
                            steps: [
                                "Créez un salon texte nommé #sigilos-alertes (ou #bot-logs) sur Discord.",
                                "Limitez l'accès au staff — les membres ne doivent pas voir ces alertes.",
                                "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens.",
                                "Dans SigilOS → Réglages → Général, sélectionnez ce salon comme Salon système.",
                            ],
                        },
                    }];
                }
                return [checkChannelPerms(ctx, channelId, "system-notify", {
                    label: "Salon système (alertes SigilOS)",
                    impact: "Les alertes automatiques (salons supprimés, incidents, rapport quotidien) ne seront pas envoyées.",
                    remedy: "Vérifiez les permissions du bot dans le salon système.",
                    settingsHref: sHref(guildId, "settings"),
                })];
            },
        },

        // ── MISSIONS ──
        {
            id: "mission-notify", module: "Missions",
            appliesTo: (_c, m) => moduleEnabled(m, "missions"),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.missionNotifyChannelId as string | null, "mission-notify", {
                label: "Notifications hebdomadaires des missions",
                impact: "L'embed résumé des missions de la semaine ne sera pas publié sur Discord.",
                remedy: "Sélectionnez un salon dans les réglages des missions.",
                settingsHref: sHref(guildId, "settings"),
                suggestion: {
                    channelType: "TEXT",
                    suggestedName: "missions-semaine",
                    purpose: "Reçoit chaque semaine l'embed récapitulatif des missions actives, avec les boutons de soumission.",
                    steps: [
                        "Créez un salon texte nommé #missions-semaine (ou #missions) sur Discord.",
                        "Donnez au bot les permissions : Voir le salon, Envoyer des messages, Intégrer des liens.",
                        "Dans SigilOS → Réglages → Missions, sélectionnez ce salon.",
                    ],
                },
            })],
        },
        {
            id: "mission-validation", module: "Missions",
            appliesTo: (_c, m) => moduleEnabled(m, "missions"),
            check: (ctx) => {
                const channelId = (ctx.config.missionValidationChannelId ?? ctx.config.missionNotifyChannelId) as string | null;
                return [checkChannelPerms(ctx, channelId, "mission-validation", {
                    label: "Soumissions de missions à valider",
                    impact: "Les preuves de missions ne seront pas envoyées aux validateurs sur Discord.",
                    remedy: "Configurez le salon de validation ou le salon des notifications missions.",
                    settingsHref: sHref(guildId, "settings"),
                    requiredPerms: POST_EMBED | PERM.MANAGE_MESSAGES,
                    suggestion: {
                        channelType: "TEXT",
                        suggestedName: "validation-missions",
                        purpose: "Reçoit les soumissions de preuves pour validation par le staff. Le bot y supprime les anciens messages après validation.",
                        steps: [
                            "Créez un salon texte nommé #validation-missions sur Discord.",
                            "Réservez l'accès en lecture au staff (les membres ne doivent pas voir les soumissions des autres).",
                            "Donnez au bot : Voir, Envoyer des messages, Intégrer des liens, Gérer les messages.",
                            "Dans SigilOS → Réglages → Missions, sélectionnez ce salon comme salon de validation.",
                        ],
                    },
                })];
            },
        },

        // ── CALENDRIER ──
        {
            id: "calendar-notify", module: "Calendrier",
            appliesTo: (_c, m) => moduleEnabled(m, "calendar"),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.calendarNotifyChannelId as string | null, "calendar-notify", {
                label: "Rappels d'événements",
                impact: "Les membres ne recevront aucun rappel Discord avant les événements.",
                remedy: "Sélectionnez un salon dans les réglages du calendrier.",
                settingsHref: sHref(guildId, "calendar"),
                suggestion: {
                    channelType: "TEXT",
                    suggestedName: "events-rappels",
                    purpose: "Reçoit les rappels automatiques avant chaque événement du calendrier de guilde.",
                    steps: [
                        "Créez un salon texte nommé #events-rappels (ou #planning) sur Discord.",
                        "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens.",
                        "Dans SigilOS → Réglages → Calendrier, sélectionnez ce salon.",
                    ],
                },
            })],
        },
        {
            id: "raid-notify", module: "Calendrier",
            appliesTo: (c) => !!(c.raidNotifyChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.raidNotifyChannelId as string | null, "raid-notify", {
                label: "Rappels de raid",
                impact: "Aucun rappel automatique avant les raids.",
                remedy: "Sélectionnez un salon de notifications raid.",
                settingsHref: sHref(guildId, "calendar"),
            })],
        },

        // ── SONGES ──
        {
            id: "songes-notify", module: "Songes",
            appliesTo: (_c, m) => moduleEnabled(m, "songes"),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.songesNotifyChannelId as string | null, "songes-notify", {
                label: "Résultats de runs Songes",
                impact: "Les résultats de runs ne seront pas publiés sur Discord.",
                remedy: "Sélectionnez un salon dans les réglages Songes.",
                settingsHref: sHref(guildId, "songes"),
                suggestion: {
                    channelType: "TEXT",
                    suggestedName: "songes-resultats",
                    purpose: "Reçoit automatiquement les résultats de chaque run dans les Songes de l'Almanax.",
                    steps: [
                        "Créez un salon texte nommé #songes-resultats sur Discord.",
                        "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens.",
                        "Dans SigilOS → Songes → Réglages, sélectionnez ce salon.",
                    ],
                },
            })],
        },

        // ── TICKETS ──
        {
            id: "ticket-panels", module: "Tickets",
            appliesTo: (_c, m) => moduleEnabled(m, "tickets"),
            check: async (ctx) => {
                const panels = await db.ticketBotPanel.findMany({
                    where: { guildId: ctx.internalGuildId, isActive: true },
                    select: { id: true, name: true, channelId: true },
                });
                if (panels.length === 0) {
                    return [{
                        capabilityId: "ticket-panels",
                        status: "warning" as AuditStatus,
                        title: "Tickets — aucun panneau déployé",
                        impact: "Les membres n'ont aucun moyen d'ouvrir un ticket depuis Discord.",
                        remedy: "Créez au moins un panneau de tickets dans SigilOS et déployez-le.",
                        settingsHref: `/dashboard/${guildId}/tickets`,
                        suggestion: {
                            channelType: "TEXT",
                            suggestedName: "ouvrir-un-ticket",
                            purpose: "Accueille le panneau de tickets avec les boutons d'ouverture pour les membres.",
                            steps: [
                                "Créez un salon texte nommé #ouvrir-un-ticket (ou #support) sur Discord.",
                                "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens.",
                                "Dans SigilOS → Tickets, créez un panneau et sélectionnez ce salon.",
                                "Cliquez sur « Déployer » pour que le bot y publie le message avec les boutons.",
                            ],
                        },
                    }];
                }
                return panels.map(panel =>
                    checkChannelPerms(ctx, panel.channelId, `ticket-panel-${panel.id}`, {
                        label: `Panneau de tickets « ${panel.name} »`,
                        impact: `Le panneau « ${panel.name} » ne sera pas visible par les membres.`,
                        remedy: "Vérifiez que le bot a accès au salon du panneau.",
                        settingsHref: `/dashboard/${guildId}/tickets`,
                    }),
                );
            },
        },
        {
            id: "ticket-create", module: "Tickets",
            appliesTo: (_c, m) => moduleEnabled(m, "tickets"),
            check: async (ctx) => {
                const categories = await db.ticketBotCategory.findMany({
                    where: { guildId: ctx.internalGuildId, isEnabled: true },
                    select: { id: true, name: true, channelParentId: true },
                });
                if (categories.length === 0) {
                    return [{ capabilityId: "ticket-create", status: "not_applicable" as AuditStatus, title: "Création de tickets — aucune catégorie active" }];
                }
                const hasManageChannels = !!(ctx.botGlobalPerms & PERM.MANAGE_CHANNELS) || !!(ctx.botGlobalPerms & PERM.ADMINISTRATOR);
                if (!hasManageChannels) {
                    return [{
                        capabilityId: "ticket-create", status: "blocked" as AuditStatus,
                        title: "Création de tickets — permission MANAGE_CHANNELS manquante",
                        impact: "Impossible d'ouvrir de nouveaux tickets : le bot ne peut pas créer de salons Discord.",
                        remedy: "Dans les paramètres Discord du serveur → Rôles → rôle du bot, activez « Gérer les salons ».",
                    }];
                }
                return [{
                    capabilityId: "ticket-create", status: "operational" as AuditStatus,
                    title: "Création de salons de tickets",
                    technicalDetail: `${categories.length} catégorie(s) active(s), MANAGE_CHANNELS présent.`,
                }];
            },
        },

        // ── WELCOME ──
        {
            id: "welcome-discord", module: "Bienvenue",
            appliesTo: (c) => !!(c.welcomeEnabled) && !!(c.welcomeDiscordEnabled),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.welcomeNotifyChannelId as string | null, "welcome-discord", {
                label: "Messages de bienvenue Discord",
                impact: "Les nouveaux membres ne seront pas accueillis automatiquement sur Discord.",
                remedy: "Configurez le salon de bienvenue.",
                settingsHref: sHref(guildId, "settings"),
                suggestion: {
                    channelType: "TEXT",
                    suggestedName: "bienvenue",
                    purpose: "Reçoit le message de bienvenue personnalisé dès qu'un nouveau membre rejoint la guilde.",
                    steps: [
                        "Créez un salon texte nommé #bienvenue sur Discord.",
                        "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens.",
                        "Dans SigilOS → Réglages → Bienvenue, activez le mode Discord et sélectionnez ce salon.",
                    ],
                },
            })],
        },

        // ── RÉACTION-RÔLES ──
        {
            id: "reaction-roles", module: "Réaction-Rôles",
            appliesTo: (_c, m) => moduleEnabled(m, "reactionRoles"),
            check: async (ctx) => {
                const groups = await db.reactionRoleGroup.findMany({
                    where: { guildId: ctx.internalGuildId, isActive: true },
                    select: { id: true, name: true, channelId: true, options: { select: { roleId: true, roleName: true } } },
                });
                if (groups.length === 0) {
                    return [{
                        capabilityId: "reaction-roles",
                        status: "warning" as AuditStatus,
                        title: "Réaction-rôles — aucun groupe déployé",
                        impact: "Les membres ne peuvent pas choisir leurs rôles via Discord.",
                        remedy: "Créez un groupe de réaction-rôles dans SigilOS et déployez-le.",
                        settingsHref: `/dashboard/${guildId}/reaction-roles`,
                        suggestion: {
                            channelType: "TEXT",
                            suggestedName: "choisir-ses-roles",
                            purpose: "Accueille les messages de sélection de rôles pour les membres.",
                            steps: [
                                "Créez un salon texte nommé #choisir-ses-roles sur Discord.",
                                "Donnez au bot : Voir le salon, Envoyer des messages, Intégrer des liens, Gérer les rôles.",
                                "Dans SigilOS → Réaction-Rôles, créez un groupe et sélectionnez ce salon.",
                                "Cliquez sur « Déployer » pour publier le message.",
                            ],
                        },
                    }];
                }
                const findings: AuditFinding[] = [];
                for (const group of groups) {
                    findings.push(checkChannelPerms(ctx, group.channelId, `rr-channel-${group.id}`, {
                        label: `Réaction-rôle « ${group.name} »`,
                        impact: `Le message de sélection de rôles « ${group.name} » ne sera pas accessible.`,
                        remedy: "Vérifiez que le bot a accès au salon.",
                        settingsHref: `/dashboard/${guildId}/reaction-roles`,
                    }));
                    for (const opt of group.options) {
                        const roleCheck = checkRoleHierarchy(ctx, opt.roleId, `rr-role-${opt.roleId}`,
                            `Réaction-rôle « ${group.name} » — rôle « ${opt.roleName} »`,
                            `Les membres cliqueront mais le rôle « ${opt.roleName} » ne sera pas attribué.`,
                            `/dashboard/${guildId}/reaction-roles`);
                        if (roleCheck) findings.push(roleCheck);
                    }
                }
                return findings;
            },
        },

        // ── BLACKLIST ──
        {
            id: "blacklist", module: "Blacklist",
            appliesTo: (c) => !!(c.blacklistChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.blacklistChannelId as string | null, "blacklist", {
                label: "Salon de blacklist",
                impact: "Les entrées de la blacklist ne seront pas publiées/modifiées/supprimées sur Discord.",
                remedy: "Vérifiez les permissions du bot dans le salon blacklist.",
                settingsHref: sHref(guildId, "settings"),
                requiredPerms: POST_EMBED | PERM.MANAGE_MESSAGES,
            })],
        },

        // ── MARCHÉ ──
        {
            id: "market-notify", module: "Marché",
            appliesTo: (_c, m) => moduleEnabled(m, "marche"),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.marketNotifyChannelId as string | null, "market-notify", {
                label: "Publication des annonces du marché",
                impact: "Les annonces du marché ne seront pas publiées sur Discord.",
                remedy: "Configurez un salon dans les réglages du marché.",
                settingsHref: sHref(guildId, "settings"),
                suggestion: {
                    channelType: "FORUM",
                    suggestedName: "marche-guilde",
                    purpose: "Publie les annonces du marché de guilde. Peut être un salon texte ou un forum Discord.",
                    steps: [
                        "Créez un salon texte (ou forum) nommé #marche-guilde sur Discord.",
                        "Forum recommandé : chaque annonce devient un fil séparé, plus lisible.",
                        "Donnez au bot : Voir, Envoyer des messages, Intégrer des liens (+ Créer des fils publics si forum).",
                        "Dans SigilOS → Réglages → Marché, sélectionnez ce salon.",
                    ],
                },
            })],
        },

        // ── CYCLE DE VIE ──
        {
            id: "lifecycle-notify", module: "Cycle de vie",
            appliesTo: (c) => !!(c.lifecycleNotifyChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.lifecycleNotifyChannelId as string | null, "lifecycle-notify", {
                label: "Notifications de cycle de vie",
                impact: "Le staff ne sera pas notifié des départs, exclusions et changements de statut.",
                remedy: "Vérifiez les permissions du bot dans le salon de notifications.",
                settingsHref: sHref(guildId, "recruitment"),
            })],
        },
        {
            id: "lifecycle-roles", module: "Cycle de vie",
            appliesTo: (c) => !!(c.arrivingRoleId) || !!(c.trialRoleId) || !!(c.confirmedRoleId),
            check: (ctx) => {
                const findings: AuditFinding[] = [];
                const href = sHref(guildId, "recruitment");
                for (const [key, label] of [
                    ["arrivingRoleId", "Rôle d'arrivée"],
                    ["trialRoleId", "Rôle de période d'essai"],
                    ["confirmedRoleId", "Rôle de membre confirmé"],
                ] as const) {
                    const check = checkRoleHierarchy(ctx, ctx.config[key] as string | null, `lifecycle-${key}`, label,
                        "Le rôle Discord ne sera pas attribué/retiré lors du changement de statut.", href);
                    if (check) findings.push(check);
                }
                return findings;
            },
        },

        // ── SONDAGES ──
        {
            id: "polls-notify", module: "Sondages",
            appliesTo: (_c, m) => moduleEnabled(m, "polls"),
            check: (ctx) => {
                if (!ctx.config.pollsNotifyChannelId) {
                    return [{ capabilityId: "polls-notify", status: "not_applicable" as AuditStatus, title: "Notifications sondages — salon non configuré (optionnel)" }];
                }
                return [checkChannelPerms(ctx, ctx.config.pollsNotifyChannelId as string | null, "polls-notify", {
                    label: "Publication des sondages sur Discord",
                    impact: "Les sondages ne seront pas annoncés sur Discord.",
                    remedy: "Vérifiez les permissions du bot dans le salon des sondages.",
                    settingsHref: sHref(guildId, "settings"),
                })];
            },
        },

        // ── GUILDATON ──
        {
            id: "guildaton-notify", module: "Guildaton",
            appliesTo: (c) => !!(c.guildatonNotifyChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.guildatonNotifyChannelId as string | null, "guildaton-notify", {
                label: "Résultats et rappels guildaton",
                impact: "Les résultats et rappels du guildaton ne seront pas publiés sur Discord.",
                remedy: "Vérifiez les permissions du bot dans le salon guildaton.",
                settingsHref: sHref(guildId, "settings"),
            })],
        },

        // ── BONUS ──
        {
            id: "bonus-notify", module: "Bonus",
            appliesTo: (c) => !!(c.bonusNotifyChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.bonusNotifyChannelId as string | null, "bonus-notify", {
                label: "Notifications de bonus de guilde",
                impact: "Les changements de bonus ne seront pas annoncés sur Discord.",
                remedy: "Vérifiez les permissions du bot dans le salon des bonus.",
                settingsHref: sHref(guildId, "bonus"),
            })],
        },

        // ── RELANCE ──
        {
            id: "relance", module: "Relance",
            appliesTo: (c) => !!(c.relanceChannelId),
            check: (ctx) => [checkChannelPerms(ctx, ctx.config.relanceChannelId as string | null, "relance", {
                label: "Publication des relances",
                impact: "Les relances ne seront pas publiées sur Discord.",
                remedy: "Vérifiez les permissions du bot dans le salon de relance.",
                settingsHref: sHref(guildId, "relance"),
            })],
        },
    ];
}

// ─── Chargement des canaux avec overwrites ────────────────────────────────────

async function fetchChannelsWithOverwrites(discordGuildId: string): Promise<DiscordChannel[]> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN manquant");
    const { fetchWithRetry } = await import("@/server/discord");
    const res = await fetchWithRetry(`/api/v10/guilds/${discordGuildId}/channels`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return (await res.json()) as DiscordChannel[];
}

// ─── Action principale ───────────────────────────────────────────────────────

export async function runDiscordGuildAudit(guildId: string): Promise<AuditReport> {
    const user = await getUserContext(guildId);
    if (!user.isDiscordAdmin) {
        return {
            guildName: "", discordGuildId: guildId, generatedAt: new Date().toISOString(),
            globalStatus: "unavailable", globalError: "Accès refusé — réservé aux administrateurs Discord natifs.",
            findings: [], summary: { operational: 0, warning: 0, blocked: 0, unknown: 0 },
        };
    }

    const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
    if (!guildConfig) {
        return {
            guildName: "", discordGuildId: guildId, generatedAt: new Date().toISOString(),
            globalStatus: "unavailable", globalError: "Guilde non déployée sur SigilOS.",
            findings: [], summary: { operational: 0, warning: 0, blocked: 0, unknown: 0 },
        };
    }

    const modulesRecord = await db.guildModules.findUnique({ where: { guildId: guildConfig.id } });
    const modules = (modulesRecord ?? {}) as unknown as Record<string, boolean | undefined>;

    try {
        const { fetchGuildRoles, fetchCurrentBotUser, fetchGuildMember } = await import("@/server/discord");

        const [channelsResult, rolesResult, botUser] = await Promise.all([
            fetchChannelsWithOverwrites(guildId),
            fetchGuildRoles(guildId, { excludeManaged: false }),
            fetchCurrentBotUser(),
        ]);

        if (!botUser) {
            return {
                guildName: guildConfig.name, discordGuildId: guildId, generatedAt: new Date().toISOString(),
                globalStatus: "unavailable", globalError: "Impossible de déterminer l'identité du bot. Vérifiez le DISCORD_BOT_TOKEN.",
                findings: [], summary: { operational: 0, warning: 0, blocked: 0, unknown: 0 },
            };
        }

        const roles = rolesResult as DiscordRole[];
        const botMember = await fetchGuildMember(guildId, botUser.id);
        if (!botMember) {
            return {
                guildName: guildConfig.name, discordGuildId: guildId, generatedAt: new Date().toISOString(),
                globalStatus: "unavailable", globalError: "Le bot n'est pas présent sur ce serveur Discord. Réinvitez-le via le lien d'installation.",
                findings: [], summary: { operational: 0, warning: 0, blocked: 0, unknown: 0 },
            };
        }

        const botRoleIds = (botMember.roles ?? []) as string[];
        const botHighestPosition = roles
            .filter(r => botRoleIds.includes(r.id))
            .reduce((max, r) => Math.max(max, r.position ?? 0), 0);

        // Calcul des permissions globales du bot
        let botGlobalPerms = 0n;
        for (const role of roles) {
            if (role.id === guildId || botRoleIds.includes(role.id)) {
                botGlobalPerms |= BigInt(role.permissions);
            }
        }

        const ctx: AuditContext = {
            guildId, internalGuildId: guildConfig.id,
            config: guildConfig as unknown as Record<string, unknown>,
            modules, channels: channelsResult, roles, botUserId: botUser.id,
            botRoleIds, botHighestPosition, botGlobalPerms,
        };

        const capabilities = buildCapabilities(guildId);
        const findings: AuditFinding[] = [];

        for (const cap of capabilities) {
            if (!cap.appliesTo(ctx.config, ctx.modules)) continue;
            try {
                const result = await cap.check(ctx);
                findings.push(...result);
            } catch (err) {
                logger.error(`[DiscordAudit] Erreur capacité ${cap.id}`, { error: err });
                findings.push({
                    capabilityId: cap.id, status: "unknown",
                    title: `${cap.module} — vérification impossible`,
                    technicalDetail: `Erreur : ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        }

        const summary = { operational: 0, warning: 0, blocked: 0, unknown: 0 };
        for (const f of findings) {
            if (f.status === "operational") summary.operational++;
            else if (f.status === "warning") summary.warning++;
            else if (f.status === "blocked") summary.blocked++;
            else if (f.status === "unknown") summary.unknown++;
        }

        return {
            guildName: guildConfig.name, discordGuildId: guildId,
            generatedAt: new Date().toISOString(),
            globalStatus: summary.blocked > 0 ? "degraded" : "ok",
            findings, summary,
        };
    } catch (err) {
        logger.error("[DiscordAudit] Erreur globale Discord API", { error: err, guildId });
        return {
            guildName: guildConfig.name, discordGuildId: guildId, generatedAt: new Date().toISOString(),
            globalStatus: "unavailable", globalError: "Impossible de contacter l'API Discord. Réessayez dans quelques instants.",
            findings: [], summary: { operational: 0, warning: 0, blocked: 0, unknown: 0 },
        };
    }
}

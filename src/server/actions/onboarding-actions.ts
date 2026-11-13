"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { getDofusWeek } from "@/lib/date-utils";
import { COUNTED_MODULE_KEYS, getNextOnboardingAction } from "@/lib/onboarding-gating";
import { getAppBaseUrl } from "@/lib/utils";

export type OnboardingProgress = {
    steps: {
        id: string;
        title: string;
        description: string;
        status: "COMPLETED" | "IN_PROGRESS" | "TO_DO";
        mandatory: boolean;
        points: number;
        href: string;
    }[];
    totalPoints: number;
    maxPoints: number;
    isFinished: boolean;
    mandatoryComplete: boolean;
    /** CTA unique « prochaine action » (obligatoires d'abord) — `null` = tout est fait. */
    nextAction: OnboardingProgress["steps"][number] | null;
};

export async function getGettingStartedProgress(guildId: string): Promise<OnboardingProgress> {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        throw new Error("Unauthorized");
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        include: {
            modules: true,
            _count: {
                select: {
                    profiles: true,
                    missions: {
                        where: {
                            weekNumber: getDofusWeek().week,
                            year: getDofusWeek().year,
                        }
                    }
                }
            }
        }
    });

    if (!guild) {
        throw new Error("Guild not found");
    }

    const rolesMapping = (guild.rolesMapping as Record<string, string[]>) || {};
    // Fail-closed : `dashboard:login` sur @everyone (id = id Discord de la guilde)
    // ne valide PAS l'étape RBAC — sinon l'admin croit la guilde sécurisée alors
    // que tout le serveur entre (cohérent avec getUserContext).
    const { isRbacConfigured: isRbacExcludingEveryone } = await import("@/lib/onboarding-gating");
    const isRbacConfigured = isRbacExcludingEveryone(rolesMapping, guild.discordGuildId);

    // Rapport beta onboarding : si le module missions est DÉSACTIVÉ, l'étape
    // "Premières Missions" pointait vers /missions/manage qui rend
    // <AccessDenied/> même pour l'owner (applyModule = false quand OFF) — mur
    // "Accès Restreint" incompréhensible. Le CTA mène donc à l'activation du
    // module d'abord, à la gestion ensuite.
    const modulesState = (guild.modules as Record<string, boolean> | null) || null;
    // Sans ligne modules en BDD, getGuildModules retombe sur DEFAULT_MODULES
    // (tout OFF sauf admin) — même règle ici pour rester cohérent.
    const missionsModuleOn = modulesState ? modulesState.missions !== false : false;
    // « Modules configurés » = au moins un module du REGISTRE réellement actif
    // (`COUNTED_MODULE_KEYS`, `admin` exclu). La liste locale de 14 clés qui vivait
    // ici avait dérivé (27 au registre) : une guilde n'activant que `tickets`, `logs`
    // ou `marche` restait bloquée à « non configuré » pour toujours, et `admin`
    // (actif par construction) validait l'étape sans qu'AUCUN module ne soit choisi.
    const modulesConfigured = !!modulesState && COUNTED_MODULE_KEYS.some((key) => modulesState[key] === true);

    const steps: OnboardingProgress["steps"] = [
        {
            id: "dofus",
            title: "Serveur de Jeu",
            description: "Sélectionnez le serveur Dofus de votre guilde. Cela débloquera l'accès aux autres paramètres.",
            status: guild.dofusServerId ? "COMPLETED" : "TO_DO",
            mandatory: true,
            points: 20,
            href: `/dashboard/${guildId}/admin/settings?tab=dofus`,
        },
        {
            id: "rbac",
            title: "Rôles & Permissions",
            description: "Définissez au moins un rôle Discord pour l'autorisation 'Accès Dashboard' afin de sécuriser l'accès.",
            status: isRbacConfigured ? "COMPLETED" : "TO_DO",
            mandatory: true,
            points: 20,
            href: `/dashboard/${guildId}/admin/permissions`,
        },
        {
            id: "discord",
            title: "Lier le Bot Discord",
            description: "Configurez au moins le salon de notifications principal (Lifecycle ou Missions).",
            status: guild.missionNotifyChannelId || guild.lifecycleNotifyChannelId ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/settings?tab=annonces`,
        },
        {
            id: "modules",
            title: "Configurer les Modules",
            description: "Activez les fonctionnalités dont votre guilde a besoin (Missions, Songes, Ocre...).",
            // Step "modules" complète SEULEMENT si une VRAIE config existe en BDD
            // (>= 1 module du registre actif). Depuis l'état vierge (aucun module actif
            // par défaut), la step reste IN_PROGRESS jusqu'à activation explicite.
            status: modulesConfigured ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/modules`,
        },
        {
            id: "presentation",
            title: "Page de Présentation",
            description: "Personnalisez votre page publique pour attirer de nouveaux membres.",
            status: guild.presentationEnabled && guild.presentationHistory ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/presentation`,
        },
        {
            id: "missions",
            title: "Premières Missions",
            description: missionsModuleOn
                ? "Lancez l'activité en publiant des missions hebdomadaires pour vos membres."
                : "Activez d'abord le module Missions, puis publiez vos premières missions.",
            status: guild._count.missions > 0 ? "COMPLETED" : "TO_DO",
            mandatory: false,
            points: 15,
            href: missionsModuleOn
                ? `/dashboard/${guildId}/missions/manage`
                : `/dashboard/${guildId}/admin/modules`,
        },
    ];

    const totalPoints = steps.reduce((acc, step) => acc + (step.status === "COMPLETED" ? step.points : 0), 0);
    const maxPoints = steps.reduce((acc, step) => acc + step.points, 0);
    const mandatoryComplete = steps
        .filter(s => s.mandatory)
        .every(s => s.status === "COMPLETED");

    return {
        steps,
        totalPoints,
        maxPoints,
        isFinished: totalPoints === maxPoints,
        mandatoryComplete,
        // CTA unique : la page getting-started s'ouvre sur UNE action, pas sur 7 cartes.
        nextAction: getNextOnboardingAction(steps),
    };
}

export async function markWelcomeAsSeen(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: user.id!,
                    guildId: guildConfig.id,
                },
            },
            data: {
                hasSeenWelcome: true,
            },
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(user.id!, guildConfig.id, guildId);

        revalidatePath(`/dashboard/${guildId}`);
        return { success: true };
    } catch (e) {
        logger.error("Failed to mark welcome as seen", e);
        return { success: false, error: "Database error" };
    }
}

export async function sendWelcomeNotifications(guildConfig: any, profileId: string, displayName: string) {
    if (!guildConfig) return;

    // Helper to strip HTML tags
    // CodeQL js/incomplete-multi-character-sanitization : le retrait des tags est appliqué
    // EN BOUCLE jusqu'à stabilité — aucun tag ne peut se reformer depuis un résidu
    // (ex. `<scri<script></script>pt>` → plus jamais de `<script>` dans la sortie).
    const stripHtml = (html: string) => {
        if (!html) return "";
        let clean = html
            .replace(/<p>/g, "")
            .replace(/<\/p>/g, "\n")
            .replace(/<br\s*\/?>/g, "\n")
            .replace(/<strong>/g, "**")
            .replace(/<\/strong>/g, "**")
            .replace(/<em>/g, "_")
            .replace(/<\/em>/g, "_");
        let previous: string;
        do {
            previous = clean;
            clean = clean.replace(/<[^>]*>/g, "");
        } while (clean !== previous);
        return clean.trim();
    };

    // Fetch user profile to get Discord ID if needed for pinging
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: {
            userId: true,
            user: {
                select: {
                    image: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true },
                        take: 1
                    }
                }
            }
        },
    });

    const discordUserId = profile?.user?.accounts?.[0]?.providerAccountId;

    // 1. Dashboard Welcome Post
    if (guildConfig.welcomeDashboardEnabled) {
        const template = guildConfig.welcomeMessageTemplate || "<p>🎉 Bienvenue à <strong>{member}</strong> parmi nous !</p>";
        const content = template
            .replace(/{member}/g, `**${displayName}**`)
            .replace(/{user}/g, `**${displayName}**`)
            .replace(/{nickname}/g, `**${displayName}**`)
            .replace(/{guild}/g, `**${guildConfig.name || "la guilde"}**`)
            .replace(/{server}/g, `**${guildConfig.name || "la guilde"}**`);

        try {
            await Promise.all([
                db.memberWelcome.create({
                    data: {
                        guildId: guildConfig.id,
                        profileId: profileId,
                        content: content
                    }
                }),
                db.guildActivity.create({
                    data: {
                        guildId: guildConfig.id,
                        type: "NEW_MEMBER",
                        actorName: displayName,
                        meta: { message: stripHtml(content), profileId }
                    }
                })
            ]);
        } catch (e) {
            logger.error("[Welcome] Failed to create welcome records", e);
        }
    }

    // 2. Annonce d'arrivée : elle vit désormais dans le **flux**, pas dans la cloche.
    //
    // 🗑️ Ce qui a été retiré (mesure du 15/10/2026) : une copie en base **par membre actif**
    // (« ✨ Arrivée d'un nouveau membre » → `Notification`, catégorie `SYSTEM`) à chaque arrivée.
    // Pour 2 guildes bêta, 9 443 lignes non lues — 81 % de la table `Notification` — pour une
    // information **déjà affichée deux fois** :
    //   · la ligne `GuildActivity` `NEW_MEMBER` écrite ci-dessus (l.260-267) est diffusée en
    //     bulle à tous les membres connectés via le flux live (`guild-activity-stream.tsx`) ;
    //   · le même message existe en popup côté `MemberWelcome`.
    // C'est l'anti-patron que `docs/plans/PLAN-ACTIVITE-GUILDE.md:42` interdit (« une ligne par
    // membre ? **Non** : le flux porte l'événement ») et que `activity-toaster.tsx` documente
    // déjà (« aucune copie en base par membre »). Aucune préférence ne pouvait le couper :
    // `SYSTEM` n'est pas une clé d'`notificationPrefs`.
    //
    // Rien à ajouter ici : le flux porte déjà l'événement. C'est un **retrait**, pas un
    // déplacement.

    // 3. Discord Welcome Ping
    if (guildConfig.welcomeDiscordEnabled && guildConfig.welcomeNotifyChannelId) {
        const { sendChannelMessage } = await import("@/server/discord");

        const rawTemplate = guildConfig.welcomeDiscordMessageTemplate || guildConfig.welcomeMessageTemplate || "🎉 Bienvenue à {member} !";
        const template = stripHtml(rawTemplate);

        const memberMention = discordUserId ? `<@${discordUserId}>` : `**${displayName}**`;

        const content = template
            .replace(/{member}/g, memberMention)
            .replace(/{user}/g, memberMention)
            .replace(/{nickname}/g, memberMention)
            .replace(/{guild}/g, `**${guildConfig.name || "la guilde"}**`)
            .replace(/{server}/g, `**${guildConfig.name || "la guilde"}**`);

        // Pings go outside the embed (trigger notification)
        let mentionContent = "";
        if (guildConfig.welcomeMentionRoleId) {
            mentionContent = guildConfig.welcomeMentionRoleId === "everyone"
                ? "@everyone"
                : `<@&${guildConfig.welcomeMentionRoleId}>`;
        }

        // Combine role ping and user ping for maximum attention
        const pings = [mentionContent, memberMention].filter(Boolean).join(" ");

        try {
            await sendChannelMessage(guildConfig.welcomeNotifyChannelId, "", {
                mentionContent: pings,
                embedTitle: `🌟 NOUVELLE ARRIVÉE !`,
                embedDescription: content,
                embedColor: 0xf59e0b, // Amber 500
                embedThumbnail: profile?.user?.image || `${getAppBaseUrl()}/assets/ui/logo-v2.png`,
                embedFooter: "SigilOS Onboarding System"
            });
        } catch (e) {
            logger.error("[Welcome] Failed to send Discord welcome message", e);
        }
    }
}

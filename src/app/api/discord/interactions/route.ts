import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature } from "@/server/discord";
import { db } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";

// ============================================
// DOFUS CLASSES for Modal validation
// ============================================
const VALID_CLASSES = [
    "Cra", "Ecaflip", "Eliotrope", "Eniripsa", "Enutrof",
    "Féca", "Forgelance", "Huppermage", "Iop", "Osamodas",
    "Ouginak", "Pandawa", "Roublard", "Sacrieur", "Sadida",
    "Sram", "Steamer", "Xélor", "Zobal",
];

// ============================================
// RATE LIMIT (simple in-memory, per Discord user)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (entry.count >= maxRequests) return false;

    entry.count++;
    return true;
}

/** Returns remaining wait seconds (0 = not rate-limited) */
function getRateLimitRemaining(key: string, maxRequests: number, windowMs: number): number {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return 0;
    }

    if (entry.count >= maxRequests) {
        return Math.ceil((entry.resetAt - now) / 1000);
    }

    entry.count++;
    return 0;
}

// ============================================
// HELPERS
// ============================================

async function findUserByDiscordId(discordId: string) {
    return db.account.findFirst({
        where: { provider: "discord", providerAccountId: discordId },
        select: { userId: true },
    });
}

export async function POST(request: NextRequest) {
    try {
        const bodyText = await request.text();
        const isValid = await verifyDiscordSignature(request, bodyText);

        if (!isValid) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(bodyText);

        // 1. Handle Ping
        if (payload.type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 2. Handle Component Interaction (Button click)
        if (payload.type === 3) {
            const { custom_id } = payload.data;
            const { member, guild_id } = payload;

            // Rate limit: 10 interactions per 60s per discord user
            if (!checkRateLimit(`interaction:${member.user.id}`, 10, 60_000)) {
                return NextResponse.json({
                    type: 4,
                    data: { content: "⏳ Tu fais trop de requêtes. Réessaie dans quelques secondes.", flags: 64 },
                });
            }

            const [prefix, action, entityId] = custom_id.split(":");

            const account = await findUserByDiscordId(member.user.id);
            if (!account && prefix !== "ticket") {
                return NextResponse.json({
                    type: 4,
                    data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site pour utiliser ce bouton.", flags: 64 },
                });
            }

            // =============================================================
            // RBAC Permission Gate (centralized for ALL Discord interactions)
            // --
            // Maps interaction prefix → required permission.
            // When adding a NEW MODULE with Discord buttons:
            //   1. Add the permission constant in lib/permissions.ts
            //   2. Add an entry here: "prefix": PERMISSIONS.XXX
            //   3. Handle the prefix logic below (join/leave/etc.)
            // Owners and Discord admins bypass automatically (see internalCheckPermission).
            // =============================================================
            const { internalCheckPermission } = await import("@/server/actions/user-actions");
            const { PERMISSIONS } = await import("@/lib/permissions");

            const DISCORD_PERM_MAP: Record<string, string> = {
                calendar: PERMISSIONS.COMMUNITY_ACCESS,   // Calendrier = participation sociale
                songes: PERMISSIONS.GAME_OPERATIONS,      // Songes = organisation d'activités
                dj: PERMISSIONS.GAME_OPERATIONS,          // Donjons = organisation d'activités
                poll: PERMISSIONS.COMMUNITY_ACCESS,       // Sondages = participation sociale
                svc: PERMISSIONS.GAME_OPERATIONS,         // Services = organisation d'activités
            };

            const requiredPerm = DISCORD_PERM_MAP[prefix];
            if (requiredPerm) {
                const isAuthorized = await internalCheckPermission(guild_id, member.user.id, requiredPerm as any);
                if (!isAuthorized) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "🚫 Tes rôles Discord ne t'autorisent pas à utiliser cette fonctionnalité. Contacte un admin de ta guilde.",
                            flags: 64,
                        },
                    });
                }
            }

            let result;

            if (prefix === "calendar") {
                if (action === "join") {
                    const { processRegistration } = await import("@/server/calendar-service");
                    result = await processRegistration(guild_id, entityId, account!.userId);
                } else if (action === "leave") {
                    const { processUnregistration } = await import("@/server/calendar-service");
                    result = await processUnregistration(guild_id, entityId, account!.userId);
                }
            } else if (prefix === "songes") {
                if (action === "join") {
                    // Open a Modal for class selection + optional message
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `songes:apply:${entityId}`,
                            title: "📩 Candidature Run Songes",
                            components: [
                                {
                                    type: 1, // Action Row
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "classe",
                                            label: "Ta classe Dofus",
                                            style: 1, // Short
                                            placeholder: "Ex: Cra, Iop, Eniripsa...",
                                            required: true,
                                            min_length: 2,
                                            max_length: 30,
                                        },
                                    ],
                                },
                                {
                                    type: 1, // Action Row 
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "message",
                                            label: "Message (optionnel)",
                                            style: 2, // Paragraph
                                            placeholder: "Ex: Cra opti dispo 21h",
                                            required: false,
                                            max_length: 200,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "leave") {
                    const { processRunLeave } = await import("@/server/songes-service");
                    result = await processRunLeave(guild_id, entityId, account!.userId);
                }
            } else if (prefix === "poll") {
                if (action === "vote") {
                    const { processPollVote } = await import("@/server/actions/poll-actions");

                    // RBAC already checked by centralized gate above (PERMISSIONS.COMMUNITY_ACCESS)
                    const profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: account!.userId, guildId: guild_id } }
                    });

                    if (!profile) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 },
                        });
                    }

                    result = await processPollVote(guild_id, profile.id, entityId);

                    if (result.success) {
                        const actionLabel = result.data?.action === "voted" ? "enregistré" : "retiré";
                        return NextResponse.json({
                            type: 4,
                            data: { content: `✅ Ton vote a été ${actionLabel} avec succès !`, flags: 64 },
                        });
                    }
                }
            } else if (prefix === "dj") {
                // Rate limit spécifique DJ : 3 actions (join/leave) par post par user / 30s
                const djKey = `dj:${member.user.id}:${entityId}`;
                const waitSecs = getRateLimitRemaining(djKey, 3, 30_000);
                if (waitSecs > 0) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `⏳ Doucement ! Réessaie dans **${waitSecs}s**.`, flags: 64 },
                    });
                }

                if (action === "join" || action === "leave") {
                    // Récupérer le post pour obtenir le guildId Prisma interne (≠ Discord guild_id snowflake)
                    const post = await (db as any).djSearchPost.findUnique({
                        where: { id: entityId },
                        select: { id: true, status: true, guildId: true },
                    });

                    if (!post) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Ce groupe n'existe plus ou a expiré.", flags: 64 },
                        });
                    }

                    if (post.status !== "OPEN" && post.status !== "FULL") {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Ce groupe est fermé.", flags: 64 },
                        });
                    }

                    // Chercher le profil via post.guildId (CUID Prisma), PAS via guild_id (Discord snowflake)
                    const profile = await db.userProfile.findFirst({
                        where: { userId: account!.userId, guildId: post.guildId },
                    });

                    if (!profile) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 },
                        });
                    }

                    if (action === "join") {
                        const { internalJoinDjPost } = await import("@/server/actions/dungeon-finder-actions");
                        result = await internalJoinDjPost(entityId, profile.id, account!.userId);

                        if (result?.success) {
                            return NextResponse.json({
                                type: 4,
                                data: { content: "✅ Tu as rejoint le groupe ! Retrouve les détails sur le site.", flags: 64 },
                            });
                        }
                    } else if (action === "leave") {
                        const { internalLeaveDjPost } = await import("@/server/actions/dungeon-finder-actions");
                        result = await internalLeaveDjPost(entityId, profile.id);

                        if (result?.success) {
                            return NextResponse.json({
                                type: 4,
                                data: { content: "👋 Tu as quitté le groupe.", flags: 64 },
                            });
                        }
                    }
                }
            } else if (prefix === "svc") {
                if (action === "contact") {
                    const { internalContactService } = await import("@/server/actions/service-actions");
                    result = await internalContactService(entityId, "", account!.userId);

                    if (result?.success && result.data) {
                        const lines = [`📩 **Prestataire :** ${result.data.pseudo}`];
                        if (result.data.contactMethod) lines.push(`📌 **Contact :** ${result.data.contactMethod}`);
                        lines.push(`\n_Envoie-lui un MP Discord ou en jeu pour organiser le service !_`);
                        return NextResponse.json({
                            type: 4,
                            data: { content: lines.join("\n"), flags: 64 },
                        });
                    }
                }
            } else if (prefix === "validate") {
                // =========================================================
                // VALIDATE / REJECT — Mission, Achievement, KamaDonation
                // custom_id: validate:{type}:{entityId}:{discordGuildId}
                //         or validate:{type}_reject:{entityId}:{discordGuildId}
                // =========================================================
                const isReject = action.endsWith("_reject");
                const entityType = isReject ? action.replace("_reject", "") : action; // "mission" | "achievement" | "kama"
                // custom_id format: validate:{type}[:_reject]:{entityId}:{discordGuildId}
                const parts = custom_id.split(":");
                const entityId = parts[2];
                const targetGuildId = parts[3];

                // Permission check (MISSIONS_VALIDATE required)
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                const isValidator = await internalCheckPermission(targetGuildId, member.user.id, PERMISSIONS.MISSIONS_OFFICER);
                if (!isValidator) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "🚫 Tu n'as pas la permission de valider des preuves.", flags: 64 },
                    });
                }

                // ACK immediately (defer update) — gives us 15 min to respond
                // We'll use type 7 (update message) after processing

                const { internalValidateMissionSubmission, internalValidateAchievementSubmission, internalReviewKamaDonation } =
                    await import("@/server/actions/discord-validation-actions");

                let resultMsg = "";
                const adminTag = `${member.user.username}`;

                if (entityType === "mission") {
                    const status = isReject ? "REJECTED" : "VALIDATED";
                    const res = await internalValidateMissionSubmission(entityId, status, targetGuildId, member.user.id);
                    if (res.success) {
                        resultMsg = isReject
                            ? `❌ Mission **refusée** par ${adminTag} — Membre: **${res.memberName}** — **${res.missionTitle}**`
                            : `✅ Mission **validée** par ${adminTag} — Membre: **${res.memberName}** — **${res.missionTitle}**`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else if (entityType === "achievement") {
                    const status = isReject ? "REJECTED" : "VALIDATED";
                    const res = await internalValidateAchievementSubmission(entityId, status, targetGuildId, member.user.id);
                    if (res.success) {
                        resultMsg = isReject
                            ? `❌ Succès **refusé** par ${adminTag} — Membre: **${res.memberName}**`
                            : `✅ **${res.points} pts succès** validés par ${adminTag} — Membre: **${res.memberName}**`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else if (entityType === "kama") {
                    const action_kama = isReject ? "REJECT" : "VALIDATE";
                    const res = await internalReviewKamaDonation(entityId, action_kama, targetGuildId, member.user.id);
                    if (res.success) {
                        const amountStr = res.amount?.toLocaleString("fr-FR") ?? "?";
                        resultMsg = isReject
                            ? `❌ Don **refusé** par ${adminTag} — Membre: **${res.memberName}** — ${amountStr} kamas`
                            : `✅ Don **validé** par ${adminTag} — Membre: **${res.memberName}** — ${amountStr} kamas`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else if (entityType === "reactivation") {
                    const status = isReject ? "ARCHIVED" : "ACTIVE";
                    const { updateMemberProfileStatus } = await import("@/server/actions/user-actions");
                    
                    try {
                        await updateMemberProfileStatus(entityId, status, isReject ? "REACTIVATION_REJECTED" : "REACTIVATION_APPROVED");
                        resultMsg = isReject
                            ? `❌ Demande de **réintégration refusée** par ${adminTag}`
                            : `✅ Demande de **réintégration validée** par ${adminTag}`;
                    } catch (err: any) {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${err.message}`, flags: 64 } });
                    }
                } else {
                    return NextResponse.json({ type: 4, data: { content: "Type de validation inconnu.", flags: 64 } });
                }

                // Réponse éphémère à l'admin (l'embed a été supprimé par internalValidate*)
                return NextResponse.json({
                    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE (éphémère)
                    data: {
                        content: resultMsg,
                        flags: 64, // EPHEMERAL — visible uniquement par l'admin qui a cliqué
                        components: [],
                    },
                });

            } else if (prefix === "ticket") {
                // =========================================================
                // TICKET SYSTEM V2 — 2-step flow: Select Menu → Adapted Modal
                // =========================================================
                if (action === "open") {
                    // RATE LIMIT: 1 ticket every 10 seconds per user
                    const waitSec = getRateLimitRemaining(`ticket:${member.user.id}`, 1, 10_000);
                    if (waitSec > 0) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `⏳ Vous avez atteint la limite. Réessayez dans **${waitSec}s**.`, flags: 64 },
                        });
                    }
                    // Step 1: Send ephemeral message with category Select Menu
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "🎫 **Ouvrir un ticket** — Choisissez la catégorie qui correspond à votre demande :",
                            flags: 64, // EPHEMERAL
                            components: [
                                {
                                    type: 1, // ACTION_ROW
                                    components: [
                                        {
                                            type: 3, // STRING_SELECT
                                            custom_id: `ticket:select:${entityId}`,
                                            placeholder: "Sélectionnez une catégorie...",
                                            min_values: 1,
                                            max_values: 1,
                                            options: [
                                                {
                                                    label: "Demande d'accès",
                                                    value: "ACCESS_REQUEST",
                                                    description: "Rejoindre SigilOS pour votre guilde",
                                                    emoji: { name: "🔑" },
                                                },
                                                {
                                                    label: "Signaler un bug",
                                                    value: "BUG_REPORT",
                                                    description: "Un problème sur le dashboard ou le bot",
                                                    emoji: { name: "🐛" },
                                                },
                                                {
                                                    label: "Proposer une feature",
                                                    value: "FEATURE_REQUEST",
                                                    description: "Suggérer une amélioration",
                                                    emoji: { name: "💡" },
                                                },
                                                {
                                                    label: "Autre / Question",
                                                    value: "OTHER",
                                                    description: "Question générale",
                                                    emoji: { name: "📩" },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "select") {
                    // Step 2: User selected a category from dropdown → open adapted modal
                    const selectedCategory = payload.data?.values?.[0] || "OTHER";

                    const categoryLabels: Record<string, string> = {
                        ACCESS_REQUEST: "🔑 Demande d'accès",
                        BUG_REPORT: "🐛 Signaler un bug",
                        FEATURE_REQUEST: "💡 Proposer une feature",
                        OTHER: "📩 Autre demande",
                    };

                    // [DUP-CHECK] Verify user doesn't have an active ticket in this category
                    const existingTicket = await db.supportTicket.findFirst({
                        where: {
                            creatorDiscordId: member.user.id,
                            category: selectedCategory as any,
                            status: { not: "CLOSED" },
                        },
                        select: { ticketNumber: true }
                    });

                    if (existingTicket) {
                        return NextResponse.json({
                            type: 4,
                            data: { 
                                content: `⚠️ Tu as déjà un ticket ouvert pour la catégorie **${categoryLabels[selectedCategory] || selectedCategory}**.\n\nFerme ton ticket **#${existingTicket.ticketNumber}** avant d'en ouvrir un nouveau.`, 
                                flags: 64 
                            },
                        });
                    }

                    // Build modal fields based on category
                    const modalComponents: any[] = [];

                    if (selectedCategory === "ACCESS_REQUEST") {
                        // Discord modals allow max 5 action rows
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "discord_guild_id",
                                    label: "ID de votre serveur Discord",
                                    style: 1, placeholder: "Ex: 1234567890123456789 (17-20 chiffres)",
                                    required: true, min_length: 17, max_length: 20,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "guild_name",
                                    label: "Nom de votre guilde Dofus",
                                    style: 1, placeholder: "Uniquement des lettres (Ex: Les Gardiens)",
                                    required: true, min_length: 2, max_length: 50,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "pseudo_dofus",
                                    label: "Votre pseudo Dofus",
                                    style: 1, placeholder: "Uniquement des lettres (Ex: Klyx)",
                                    required: true, min_length: 2, max_length: 30,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "member_count",
                                    label: "Nombre de membres",
                                    style: 1, placeholder: "Entre 1 et 500 (chiffres uniquement)",
                                    required: true, min_length: 1, max_length: 3,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Pourquoi souhaitez-vous utiliser SigilOS ?",
                                    style: 2, placeholder: "Décrivez brièvement votre guilde et vos besoins...",
                                    required: true, min_length: 10, max_length: 1000,
                                }],
                            },
                        );
                    } else if (selectedCategory === "BUG_REPORT") {
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Description courte du bug",
                                    style: 1, placeholder: "Ex: Les missions ne s'affichent plus",
                                    required: true, min_length: 5, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "page",
                                    label: "Page / Fonctionnalité concernée",
                                    style: 1, placeholder: "Ex: Dashboard > Missions, Bot Discord, Landing page...",
                                    required: true, min_length: 3, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Étapes pour reproduire + détails",
                                    style: 2, placeholder: "1. Je clique sur...\n2. Je vois...\n3. Comportement attendu vs réel",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    } else if (selectedCategory === "FEATURE_REQUEST") {
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Titre de la fonctionnalité",
                                    style: 1, placeholder: "Ex: Système de classement PvP",
                                    required: true, min_length: 5, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Description détaillée de votre idée",
                                    style: 2, placeholder: "Décrivez la fonctionnalité, son utilité, et comment vous l'imaginez...",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    } else {
                        // OTHER
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Sujet",
                                    style: 1, placeholder: "De quoi s'agit-il ?",
                                    required: true, min_length: 3, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Votre message",
                                    style: 2, placeholder: "Détaillez votre demande...",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    }

                    const categoryTitles: Record<string, string> = {
                        ACCESS_REQUEST: "🔑 Demande d'accès",
                        BUG_REPORT: "🐛 Signaler un bug",
                        FEATURE_REQUEST: "💡 Proposer une feature",
                        OTHER: "📩 Autre demande",
                    };

                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `ticket:create:${entityId}:${selectedCategory}`,
                            title: categoryTitles[selectedCategory] || "📩 Ticket",
                            components: modalComponents,
                        },
                    });
                } else if (action === "close") {
                    // SECURE: Check if caller is dev/admin synchronously 
                    // before acknowledging to give proper feedback if rejected.
                    const { isDiscordSuperAdmin } = await import("@/server/actions/super-admin-actions");
                    const isDev = await isDiscordSuperAdmin(member.user.id);
                    
                    if (!isDev) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "🔒 Seule l'équipe technique SigilOS peut fermer ce ticket.", flags: 64 },
                        });
                    }

                    // ACK immediately (Deferred update)
                    const response = NextResponse.json({ type: 6 }); 

                    // Background heavy lifting
                    const { closeSupportTicket } = await import("@/server/actions/ticket-actions");
                    closeSupportTicket(
                        entityId,
                        member.user.id,
                        member.user.global_name || member.user.username
                    ).catch(err => console.error("Discord Close Error:", err));

                    return response;
                }
            } else {
                return NextResponse.json({ type: 4, data: { content: "Interaction inconnue", flags: 64 } });
            }

            if (result?.success) {
                // DJ interactions: give ephemeral feedback
                if (prefix === "dj") {
                    const label = action === "join" ? "✅ Tu as rejoint le groupe !" : "👋 Tu as quitté le groupe.";
                    return NextResponse.json({
                        type: 4,
                        data: { content: label, flags: 64 },
                    });
                }
                return NextResponse.json({ type: 6 }); // ACK silencieux (others)
            } else {
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ ${result?.error || "Erreur inconnue"}`, flags: 64 },
                });
            }
        }

        // 3. Handle Modal Submit (Songes candidature form)
        if (payload.type === 5) {
            const { custom_id, components } = payload.data;
            const { member, guild_id } = payload;

            const [prefix, action, entityId] = custom_id.split(":");

            // Rate limit: 5 modal submits per 5min per discord user
            if (!checkRateLimit(`modal:${member.user.id}`, 5, 5 * 60_000)) {
                return NextResponse.json({
                    type: 4,
                    data: { content: "⏳ Trop de candidatures. Réessaie dans quelques minutes.", flags: 64 },
                });
            }

            if (prefix === "songes" && action === "apply") {
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site.", flags: 64 },
                    });
                }

                // RBAC check for modal submits (same gate as button clicks)
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                const canJoinSonges = await internalCheckPermission(guild_id, member.user.id, PERMISSIONS.GAME_OPERATIONS);
                if (!canJoinSonges) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "🚫 Tes rôles Discord ne t'autorisent pas à postuler aux Songes. Contacte un admin de ta guilde.",
                            flags: 64,
                        },
                    });
                }

                // Extract modal fields
                let classe = "";
                let message = "";

                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "classe") classe = comp.value?.trim() || "";
                        if (comp.custom_id === "message") message = comp.value?.trim() || "";
                    }
                }

                // Validate class - try to match against known classes (case-insensitive)
                const matchedClass = VALID_CLASSES.find(
                    c => c.toLowerCase() === classe.toLowerCase()
                );

                if (!matchedClass) {
                    const classesList = VALID_CLASSES.join(", ");
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `❌ Classe « ${classe} » non reconnue.\n\n**Classes disponibles :** ${classesList}`,
                            flags: 64,
                        },
                    });
                }

                // Create candidature via service
                const { processRunJoin } = await import("@/server/songes-service");
                const result = await processRunJoin(guild_id, entityId, account.userId, matchedClass, message);

                if (result?.success) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `✅ Candidature envoyée ! Classe: **${matchedClass}**${message ? `\nMessage: *${message}*` : ""}\n\nLe leader de la run sera notifié.`,
                            flags: 64,
                        },
                    });
                } else {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${result?.error || "Erreur inconnue"}`, flags: 64 },
                    });
                }
            }

            // =========================================================
            // TICKET CREATION V2 (from category-adapted modal submit)
            // custom_id format: ticket:create:{guildId}:{category}
            // =========================================================
            if (prefix === "ticket" && action === "create") {
                // V2: Category is in the 4th part of custom_id
                const parts = custom_id.split(":");
                const ticketGuildId = parts[2] || guild_id;
                const ticketCategory = (parts[3] || "OTHER") as "ACCESS_REQUEST" | "BUG_REPORT" | "FEATURE_REQUEST" | "OTHER";

                // Extract all possible fields from modal
                const fields: Record<string, string> = {};
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id && comp.value) {
                            fields[comp.custom_id] = comp.value.trim();
                        }
                    }
                }

                // Build subject and description based on category
                let targetMeta: any = {};
                let subject = "";
                let description = "";

                if (ticketCategory === "ACCESS_REQUEST") {
                    // 1. Validate Discord Guild ID
                    const discordGuildIdInput = fields.discord_guild_id || "";
                    if (!/^\d{17,20}$/.test(discordGuildIdInput)) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "❌ L'ID de serveur Discord est invalide (17-20 chiffres).\n💡 Clic droit sur votre serveur -> Copier l'identifiant.",
                                flags: 64,
                            },
                        });
                    }

                    // 2. Validate Names (STRICT: Letters and spaces only)
                    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/; // Added hyphen and apostrophe
                    const guildName = fields.guild_name || "";
                    const pseudoDofus = fields.pseudo_dofus || "";

                    if (!nameRegex.test(guildName)) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le nom de guilde ne doit contenir que des lettres (pas de chiffres ou caractères spéciaux).", flags: 64 },
                        });
                    }
                    if (!nameRegex.test(pseudoDofus)) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le pseudo Dofus ne doit contenir que des lettres (pas de chiffres ou caractères spéciaux).", flags: 64 },
                        });
                    }

                    // 3. Validate Member Count
                    const memberCountRaw = fields.member_count || "";
                    const count = parseInt(memberCountRaw, 10);
                    if (isNaN(count) || count < 1 || count > 500) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le nombre de membres doit être un chiffre entre 1 et 500.", flags: 64 },
                        });
                    }

                    targetMeta = {
                        targetGuildId: discordGuildIdInput,
                        targetGuildName: guildName,
                        targetGuildMemberCount: count,
                    };

                    subject = `Accès — ${guildName} (${pseudoDofus})`;
                    description = [
                        `🔹 **Serveur Discord :** \`${discordGuildIdInput}\``,
                        `🏰 **Guilde :** ${guildName}`,
                        `👤 **Leader :** ${pseudoDofus}`,
                        `👥 **Membres :** ${count}`,
                        "",
                        `📝 **Message :**`,
                        fields.description || "Aucune description",
                    ].join("\n");
                } else if (ticketCategory === "BUG_REPORT") {
                    subject = fields.subject || "Bug sans titre";
                    description = [
                        `📍 **Page/Feature :** ${fields.page || "Non précisé"}`,
                        "",
                        `🔍 **Détails :**`,
                        fields.description || "Aucune description",
                    ].join("\n");
                } else {
                    subject = fields.subject || "Ticket sans titre";
                    description = fields.description || "Aucune description";
                }

                // Get channel for thread creation
                const channelId = payload.channel_id || payload.channel?.id;
                if (!channelId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Impossible de déterminer le salon.", flags: 64 },
                    });
                }

                const { createSupportTicket } = await import("@/server/actions/ticket-actions");
                const ticketResult = await createSupportTicket({
                    channelId,
                    discordGuildId: ticketGuildId,
                    category: ticketCategory,
                    subject,
                    description,
                    creatorDiscordId: member.user.id,
                    creatorDiscordName: member.user.global_name || member.user.username,
                    ...targetMeta,
                });

                if (ticketResult.success) {
                    // AUTO-PROVISION: For ACCESS_REQUEST, auto-create AllowedGuild as PENDING
                    if (ticketCategory === "ACCESS_REQUEST" && fields.discord_guild_id) {
                        try {
                            const existingGuild = await db.allowedGuild.findUnique({
                                where: { discordGuildId: fields.discord_guild_id },
                            });
                            if (!existingGuild) {
                                await db.allowedGuild.create({
                                    data: {
                                        discordGuildId: fields.discord_guild_id,
                                        name: fields.guild_name || null,
                                        tier: "PENDING",
                                        isActive: false,
                                        addedBy: member.user.id,
                                        notes: `[AUTO] Ticket #${ticketResult.ticketNumber} — ${fields.pseudo_dofus || "?"} — En attente d'approbation`,
                                    },
                                });
                            }
                        } catch (e) {
                            // Non-blocking: if auto-provision fails, ticket is still created
                            console.error("[Tickets] Auto-provision AllowedGuild failed:", e);
                        }
                    }

                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `✅ Ticket **#${ticketResult.ticketNumber}** créé ! Un fil privé a été ouvert — regarde dans tes fils.`,
                            flags: 64,
                        },
                    });
                } else {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${ticketResult.error}`, flags: 64 },
                    });
                }
            }

            return NextResponse.json({ type: 4, data: { content: "Modal inconnu", flags: 64 } });
        }

        // 4. Handle Slash Command (/status)
        if (payload.type === 2) {
            const { name } = payload.data;

            if (name === "status") {
                try {
                    const baseUrl = getAppBaseUrl();
                    const healthRes = await fetch(`${baseUrl}/api/health`);
                    const health = await healthRes.json();

                    const statusEmoji = health.status === "healthy" ? "🟢" : health.status === "degraded" ? "🟡" : "🔴";
                    const dbStatus = health.services.database.status === "up" ? "🟢 Opérationnel" : "🔴 Hors ligne";
                    const redisStatus = health.services.redis.status === "up" ? "🟢 Opérationnel" :
                        health.services.redis.status === "not_configured" ? "⚪ Non configuré" : "🔴 Hors ligne";

                    return NextResponse.json({
                        type: 4,
                        data: {
                            embeds: [{
                                title: "🏰 SigilOS Status",
                                color: health.status === "healthy" ? 0x10b981 : health.status === "degraded" ? 0xf59e0b : 0xef4444,
                                fields: [
                                    { name: "État Global", value: `${statusEmoji} ${health.status === "healthy" ? "Opérationnel" : health.status === "degraded" ? "Dégradé" : "Critique"}`, inline: false },
                                    { name: "Base de données", value: `${dbStatus}${health.services.database.latency ? ` (${health.services.database.latency}ms)` : ""}`, inline: true },
                                    { name: "Cache Redis", value: `${redisStatus}${health.services.redis.latency ? ` (${health.services.redis.latency}ms)` : ""}`, inline: true },
                                ],
                                footer: { text: `Version: ${health.version || "unknown"}` },
                                timestamp: new Date().toISOString()
                            }]
                        }
                    });
                } catch (error) {
                    console.error("[Discord Status Command] Error:", error);
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Impossible de récupérer le statut.", flags: 64 }
                    });
                }
            }

            return NextResponse.json({ type: 4, data: { content: "Commande inconnue", flags: 64 } });
        }

        return NextResponse.json({ error: "Unknown type" }, { status: 400 });

    } catch (error) {
        console.error("[Discord Interaction] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

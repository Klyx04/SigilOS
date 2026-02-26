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
            if (!account) {
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
                calendar: PERMISSIONS.CALENDAR_VIEW,
                songes: PERMISSIONS.SONGES_JOIN,
                dj: PERMISSIONS.FINDER_VIEW,
                poll: PERMISSIONS.POLLS_VIEW,
                // 🆕 Future modules: add entry here
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
                    result = await processRegistration(guild_id, entityId, account.userId);
                } else if (action === "leave") {
                    const { processUnregistration } = await import("@/server/calendar-service");
                    result = await processUnregistration(guild_id, entityId, account.userId);
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
                    result = await processRunLeave(guild_id, entityId, account.userId);
                }
            } else if (prefix === "poll") {
                if (action === "vote") {
                    const { processPollVote } = await import("@/server/actions/poll-actions");

                    // RBAC already checked by centralized gate above (PERMISSIONS.POLLS_VIEW)
                    const profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: account.userId, guildId: guild_id } }
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
                        where: { userId: account.userId, guildId: post.guildId },
                    });

                    if (!profile) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 },
                        });
                    }

                    if (action === "join") {
                        const { internalJoinDjPost } = await import("@/server/actions/dungeon-finder-actions");
                        result = await internalJoinDjPost(entityId, profile.id, account.userId);

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
                const canJoinSonges = await internalCheckPermission(guild_id, member.user.id, PERMISSIONS.SONGES_JOIN);
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

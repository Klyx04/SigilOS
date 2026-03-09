"use server";

/**
 * Songes Module - Server Actions
 * CRUD operations for Dream Runs
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { createNotification } from "@/server/actions/notification-actions";
import { sendChannelMessage } from "@/server/discord";
import { rateLimit } from "@/lib/ratelimit";

// ============================================
// CONSTANTS & HELPERS
// ============================================

const JOIN_REQUEST_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Clean up expired join requests (Auto-Reject)
 * Called lazily when data is accessed
 */
async function cleanupExpiredRequests(guildId: string) {
    const expirationThreshold = new Date(Date.now() - JOIN_REQUEST_TTL_MS);

    // Find expired pending requests
    const expiredRequests = await db.dreamJoinRequest.findMany({
        where: {
            run: { guildId },
            status: "PENDING",
            createdAt: { lt: expirationThreshold },
        },
        include: { run: true },
    });

    if (expiredRequests.length === 0) return;

    // Process each expired request
    for (const req of expiredRequests) {
        // 1. Mark as REJECTED
        await db.dreamJoinRequest.update({
            where: { id: req.id },
            data: {
                status: "REJECTED",
                respondedAt: new Date(),
            },
        });

        // 2. Notify the user
        await createNotification(
            req.userId,
            "SYSTEM_INFO",
            "Candidature expirée",
            `Votre candidature pour la run ${req.run.difficulty} a expiré (aucune réponse du leader sous 10 minutes).`,
            `/dashboard/${guildId}/songes`,
            guildId
        );
    }
}

// ============================================
// CONTEXT HELPER
// ============================================

async function getGuildUserContext(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.id || !ctx.isMember) return null;

    return {
        ...ctx,
        userId: ctx.id,
        guildId: guildId, // This is the Discord Guild ID
    };
}

// ============================================
// SCHEMAS
// ============================================

const CreateRunSchema = z.object({
    difficulty: z.enum([
        "REVE_I", "REVE_II", "REVE_III",
        "PARADOXE_I", "PARADOXE_II", "PARADOXE_III", "PARADOXE_IV",
        "CAUCHEMAR_I", "CAUCHEMAR_II", "CAUCHEMAR_III"
    ]),
    objectives: z.array(z.enum([
        "MISSION_GUILDE", "DROP_LEGENDE", "SUCCES_NO_ACHAT", "FUN", "QUETE"
    ])).min(1, "Sélectionnez au moins un objectif"),
    publishToDiscord: z.boolean().optional(),
    epreuveCode: z.string().optional(), // Code épreuve (FONSOCAC, REVERSED, etc.) — null = run standard
}).refine((data) => {
    if (data.epreuveCode) return true; // Épreuve bypasse la restriction objectifs
    const isParadoxeOrHigher = data.difficulty.startsWith("PARADOXE") || data.difficulty.startsWith("CAUCHEMAR");
    const restrictedObjectives = ["DROP_LEGENDE", "SUCCES_NO_ACHAT"];
    if (!isParadoxeOrHigher) {
        const hasRestricted = data.objectives.some(o => restrictedObjectives.includes(o));
        if (hasRestricted) return false;
    }
    return true;
}, {
    message: "Certains objectifs nécessitent une difficulté Paradoxe ou plus.",
    path: ["objectives"]
});

const AddFloorSchema = z.object({
    runId: z.string(),
    floorNumber: z.number().min(0).max(26), // Allow 0 for reset/entry
    roomType: z.enum(["COMBAT", "FONTAINE", "FAVEUR", "BOSS", "ENTREE"]),
    difficulty: z.number().min(1).max(60).optional(),
    pointsReveGained: z.number().min(0).default(0),
});

const AddBonusSchema = z.object({
    runId: z.string(),
    bonusName: z.string(),
    bonusType: z.string(),
    bonusRarete: z.string(),
    cost: z.number().min(0),
});

const DeleteBonusSchema = z.object({
    runId: z.string(),
    bonusId: z.string(),
});

const SetRoomSchema = z.object({
    runId: z.string(),
    roomNumber: z.number().min(0).max(26),
});

// ============================================
// CREATE RUN
// ============================================

export async function createDreamRun(guildId: string, data: z.infer<typeof CreateRunSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const validated = CreateRunSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0].message };
    }

    // RATE LIMIT: 3 créations par 10 minutes
    // 🛠️ Dev bypass : RATE_LIMIT_BYPASS_DISCORD_IDS (IDs Discord séparés par virgule)
    const bypassDiscordIds = (process.env.RATE_LIMIT_BYPASS_DISCORD_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    let isRateLimitBypassed = false;
    if (bypassDiscordIds.length > 0) {
        const account = await db.account.findFirst({
            where: { userId: ctx.userId, provider: "discord" },
            select: { providerAccountId: true },
        });
        isRateLimitBypassed = bypassDiscordIds.includes(account?.providerAccountId ?? "");
    }
    if (!isRateLimitBypassed) {
        const limiter = await rateLimit(`create_dream_run:${ctx.userId}:${guildId}`, 3, 10 * 60 * 1000);
        if (!limiter.success) return { success: false, error: "Trop de runs créées. Veuillez patienter.", resetAt: limiter.reset };
    }

    // Rule: A leader can only have one active run
    const existingRun = await db.dreamRun.findFirst({
        where: {
            guildId: ctx.guildId,
            leaderId: ctx.userId,
            status: { in: ["RECRUITING", "IN_PROGRESS"] },
        },
    });

    if (existingRun) {
        return { success: false, error: "Vous avez déjà une run active" };
    }

    const run = await db.dreamRun.create({
        data: {
            guildId: ctx.guildId,
            leaderId: ctx.userId,
            difficulty: validated.data.difficulty,
            objectives: validated.data.objectives,
            objective: validated.data.objectives[0], // Init legacy field
            epreuveCode: validated.data.epreuveCode ?? null,
            members: {
                create: {
                    userId: ctx.userId,
                    slot: 1, // Leader takes slot 1
                },
            },
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);

    // Publish to Discord if requested
    if (validated.data.publishToDiscord) {
        const { publishDiscordRun } = await import("@/server/songes-service");
        await publishDiscordRun(ctx.guildId, run.id);
    }

    try {
        const { pushSystemChatMessage } = await import("@/server/actions/chat-actions");
        const leaderName = ctx.name || "Un explorateur";
        await pushSystemChatMessage(
            ctx.guildId,
            `🌌 **${leaderName}** a lancé une expédition Songes Infinis (${run.difficulty.replace("_", " ")}) !`,
            { type: "songes_run_created", runId: run.id }
        );
    } catch (chatErr) {
        console.error("Failed to push system chat message for songes run", chatErr);
    }

    return { success: true, runId: run.id };
}

// ============================================
// GET RUNS
// ============================================

export async function getDreamRuns(guildId: string, statusFilter?: string[]) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé", runs: [] };

    // Cleanup is now handled by the BullMQ worker (daily job)

    const runs = await db.dreamRun.findMany({
        where: {
            guildId: ctx.guildId,
            ...(statusFilter && { status: { in: statusFilter as ("RECRUITING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "ABANDONED")[] } }),
        },
        include: {
            members: {
                orderBy: { slot: "asc" },
            },
            waitlist: {
                orderBy: { position: "asc" },
            },
            joinRequests: {
                where: { status: "PENDING" },
                select: { id: true, userId: true },
            },
            _count: {
                select: { floors: true, bonuses: true },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Limit to last 50 runs for performance
    });

    return { success: true, runs };
}

export async function getDreamRunById(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé", run: null };

    // Cleanup is now handled by the BullMQ worker (daily job)

    const run = await db.dreamRun.findFirst({
        where: {
            id: runId,
            guildId: ctx.guildId,
        },
        include: {
            members: {
                orderBy: { slot: "asc" },
            },
            waitlist: {
                orderBy: { position: "asc" },
            },
            floors: {
                orderBy: { floorNumber: "asc" },
            },
            bonuses: {
                orderBy: { acquiredAt: "asc" },
            },
        },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée", run: null };
    }

    return { success: true, run };
}

// ============================================
// JOIN / LEAVE RUN
// ============================================

export async function joinDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    if (!ctx.canJoinSonges) {
        return { success: false, error: "Non autorisé: permission requise pour rejoindre les Songes" };
    }

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
        include: { members: true, waitlist: true },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.status !== "RECRUITING") {
        return { success: false, error: "Cette run n'est plus en recrutement" };
    }

    // Check if already member
    if (run.members.some((m) => m.userId === ctx.userId)) {
        return { success: false, error: "Vous êtes déjà dans cette run" };
    }

    // Check if already in waitlist
    if (run.waitlist.some((w) => w.userId === ctx.userId)) {
        return { success: false, error: "Vous êtes déjà en file d'attente" };
    }

    // RATE LIMIT: Shared with sendJoinRequest (5 per 10 min)
    const limiter = await rateLimit(`join_request:${ctx.userId}:${guildId}`, 5, 10 * 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop d'actions. Veuillez réessayer plus tard." };

    // Find next available slot
    const usedSlots = run.members.map((m) => m.slot);
    const nextSlot = [1, 2, 3, 4].find((s) => !usedSlots.includes(s));

    if (nextSlot) {
        // Join directly
        try {
            await db.dreamRunMember.create({
                data: {
                    runId,
                    userId: ctx.userId,
                    slot: nextSlot,
                },
            });
        } catch (error: any) {
            // P2002: Unique constraint violation (Race condition on the slot)
            if (error.code === 'P2002') {
                return { success: false, error: "Ce slot vient tout juste d'être pris par un autre joueur. Veuillez réessayer." };
            }
            throw error; // Re-throw other unexpected errors
        }
    } else {
        // Add to waitlist
        const maxPosition = run.waitlist.length > 0
            ? Math.max(...run.waitlist.map((w) => w.position))
            : 0;

        await db.dreamWaitlist.create({
            data: {
                runId,
                userId: ctx.userId,
                position: maxPosition + 1,
            },
        });

        revalidatePath(`/dashboard/${ctx.guildId}/songes`);
        return { success: true, waitlisted: true };
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true, waitlisted: false };
}

export async function leaveDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
        include: { members: true, waitlist: true },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // If leader leaves, abandon the run
    if (run.leaderId === ctx.userId) {
        await db.dreamRun.update({
            where: { id: runId },
            data: { status: "ABANDONED", completedAt: new Date() },
        });

        revalidatePath(`/dashboard/${ctx.guildId}/songes`);
        return { success: true, runAbandoned: true };
    }

    // Remove from members
    const member = run.members.find((m) => m.userId === ctx.userId);
    if (member) {
        await db.dreamRunMember.delete({ where: { id: member.id } });

        // Promote first waitlisted user
        const firstWaitlisted = run.waitlist[0];
        if (firstWaitlisted) {
            await db.$transaction([
                db.dreamRunMember.create({
                    data: {
                        runId,
                        userId: firstWaitlisted.userId,
                        slot: member.slot,
                    },
                }),
                db.dreamWaitlist.delete({ where: { id: firstWaitlisted.id } }),
                // Update positions
                db.dreamWaitlist.updateMany({
                    where: { runId },
                    data: { position: { decrement: 1 } },
                }),
            ]);
        }

        revalidatePath(`/dashboard/${ctx.guildId}/songes`);

        // Update Discord embed if it exists
        const { updateDiscordRunEmbed } = await import("@/server/songes-service");
        await updateDiscordRunEmbed(ctx.guildId, runId);

        return { success: true };
    }

    // Remove from waitlist
    const waitlisted = run.waitlist.find((w) => w.userId === ctx.userId);
    if (waitlisted) {
        await db.$transaction([
            db.dreamWaitlist.delete({ where: { id: waitlisted.id } }),
            db.dreamWaitlist.updateMany({
                where: { runId, position: { gt: waitlisted.position } },
                data: { position: { decrement: 1 } },
            }),
        ]);

        revalidatePath(`/dashboard/${ctx.guildId}/songes`);
        return { success: true };
    }

    return { success: false, error: "Vous n'êtes pas dans cette run" };
}

// ============================================
// START / COMPLETE RUN
// ============================================

export async function startDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut démarrer la run" };
    }

    if (run.status !== "RECRUITING") {
        return { success: false, error: "Cette run ne peut pas être démarrée" };
    }

    await db.dreamRun.update({
        where: { id: runId },
        data: {
            status: "IN_PROGRESS",
            startedAt: new Date(),
            currentFloor: 1,
        },
    });

    // Update Discord embed to reflect "In Progress" status
    const { updateDiscordRunEmbed } = await import("@/server/songes-service");
    await updateDiscordRunEmbed(ctx.guildId, runId);

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

export async function completeDreamRun(guildId: string, runId: string, success: boolean) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut terminer la run" };
    }

    await db.dreamRun.update({
        where: { id: runId },
        data: {
            status: success ? "COMPLETED" : "FAILED",
            completedAt: new Date(),
        },
    });

    // Remove Discord embed as the run is over
    const { deleteDiscordRunEmbed } = await import("@/server/songes-service");
    await deleteDiscordRunEmbed(ctx.guildId, runId);

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// ADD FLOOR
// ============================================

export async function addDreamFloor(guildId: string, data: z.infer<typeof AddFloorSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const validated = AddFloorSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
    }

    const run = await db.dreamRun.findFirst({
        where: { id: validated.data.runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut ajouter des étages" };
    }

    // RATE LIMIT: 30 floors per 10 minutes
    const limiter = await rateLimit(`add_dream_floor:${ctx.userId}:${run.id}`, 30, 10 * 60 * 1000);
    if (!limiter.success) return { success: false, error: "Action trop rapide. Votre progression semble suspecte." };

    if (run.status !== "IN_PROGRESS") {
        return { success: false, error: "La run n'est pas en cours" };
    }

    // Create floor and update run
    await db.$transaction([
        db.dreamFloor.create({
            data: {
                runId: validated.data.runId,
                floorNumber: validated.data.floorNumber,
                roomType: validated.data.roomType,
                difficulty: validated.data.difficulty,
                pointsReveGained: validated.data.pointsReveGained,
            },
        }),
        db.dreamRun.update({
            where: { id: validated.data.runId },
            data: {
                currentFloor: validated.data.floorNumber,
                pointsReve: { increment: validated.data.pointsReveGained },
            },
        }),
    ]);

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// ADD BONUS
// ============================================

// ============================================
// ADD BONUS / DELETE BONUS
// ============================================

export async function deleteDreamBonus(guildId: string, data: z.infer<typeof DeleteBonusSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const validated = DeleteBonusSchema.safeParse(data);
    if (!validated.success) return { success: false, error: "Données invalides" };

    const run = await db.dreamRun.findFirst({
        where: { id: validated.data.runId, guildId: ctx.guildId },
    });

    if (!run) return { success: false, error: "Run non trouvée" };
    if (run.leaderId !== ctx.userId) return { success: false, error: "Seul le leader peut supprimer des bonus" };

    await db.dreamRunBonus.delete({
        where: { id: validated.data.bonusId }
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

export async function addDreamBonus(guildId: string, data: z.infer<typeof AddBonusSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const validated = AddBonusSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
    }

    const run = await db.dreamRun.findFirst({
        where: { id: validated.data.runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut acheter des bonus" };
    }

    // Simply add the bonus, no PR cost system
    await db.dreamRunBonus.create({
        data: {
            runId: validated.data.runId,
            bonusName: validated.data.bonusName,
            bonusType: validated.data.bonusType,
            bonusRarete: validated.data.bonusRarete,
            cost: 0,
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// JOIN REQUEST SYSTEM
// ============================================

const SendJoinRequestSchema = z.object({
    runId: z.string(),
    classe: z.string().min(1),
    message: z.string().optional(),
});

export async function sendJoinRequest(guildId: string, data: z.infer<typeof SendJoinRequestSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    // RATE LIMIT: 5 join requests per 10 minutes per user/guild
    const limiter = await rateLimit(`join_request:${ctx.userId}:${guildId}`, 5, 10 * 60 * 1000);
    if (!limiter.success) {
        return { success: false, error: "Trop de demandes. Veuillez réessayer plus tard." };
    }

    const validated = SendJoinRequestSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
    }

    // Security Check: Ensure user has the 'canJoinSonges' permission 
    if (!ctx.canJoinSonges) {
        return { success: false, error: "Non autorisé: permission requise pour rejoindre les Songes" };
    }

    // Find run by ID AND Guild ID (Isolation)
    const run = await db.dreamRun.findFirst({
        where: {
            id: validated.data.runId,
            guildId: ctx.guildId
        },
        include: { members: true },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Allow candidature for RECRUITING or IN_PROGRESS runs
    if (run.status !== "RECRUITING" && run.status !== "IN_PROGRESS") {
        return { success: false, error: "Cette run n'accepte plus de candidatures" };
    }

    // Check if already member
    if (run.members.some((m: { userId: string }) => m.userId === ctx.id)) {
        return { success: false, error: "Vous êtes déjà dans cette run" };
    }

    // Check if PENDING request already exists
    const existingPendingRequest = await db.dreamJoinRequest.findFirst({
        where: { runId: run.id, userId: ctx.id, status: "PENDING" },
    });
    if (existingPendingRequest) {
        return { success: false, error: "Vous avez déjà une demande en cours" };
    }

    // =========================================================================
    // ANTI-SPAM PROTECTION
    // Prevent users from spamming cancel/apply to trigger notifications
    // Check if the LEADER received a notification about THIS USER in the last 5 mins
    // =========================================================================

    // 1. Get candidate name (needed for the spam check query)
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: run.guildId },
        select: { id: true, songesNotifyChannelId: true }, // Select channel ID here too for later
    });

    let candidateName = "Un joueur";
    let candidateProfileId = "";

    if (guildConfig) {
        const candidateProfile = await db.userProfile.findFirst({
            where: { userId: ctx.id, guildId: guildConfig.id },
            select: { id: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
        });
        if (candidateProfile) {
            candidateName = candidateProfile.discordNickname || candidateProfile.pseudoDofus || candidateProfile.user.name || "Un joueur";
            candidateProfileId = candidateProfile.id;
        }
    }

    // 2. Check for recent notifications (Last 5 minutes)
    // We look for a notification sent to the LEADER, with title "Candidature Songes",
    // and containing the candidate's name.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSpam = await db.notification.findFirst({
        where: {
            userId: run.leaderId,
            title: "Candidature Songes",
            message: { contains: candidateName },
            createdAt: { gt: fiveMinutesAgo },
        },
    });

    if (recentSpam) {
        const timeSinceLastSpam = Date.now() - recentSpam.createdAt.getTime();
        const remainingTimeMs = 5 * 60 * 1000 - timeSinceLastSpam;

        if (remainingTimeMs > 0) {
            const minutes = Math.floor(remainingTimeMs / 60000);
            const seconds = Math.floor((remainingTimeMs % 60000) / 1000);
            return { success: false, error: `Veuillez patienter encore ${minutes}m ${seconds}s avant de candidater.` };
        }
    }

    // =========================================================================

    // Delete any old ACCEPTED/REJECTED requests to allow re-application
    // (unique constraint on runId + userId)
    await db.dreamJoinRequest.deleteMany({
        where: {
            runId: run.id,
            userId: ctx.id,
            status: { in: ["ACCEPTED", "REJECTED"] }
        },
    });

    const joinRequest = await db.dreamJoinRequest.create({
        data: {
            runId: validated.data.runId,
            userId: ctx.id!,
            classe: validated.data.classe,
            message: validated.data.message,
        },
    });

    // Create notification for leader if enabled
    if (run.notifyOnJoinRequest) {
        await createNotification(
            run.leaderId,
            "SONGES_JOIN_REQUEST",
            "Candidature Songes",
            `**${candidateName}** (${validated.data.classe}) • Étage ${run.currentFloor}`,
            `/dashboard/${guildId}/songes/${validated.data.runId}`,
            guildId
        );

        // Also send Discord notification if channel is configured
        if (guildConfig && guildConfig.songesNotifyChannelId) {
            // Get leader's pseudo for the embed
            const leaderProfile = await db.userProfile.findFirst({
                where: { userId: run.leaderId, guildId: guildConfig.id },
                select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
            });
            const leaderName = leaderProfile?.discordNickname || leaderProfile?.user?.name || "Leader";

            // Get leader's Discord ID for mention
            const leaderAccount = await db.account.findFirst({
                where: { userId: run.leaderId, provider: "discord" },
                select: { providerAccountId: true },
            });
            const leaderMention = leaderAccount?.providerAccountId ? `<@${leaderAccount.providerAccountId}>` : leaderName;

            // Determine embed color based on difficulty tier
            let embedColor = 0x9333ea;
            if (run.difficulty.startsWith("CAUCHEMAR")) embedColor = 0xdc2626;
            else if (run.difficulty.startsWith("PARADOXE")) embedColor = 0xf59e0b;
            else if (run.difficulty.startsWith("REVE")) embedColor = 0x22c55e;

            const difficultyDisplay = run.difficulty.replace("_", " ");
            const { getAppBaseUrl } = await import("@/lib/utils");
            const runUrl = `${getAppBaseUrl()}/dashboard/${run.guildId}/songes/${run.id}`;

            // SECURITY: Validate channel belongs to this guild before sending
            const { validateChannelBelongsToGuild, sendChannelMessage } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(guildConfig.songesNotifyChannelId, run.guildId);

            if (isValidChannel) {
                const messageId = await sendChannelMessage(
                    guildConfig.songesNotifyChannelId,
                    `Un nouveau joueur a postulé.`,
                    {
                        embedTitle: "📩 Nouvelle candidature Songes",
                        embedColor,
                        fields: [
                            { name: "👤 Candidat", value: candidateName, inline: true },
                            { name: "🛡️ Classe", value: `**${validated.data.classe}**`, inline: true },
                            { name: "💀 Difficulté", value: `\`${difficultyDisplay}\``, inline: true },
                            { name: "📝 Message", value: validated.data.message ? `>>> ${validated.data.message.slice(0, 200)}` : "*Aucun*", inline: false },
                        ],
                        embedFooter: `SigilOS • Songes`,
                        mentionContent: `👋 ${leaderMention} — **${candidateName}** a postulé ! [→ Dashboard](<${runUrl}>)`,
                        suppressEmbeds: true,
                    }
                );

                if (messageId) {
                    await db.dreamJoinRequest.update({
                        where: { id: joinRequest.id },
                        data: {
                            discordMessageId: messageId,
                            discordChannelId: guildConfig.songesNotifyChannelId
                        }
                    });
                }
            }
        }
    }

    revalidatePath(`/dashboard/${run.guildId}/songes`);
    return { success: true };
}

export async function getPendingJoinRequests(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé", requests: [] };

    // Find run by ID AND Guild ID (Strict Isolation)
    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée ou accès refusé", requests: [] };
    }

    // Non-leaders are now allowed to see pending requests (UI requirement)
    // Visibility restriction handled by UI (Action buttons hidden for non-leaders)

    // Cleanup is now handled by the BullMQ worker (daily job)

    const requests = await db.dreamJoinRequest.findMany({
        where: { runId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
    });

    // Fetch user profiles for display names
    // Note: run.guildId is Discord Guild ID, but profile.guildId is internal DB ID
    const userIds = requests.map(r => r.userId);

    // Get internal guildId from GuildConfig
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: run.guildId },
        select: { id: true },
    });

    const profiles = guildConfig ? await db.userProfile.findMany({
        where: { userId: { in: userIds }, guildId: guildConfig.id },
        select: {
            userId: true,
            discordNickname: true,
            pseudoDofus: true,
            user: { select: { name: true, image: true } }
        },
    }) : [];

    // Enrich requests with display names and avatars
    const enrichedRequests = requests.map(r => {
        const profile = profiles.find(p => p.userId === r.userId);
        const displayName = profile?.discordNickname || profile?.pseudoDofus || profile?.user?.name || "Joueur";
        const avatar = profile?.user?.image || null;
        return { ...r, displayName, avatar };
    });

    return { success: true, requests: enrichedRequests };
}

const RespondJoinRequestSchema = z.object({
    requestId: z.string(),
    accept: z.boolean(),
});

export async function respondToJoinRequest(guildId: string, data: z.infer<typeof RespondJoinRequestSchema>) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const validated = RespondJoinRequestSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
    }

    const request = await db.dreamJoinRequest.findFirst({
        where: { id: validated.data.requestId },
        include: { run: { include: { members: true } } },
    });

    if (!request) {
        return { success: false, error: "Demande non trouvée" };
    }

    // Security Check: Ensure request belongs to current guild
    if (request.run.guildId !== ctx.guildId) {
        return { success: false, error: "Non autorisé" };
    }

    // Only leader can respond
    if (request.run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut accepter/refuser" };
    }

    if (validated.data.accept) {
        // Check if there's room
        if (request.run.members.length >= 4) {
            return { success: false, error: "L'équipe est déjà complète" };
        }

        // Find next available slot
        const usedSlots = request.run.members.map((m: { slot: number }) => m.slot);
        const nextSlot = [1, 2, 3, 4].find((s) => !usedSlots.includes(s));

        if (!nextSlot) {
            return { success: false, error: "Aucun slot disponible" };
        }

        // Accept: add as member
        await db.$transaction([
            db.dreamJoinRequest.update({
                where: { id: validated.data.requestId },
                data: { status: "ACCEPTED", respondedAt: new Date() },
            }),
            db.dreamRunMember.create({
                data: {
                    runId: request.runId,
                    userId: request.userId,
                    slot: nextSlot,
                },
            }),
        ]);

        // Notify candidate of acceptance
        await createNotification(
            request.userId,
            "SYSTEM_INFO",
            "Candidature acceptée !",
            `Votre candidature pour la run ${request.run.difficulty} a été acceptée. Bienvenue dans l'équipe !`,
            `/dashboard/${request.run.guildId}/songes/${request.runId}`,
            request.run.guildId
        );

        // Update Discord embed
        const { updateDiscordRunEmbed } = await import("@/server/songes-service");
        await updateDiscordRunEmbed(request.run.guildId, request.runId);
    } else {
        // Reject
        await db.dreamJoinRequest.update({
            where: { id: validated.data.requestId },
            data: { status: "REJECTED", respondedAt: new Date() },
        });

        // Notify candidate of rejection
        await createNotification(
            request.userId,
            "SYSTEM_INFO",
            "Candidature refusée",
            `Votre candidature pour la run ${request.run.difficulty} a été refusée.`,
            `/dashboard/${request.run.guildId}/songes`,
            request.run.guildId
        );
    }

    // Clean up Discord candidacy embed if it exists
    if (request.discordMessageId && request.discordChannelId) {
        try {
            const { deleteChannelMessage } = await import("@/server/discord");
            await deleteChannelMessage(request.discordChannelId, request.discordMessageId);
        } catch (error) {
            console.error("[Songes] Error deleting candidacy message:", error);
        }
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// DELETE RUN
// ============================================

export async function deleteDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Only leader or admin can delete
    if (run.leaderId !== ctx.userId && !ctx.isAdmin) {
        return { success: false, error: "Seul le leader ou un administrateur peut supprimer la run" };
    }

    // Remove Discord embed if it exists
    const { deleteDiscordRunEmbed } = await import("@/server/songes-service");
    await deleteDiscordRunEmbed(ctx.guildId, runId);

    // Delete run (cascade will handle related records)
    await db.dreamRun.delete({
        where: { id: runId },
    });

    // Audit Log for admin deletion
    if (ctx.isAdmin && run.leaderId !== ctx.userId) {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (guildConfig) {
            await db.auditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: ctx.userId,
                    actorName: ctx.name || "Admin",
                    action: "SONGES_RUN_DELETED_BY_ADMIN",
                    targetType: "DREAM_RUN",
                    targetId: runId,
                    metadata: { leaderId: run.leaderId, difficulty: run.difficulty } as any,
                }
            });
        }
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// KICK MEMBER (Leader only)
// ============================================

export async function kickMember(guildId: string, runId: string, targetUserId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
        include: { members: true, waitlist: true },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Only leader can kick
    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut éjecter un membre" };
    }

    // Cannot kick yourself (use leave instead)
    if (targetUserId === ctx.userId) {
        return { success: false, error: "Utilisez 'quitter' pour vous retirer" };
    }

    // Find the member to kick
    const member = run.members.find((m: { userId: string }) => m.userId === targetUserId);
    if (!member) {
        return { success: false, error: "Ce joueur n'est pas dans la run" };
    }

    // Remove member
    await db.dreamRunMember.delete({ where: { id: member.id } });

    // Notify kicked member
    await createNotification(
        targetUserId,
        "SYSTEM_INFO",
        "Retiré d'une run Songes",
        `Vous avez été retiré de la run ${run.difficulty} par le leader.`,
        `/dashboard/${ctx.guildId}/songes`,
        guildId
    );

    // Promote first waitlisted user
    const firstWaitlisted = run.waitlist[0];
    if (firstWaitlisted) {
        await db.$transaction([
            db.dreamRunMember.create({
                data: {
                    runId,
                    userId: firstWaitlisted.userId,
                    slot: member.slot,
                },
            }),
            db.dreamWaitlist.delete({ where: { id: firstWaitlisted.id } }),
            db.dreamWaitlist.updateMany({
                where: { runId },
                data: { position: { decrement: 1 } },
            }),
        ]);
    }

    // Update Discord embed
    const { updateDiscordRunEmbed } = await import("@/server/songes-service");
    await updateDiscordRunEmbed(ctx.guildId, runId);

    // Audit Log if kick by admin (redundant with leader check but for completeness)
    if (ctx.isAdmin && run.leaderId !== ctx.userId) {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        await db.auditLog.create({
            data: {
                guildId: guildConfig!.id,
                actorUserId: ctx.userId,
                actorName: ctx.name || "Admin",
                action: "SONGES_MEMBER_KICKED_BY_ADMIN",
                targetType: "DREAM_RUN_MEMBER",
                targetId: targetUserId,
                metadata: { runId, leaderId: run.leaderId } as any,
            }
        });
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// GET MY JOIN REQUEST STATUS
// ============================================

export async function getMyJoinRequestStatus(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé", status: null };

    // Only look for PENDING requests in the current guild context
    const request = await db.dreamJoinRequest.findFirst({
        where: {
            runId,
            userId: ctx.id,
            status: "PENDING",
            run: { guildId: ctx.guildId } // Strict Scoping
        },
        include: { run: { select: { guildId: true } } }
    });

    if (!request) {
        return { success: true, status: null };
    }

    // Check expiration on the fly
    const expirationThreshold = new Date(Date.now() - JOIN_REQUEST_TTL_MS);
    if (request.createdAt < expirationThreshold) {
        // Expire it now
        await db.dreamJoinRequest.update({
            where: { id: request.id },
            data: { status: "REJECTED", respondedAt: new Date() }
        });

        // Notify
        await createNotification(
            request.userId,
            "SYSTEM_INFO",
            "Candidature expirée",
            "Votre candidature a expiré (délai dépassé).",
            `/dashboard/${request.run.guildId}/songes`,
            request.run.guildId
        );

        return { success: true, status: "REJECTED" };
    }

    return { success: true, status: request.status };
}

// ============================================
// GET MEMBER PROFILES (with Dofus pseudos)
// ============================================

export async function getMemberProfiles(guildId: string, userIds: string[]) {
    // Determine internal guildId for profile lookup
    const guildConfig = await (db.guildConfig as any).findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, rolesMapping: true, usersMapping: true },
    });
    const internalGuildId = guildConfig?.id;

    // userIds are internal Prisma User IDs (not Discord IDs)
    // Query profiles directly
    const profiles = internalGuildId && userIds.length > 0 ? await db.userProfile.findMany({
        where: {
            userId: { in: userIds },
            guildId: internalGuildId,
        },
        select: {
            userId: true,
            pseudoDofus: true,
            classe: true,
            discordNickname: true,
            discordRoleName: true,
            user: {
                select: {
                    name: true,
                    image: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true }
                    }
                },
            },
        },
    }) : [];

    // Transform to include discordNickname with fallbacks + Admin check
    const rolesMapping = (guildConfig?.rolesMapping as Record<string, string[]>) || {};
    const usersMapping = (guildConfig?.usersMapping as Record<string, string[]>) || {};

    // identify role names that grant admin access
    const enrichedProfiles = profiles.map((p) => {
        const discordNickname = p.discordNickname || p.user?.name || null;
        const discordAccountId = p.user?.accounts?.[0]?.providerAccountId;

        const isAdmin = p.discordRoleName === "Administrateur" ||
            Object.entries(rolesMapping).some(([_, perms]) =>
                perms.includes("admin:access") && p.discordRoleName
            ) ||
            (discordAccountId && usersMapping[discordAccountId]?.includes("admin:access"));

        return {
            userId: p.userId,
            pseudoDofus: p.pseudoDofus,
            classe: p.classe,
            discordNickname,
            isAdmin,
            avatar: p.user?.image || null
        };
    });

    // For users without profiles, fetch from User table directly as fallback
    const foundUserIds = new Set(profiles.map((p) => p.userId));
    const missingUserIds = userIds.filter((uid) => !foundUserIds.has(uid));

    if (missingUserIds.length > 0) {
        const users = await db.user.findMany({
            where: { id: { in: missingUserIds } },
            select: { id: true, name: true, image: true },
        });

        for (const user of users) {
            enrichedProfiles.push({
                userId: user.id,
                pseudoDofus: null,
                classe: null,
                discordNickname: user.name || null,
                isAdmin: false,
                avatar: user.image || null
            });
        }
    }

    return { success: true, profiles: enrichedProfiles };
}


// ============================================
// UPDATE CURRENT FLOOR (Leader only)
// ============================================

export async function updateCurrentFloor(guildId: string, runId: string, floorNumber: number) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    // Validate floor number
    if (floorNumber < 0 || floorNumber > 26) {
        return { success: false, error: "Numéro d'étage invalide (0-26)" };
    }

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Only leader can update floor
    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut modifier la progression" };
    }

    // Update the current floor
    await db.dreamRun.update({
        where: { id: runId },
        data: {
            currentFloor: floorNumber,
            // Auto-start if setting floor > 0 and not started yet
            ...(floorNumber > 0 && run.status === "RECRUITING" && {
                status: "IN_PROGRESS",
                startedAt: new Date(),
            }),
            // NO auto-complete at floor 26 - leader must use closeDreamRun action
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes/${runId}`);
    return { success: true };
}

// ============================================
// CLOSE RUN (Leader manually marks as complete)
// ============================================

export async function closeDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut clôturer la run" };
    }

    if (run.status !== "IN_PROGRESS") {
        return { success: false, error: "Seule une run en cours peut être clôturée" };
    }

    await db.dreamRun.update({
        where: { id: runId },
        data: {
            status: "COMPLETED",
            completedAt: new Date(),
        },
    });

    // Remove Discord embed
    const { deleteDiscordRunEmbed } = await import("@/server/songes-service");
    await deleteDiscordRunEmbed(ctx.guildId, runId);

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// REOPEN RUN (Leader can reopen a completed run)
// ============================================

export async function reopenDreamRun(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut réouvrir la run" };
    }

    if (run.status !== "COMPLETED" && run.status !== "FAILED") {
        return { success: false, error: "Seule une run terminée ou échouée peut être réouverte" };
    }

    await db.dreamRun.update({
        where: { id: runId },
        data: {
            status: "IN_PROGRESS",
            completedAt: null, // Clear completion date
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    revalidatePath(`/dashboard/${ctx.guildId}/songes/${runId}`);
    return { success: true };
}

// ============================================
// CANCEL JOIN REQUEST (User cancels their own)
// ============================================

export async function cancelJoinRequest(guildId: string, runId: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    // Find user's pending request for this run (Scoped by Guild)
    const request = await db.dreamJoinRequest.findFirst({
        where: {
            runId,
            userId: ctx.id,
            status: "PENDING",
            run: { guildId: ctx.guildId }
        },
    });

    if (!request) {
        return { success: false, error: "Aucune candidature en attente" };
    }

    // Delete the request
    await db.dreamJoinRequest.delete({
        where: { id: request.id },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// NOTIFY MEMBERS ACTION
// ============================================

export async function triggerRunNotification(guildId: string, runId: string, message: string, scheduledAt?: Date) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
        include: { members: true }
    });

    if (!run) return { success: false, error: "Run non trouvée" };
    if (run.leaderId !== ctx.userId) return { success: false, error: "Seul le leader peut notifier les membres" };

    // Spam Protection: 15 minutes cooldown
    const COOLDOWN_MS = 15 * 60 * 1000;
    if (run.lastReminderAt && (Date.now() - run.lastReminderAt.getTime() < COOLDOWN_MS)) {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - (Date.now() - run.lastReminderAt.getTime())) / 60000);
        return { success: false, error: `Anti-spam : Veuillez attendre ${remainingMinutes} minute(s) avant le prochain rappel.` };
    }

    // Dashboard notifications for each member
    const notificationPromises = run.members.map(member =>
        createNotification(
            member.userId,
            "SYSTEM_INFO",
            "Rappel Songes",
            scheduledAt
                ? `RDV à ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${message}`
                : `Message du leader : ${message}`,
            `/dashboard/${ctx.guildId}/songes/${runId}`,
            guildId
        )
    );

    await Promise.all(notificationPromises);

    // Update last reminder timestamp
    await db.dreamRun.update({
        where: { id: runId },
        data: { lastReminderAt: new Date() }
    });

    // Discord Ping
    const { notifyRunMembers } = await import("@/server/songes-service");

    // Format message for Discord with timestamp if provided
    let discordMessage = message;
    if (scheduledAt) {
        const unixTimestamp = Math.floor(scheduledAt.getTime() / 1000);
        discordMessage = `🕒 **Rendez-vous prévu :** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n${message}`;
    }

    const result = await notifyRunMembers(ctx.guildId, runId, discordMessage);

    // Track leader reminders for later cleanup
    if (result.success && result.messageId && run.discordChannelId) {
        await db.dreamRunReminder.create({
            data: {
                runId: runId,
                discordMessageId: result.messageId,
                discordChannelId: run.discordChannelId
            }
        });
    }

    return result;
}

/**
 * Fetch past dream runs for a specific member
 */
export async function getMemberDreamRuns(guildId: string, userId?: string) {
    const ctx = await getGuildUserContext(guildId);
    if (!ctx) return { success: false, error: "Non authentifié ou non autorisé" };

    const targetUserId = userId || ctx.userId;

    const runs = await db.dreamRun.findMany({
        where: {
            guildId: ctx.guildId,
            members: {
                some: { userId: targetUserId }
            },
            status: { in: ["COMPLETED", "FAILED", "ABANDONED"] }
        },
        include: {
            members: {
                orderBy: { slot: "asc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            profiles: {
                                where: { guildId: ctx.guildId },
                                select: { pseudoDofus: true, classe: true }
                            }
                        }
                    }
                }
            },
            _count: {
                select: { floors: true }
            }
        },
        orderBy: { completedAt: "desc" },
        take: 20
    });

    return { success: true, runs };
}

"use server";

/**
 * Songes Module - Server Actions
 * CRUD operations for Dream Runs
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";

// ============================================
// HELPER: Get context with guild ID
// ============================================

async function getContextWithGuildId() {
    const ctx = await getUserContext();
    if (!ctx.isAuthenticated || !ctx.id) return null;

    // Get the user's guild from their profile
    const profile = await db.userProfile.findFirst({
        where: { userId: ctx.id },
        include: { guild: true },
    });

    if (!profile) return null;

    return {
        ...ctx,
        userId: ctx.id,
        guildId: profile.guild.discordGuildId,
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
    objective: z.enum(["MISSION_GUILDE", "DROP_LEGENDE", "SUCCES_NO_ACHAT", "FUN"]).default("FUN"),
});

const AddFloorSchema = z.object({
    runId: z.string(),
    floorNumber: z.number().min(1).max(26),
    roomType: z.enum(["COMBAT", "FONTAINE", "FAVEUR", "BOSS"]),
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

// ============================================
// CREATE RUN
// ============================================

export async function createDreamRun(data: z.infer<typeof CreateRunSchema>) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

    const validated = CreateRunSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
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
            objective: validated.data.objective,
            members: {
                create: {
                    userId: ctx.userId,
                    slot: 1, // Leader takes slot 1
                },
            },
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true, runId: run.id };
}

// ============================================
// GET RUNS
// ============================================

export async function getDreamRuns(statusFilter?: string[]) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié", runs: [] };

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
            _count: {
                select: { floors: true, bonuses: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return { success: true, runs };
}

export async function getDreamRunById(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié", run: null };

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

export async function joinDreamRun(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

    // Find next available slot
    const usedSlots = run.members.map((m) => m.slot);
    const nextSlot = [1, 2, 3, 4].find((s) => !usedSlots.includes(s));

    if (nextSlot) {
        // Join directly
        await db.dreamRunMember.create({
            data: {
                runId,
                userId: ctx.userId,
                slot: nextSlot,
            },
        });
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

export async function leaveDreamRun(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

export async function startDreamRun(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

export async function completeDreamRun(runId: string, success: boolean) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// ADD FLOOR
// ============================================

export async function addDreamFloor(data: z.infer<typeof AddFloorSchema>) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

export async function addDreamBonus(data: z.infer<typeof AddBonusSchema>) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

    if (run.pointsReve < validated.data.cost) {
        return { success: false, error: "Points de Rêve insuffisants" };
    }

    await db.$transaction([
        db.dreamRunBonus.create({
            data: {
                runId: validated.data.runId,
                bonusName: validated.data.bonusName,
                bonusType: validated.data.bonusType,
                bonusRarete: validated.data.bonusRarete,
                cost: validated.data.cost,
            },
        }),
        db.dreamRun.update({
            where: { id: validated.data.runId },
            data: {
                pointsReve: { decrement: validated.data.cost },
            },
        }),
    ]);

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

export async function sendJoinRequest(data: z.infer<typeof SendJoinRequestSchema>) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

    const validated = SendJoinRequestSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Données invalides" };
    }

    const run = await db.dreamRun.findFirst({
        where: { id: validated.data.runId, guildId: ctx.guildId },
        include: { members: true, joinRequests: true },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Allow candidature for RECRUITING or IN_PROGRESS runs
    if (run.status !== "RECRUITING" && run.status !== "IN_PROGRESS") {
        return { success: false, error: "Cette run n'accepte plus de candidatures" };
    }

    // Check if already member
    if (run.members.some((m: { userId: string }) => m.userId === ctx.userId)) {
        return { success: false, error: "Vous êtes déjà dans cette run" };
    }

    // Check if request already exists
    const existingRequest = run.joinRequests.find((r: { userId: string }) => r.userId === ctx.userId);
    if (existingRequest) {
        return { success: false, error: "Vous avez déjà une demande en cours" };
    }

    await db.dreamJoinRequest.create({
        data: {
            runId: validated.data.runId,
            userId: ctx.userId,
            classe: validated.data.classe,
            message: validated.data.message,
        },
    });

    // Create notification for leader if enabled
    if (run.notifyOnJoinRequest) {
        await db.notification.create({
            data: {
                userId: run.leaderId,
                title: "Nouvelle candidature Songes",
                message: `Un joueur (${validated.data.classe}) souhaite rejoindre votre run.`,
                type: "SONGES_JOIN_REQUEST",
                link: `/dashboard/${ctx.guildId}/songes/${run.id}`,
            },
        });
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

export async function getPendingJoinRequests(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié", requests: [] };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée", requests: [] };
    }

    // Only leader can see pending requests
    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Non autorisé", requests: [] };
    }

    const requests = await db.dreamJoinRequest.findMany({
        where: { runId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
    });

    return { success: true, requests };
}

const RespondJoinRequestSchema = z.object({
    requestId: z.string(),
    accept: z.boolean(),
});

export async function respondToJoinRequest(data: z.infer<typeof RespondJoinRequestSchema>) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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
    } else {
        // Reject
        await db.dreamJoinRequest.update({
            where: { id: validated.data.requestId },
            data: { status: "REJECTED", respondedAt: new Date() },
        });
    }

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// DELETE RUN
// ============================================

export async function deleteDreamRun(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId: ctx.guildId },
    });

    if (!run) {
        return { success: false, error: "Run non trouvée" };
    }

    // Only leader can delete
    if (run.leaderId !== ctx.userId) {
        return { success: false, error: "Seul le leader peut supprimer la run" };
    }

    // Delete run (cascade will handle related records)
    await db.dreamRun.delete({
        where: { id: runId },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// KICK MEMBER (Leader only)
// ============================================

export async function kickMember(runId: string, targetUserId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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

    revalidatePath(`/dashboard/${ctx.guildId}/songes`);
    return { success: true };
}

// ============================================
// GET MY JOIN REQUEST STATUS
// ============================================

export async function getMyJoinRequestStatus(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié", status: null };

    const request = await db.dreamJoinRequest.findFirst({
        where: { runId, userId: ctx.userId },
        orderBy: { createdAt: "desc" },
    });

    if (!request) {
        return { success: true, status: null };
    }

    return { success: true, status: request.status };
}

// ============================================
// GET MEMBER PROFILES (with Dofus pseudos)
// ============================================

export async function getMemberProfiles(userIds: string[]) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié", profiles: [] };

    // Get profiles for these user IDs
    const profiles = await db.userProfile.findMany({
        where: {
            userId: { in: userIds },
            guildId: ctx.guildId,
        },
        select: {
            userId: true,
            pseudoDofus: true,
            classe: true,
            discordNickname: true,
        },
    });

    return { success: true, profiles };
}

// ============================================
// UPDATE CURRENT FLOOR (Leader only)
// ============================================

export async function updateCurrentFloor(runId: string, floorNumber: number) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

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
            // Auto-complete if reaching floor 26
            ...(floorNumber === 26 && {
                status: "COMPLETED",
                completedAt: new Date(),
            }),
        },
    });

    revalidatePath(`/dashboard/${ctx.guildId}/songes/${runId}`);
    return { success: true };
}

// ============================================
// CANCEL JOIN REQUEST (User cancels their own)
// ============================================

export async function cancelJoinRequest(runId: string) {
    const ctx = await getContextWithGuildId();
    if (!ctx) return { success: false, error: "Non authentifié" };

    // Find user's pending request for this run
    const request = await db.dreamJoinRequest.findFirst({
        where: {
            runId,
            userId: ctx.userId,
            status: "PENDING",
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

"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";

// --- Types ---
type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Validation ---
const DefiFormSchema = z.object({
    name: z.string().min(1, "Nom requis").max(150),
    slug: z.string().min(1, "Slug requis").max(150).regex(/^[a-z0-9-]+$/, "Format: minuscules, chiffres, tirets uniquement"),
    description: z.string().optional().or(z.literal("")),
    zone: z.string().optional().or(z.literal("")),
    level: z.number().int().min(0).max(1000).optional().nullable(),
    imageUrl: z.string().optional().or(z.literal("")),
    dofensiveUrl: z.string().optional().or(z.literal("")),
    dpnlUrl: z.string().optional().or(z.literal("")),
    dofuspourlesnoobsUrl: z.string().optional().or(z.literal("")),
    // Boss du défi : [{ name, dofusdbId?, imageUrl? }]
    bosses: z.array(z.object({
        name: z.string().min(1),
        dofusdbId: z.number().int().optional().nullable(),
        imageUrl: z.string().optional().or(z.literal("")),
    })).optional().default([]),
});

// 🛡️ Fail-closed : super-admin OU sous-god avec la brique "game-data".
async function requireSuperAdmin(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const isAdmin = await isSuperAdmin();
    if (isAdmin) return session.user.id;
    const ok = await canAccessBrick("game-data");
    if (!ok) return null;
    return session.user.id;
}

async function logDefiWrite(op: string, targetId?: string, metadata?: Record<string, any>) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;
        const isAdmin = await isSuperAdmin();
        if (isAdmin) return;
        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            targetId,
            metadata: { op, ...metadata },
        });
    } catch {
        // Non bloquant
    }
}

// --- READ ---

export async function getDefis(): Promise<ActionResponse<any[]>> {
    try {
        const defis = await db.defi.findMany({ orderBy: { name: "asc" } });
        return { success: true, data: defis };
    } catch (error) {
        logger.error("[getDefis] Error:", error);
        return { success: false, error: "Erreur lors du chargement des défis" };
    }
}

// --- CREATE ---

export async function createDefi(data: z.infer<typeof DefiFormSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DefiFormSchema.parse(data);
        const defi = await db.defi.create({
            data: {
                name: validated.name,
                slug: validated.slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? null,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                bossNames: validated.bosses.length > 0 ? validated.bosses : [],
            },
        });
        await logDefiWrite("create-defi", defi.id, { name: defi.name });
        revalidatePath("/god?tab=game-data");
        return { success: true, data: defi };
    } catch (error: any) {
        logger.error("[createDefi] Error:", error);
        if (error.code === "P2002") return { success: false, error: "Ce défi (nom ou slug) existe déjà" };
        return { success: false, error: "Erreur lors de la création" };
    }
}

// --- UPDATE ---

export async function updateDefi(id: string, data: z.infer<typeof DefiFormSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DefiFormSchema.parse(data);
        const defi = await db.defi.update({
            where: { id },
            data: {
                name: validated.name,
                slug: validated.slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? null,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                bossNames: validated.bosses.length > 0 ? validated.bosses : [],
            },
        });
        await logDefiWrite("update-defi", id, { name: defi.name });
        revalidatePath("/god?tab=game-data");
        return { success: true, data: defi };
    } catch (error: any) {
        logger.error("[updateDefi] Error:", error);
        if (error.code === "P2002") return { success: false, error: "Ce défi (nom ou slug) existe déjà" };
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// --- DELETE ---

export async function deleteDefi(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.defi.delete({ where: { id } });
        await logDefiWrite("delete-defi", id);
        revalidatePath("/god?tab=game-data");
        return { success: true };
    } catch (error) {
        logger.error("[deleteDefi] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

// --- Types exports (pour la modale client) ---
export type DefiFormValues = z.infer<typeof DefiFormSchema>;

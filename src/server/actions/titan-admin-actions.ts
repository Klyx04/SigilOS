"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";
import { slugifyName } from "@/lib/titan-slug";

// --- Types ---
type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Validation ---
// `scheduleConfig` = config de disponibilité FLEXIBLE (jours/créneaux/maxVictoires) — NON figée :
// chaque Titan peut avoir des contraintes différentes (bonus : nouveaux Titans à venir).
const TitanFormSchema = z.object({
    name: z.string().min(1, "Nom requis").max(150),
    slug: z.string().optional().default(""),
    description: z.string().optional().or(z.literal("")),
    zone: z.string().optional().or(z.literal("")),
    level: z.number().int().min(0).max(1000).optional().nullable(),
    imageUrl: z.string().optional().or(z.literal("")),
    dofensiveUrl: z.string().optional().or(z.literal("")),
    dpnlUrl: z.string().optional().or(z.literal("")),
    dofuspourlesnoobsUrl: z.string().optional().or(z.literal("")),
    mapName: z.string().optional().or(z.literal("")),
    dofusdbId: z.number().int().positive().optional().nullable(),
    questName: z.string().optional().or(z.literal("")),
    questUrl: z.string().optional().or(z.literal("")),
    // Config de disponibilité flexible — objet libre (validé au plus près mais tolérant).
    scheduleConfig: z.record(z.string(), z.any()).optional().default({}),
    // Mapping du boss de phase 4 par saison : [{ season, bossName, imageUrl? }]
    seasonBosses: z.array(z.object({
        season: z.string().min(1),
        bossName: z.string().min(1),
        imageUrl: z.string().nullable().optional(),
    })).optional().default([]),
    seasons: z.array(z.string()).optional().default([]),
    currentSeason: z.string().optional().or(z.literal("")),
    maxMembers: z.number().int().min(1).max(12).default(4),
    isPermanent: z.boolean().optional().default(true),
});

async function requireGod(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const isAdmin = await isSuperAdmin();
    if (isAdmin) return session.user.id;
    const ok = await canAccessBrick("game-data");
    if (!ok) return null;
    return session.user.id;
}

async function logTitanWrite(op: string, targetId?: string, metadata?: Record<string, any>) {
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

async function resolveFinalSlug(slug: string, name: string): Promise<string> {
    let base = (slug || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{1,150}$/.test(base)) base = slugifyName(name);
    if (!base) throw new Error("Impossible de générer un slug");
    let candidate = base;
    let i = 1;
    while (await db.titan.findUnique({ where: { slug: candidate } })) {
        candidate = `${base}-${i++}`;
    }
    return candidate;
}

// --- READ (catalogue God + sélecteurs membre) ---

export async function getTitans(): Promise<ActionResponse<any[]>> {
    try {
        const titans = await db.titan.findMany({ orderBy: { name: "asc" } });
        return { success: true, data: titans };
    } catch (error) {
        logger.error("[getTitans] Error:", error);
        return { success: false, error: "Erreur lors du chargement des titans" };
    }
}

export async function getTitan(id: string): Promise<ActionResponse<any>> {
    try {
        const titan = await db.titan.findUnique({ where: { id } });
        if (!titan) return { success: false, error: "Titan introuvable" };
        return { success: true, data: titan };
    } catch (error) {
        logger.error("[getTitan] Error:", error);
        return { success: false, error: "Erreur lors du chargement du titan" };
    }
}

// --- CREATE ---

export async function createTitan(data: z.infer<typeof TitanFormSchema>): Promise<ActionResponse<any>> {
    const userId = await requireGod();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = TitanFormSchema.parse(data);
        const slug = await resolveFinalSlug(validated.slug, validated.name);

        const titan = await db.titan.create({
            data: {
                name: validated.name,
                slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? 200,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                mapName: validated.mapName || null,
                dofusdbId: validated.dofusdbId ?? null,
                questName: validated.questName || null,
                questUrl: validated.questUrl || null,
                scheduleConfig: validated.scheduleConfig || {},
                seasonBosses: validated.seasonBosses.length > 0 ? validated.seasonBosses : [],
                seasons: validated.seasons || [],
                currentSeason: validated.currentSeason || null,
                maxMembers: validated.maxMembers ?? 4,
                isPermanent: validated.isPermanent ?? true,
            },
        });
        await logTitanWrite("create-titan", titan.id, { name: titan.name });
        revalidatePath("/god?tab=game-data");
        revalidatePath("/dashboard/[guildId]/succes");
        return { success: true, data: titan };
    } catch (error: any) {
        logger.error("[createTitan] Error:", error);
        if (error.code === "P2002") return { success: false, error: "Ce titan (nom ou slug) existe déjà" };
        return { success: false, error: "Erreur lors de la création" };
    }
}

// --- UPDATE ---

export async function updateTitan(id: string, data: z.infer<typeof TitanFormSchema>): Promise<ActionResponse<any>> {
    const userId = await requireGod();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = TitanFormSchema.parse(data);
        let slug = (validated.slug || "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,150}$/.test(slug)) slug = slugifyName(validated.name);
        if (!slug) throw new Error("Impossible de générer un slug");
        const clash = await db.titan.findFirst({ where: { slug, id: { not: id } }, select: { id: true } });
        if (clash) return { success: false, error: "Ce slug est déjà utilisé par un autre titan" };

        const titan = await db.titan.update({
            where: { id },
            data: {
                name: validated.name,
                slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? 200,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                mapName: validated.mapName || null,
                dofusdbId: validated.dofusdbId ?? null,
                questName: validated.questName || null,
                questUrl: validated.questUrl || null,
                scheduleConfig: validated.scheduleConfig || {},
                seasonBosses: validated.seasonBosses.length > 0 ? validated.seasonBosses : [],
                seasons: validated.seasons || [],
                currentSeason: validated.currentSeason || null,
                maxMembers: validated.maxMembers ?? 4,
                isPermanent: validated.isPermanent ?? true,
            },
        });
        await logTitanWrite("update-titan", id, { name: titan.name });
        revalidatePath("/god?tab=game-data");
        revalidatePath("/dashboard/[guildId]/succes");
        return { success: true, data: titan };
    } catch (error: any) {
        logger.error("[updateTitan] Error:", error);
        if (error.code === "P2002") return { success: false, error: "Ce titan (nom ou slug) existe déjà" };
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// --- DELETE ---

export async function deleteTitan(id: string): Promise<ActionResponse> {
    const userId = await requireGod();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.titan.delete({ where: { id } });
        await logTitanWrite("delete-titan", id);
        revalidatePath("/god?tab=game-data");
        revalidatePath("/dashboard/[guildId]/succes");
        return { success: true };
    } catch (error) {
        logger.error("[deleteTitan] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

// --- Types exports (pour la modale client) ---
export type TitanFormValues = z.infer<typeof TitanFormSchema>;

"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";
import { slugifyName } from "@/lib/defi-slug";

// --- Types ---
type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Validation ---
// Slug : optionnel côté formulaire (auto-généré depuis le nom si vide). Validé en POST.
const DefiFormSchema = z.object({
    name: z.string().min(1, "Nom requis").max(150),
    slug: z.string().optional().default(""),
    description: z.string().optional().or(z.literal("")),
    // Zone = nom de zone siphonné (choisi via combobox) — texte libre toléré pour rétro-compat.
    zone: z.string().optional().or(z.literal("")),
    level: z.number().int().min(0).max(1000).optional().nullable(),
    imageUrl: z.string().optional().or(z.literal("")),
    dofensiveUrl: z.string().optional().or(z.literal("")),
    dpnlUrl: z.string().optional().or(z.literal("")),
    dofuspourlesnoobsUrl: z.string().optional().or(z.literal("")),
    // Fenêtre d'événement : dispo en permanence (défaut) ou bornée [startDate → endDate].
    isPermanent: z.boolean().optional().default(true),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    // Boss du défi : [{ name, dofusdbId?, imageUrl? }]
    bosses: z.array(z.object({
        name: z.string().min(1),
        dofusdbId: z.number().int().optional().nullable(),
        imageUrl: z.string().nullable().optional(),
    })).optional().default([]),
});

// `slugifyName` est importé depuis `@/lib/defi-slug` (module pur, partagé client/server/test).

/** Résout le slug final : celui fourni s'il est valide, sinon auto-généré depuis le nom + suffixe d'unicité. */
async function resolveFinalSlug(slug: string, name: string): Promise<string> {
    let base = (slug || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{1,150}$/.test(base)) base = slugifyName(name);
    if (!base) throw new Error("Impossible de générer un slug");
    // Unicité : ajoute un suffixe si le slug existe déjà (hors cas update).
    let candidate = base;
    let i = 1;
    while (await db.defi.findUnique({ where: { slug: candidate } })) {
        candidate = `${base}-${i++}`;
    }
    return candidate;
}

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

/**
 * Recherche de monstres pour le dropdown « Boss du défi » (catalogue Dofensive siphonné).
 * Retourne [{ value, label, subLabel, imageUrl? }] — `value` = nom du monstre (assaini).
 */
export async function searchMonstersForDefi(query: string): Promise<ActionResponse<any[]>> {
    try {
        const q = (query || "").trim();
        const where: any = q ? { monsterName: { contains: q, mode: "insensitive" } } : {};
        const found = await db.monsterStat.findMany({
            where,
            select: { monsterName: true, dungeonName: true },
            orderBy: { monsterName: "asc" },
            take: 40,
        });
        const seen = new Set<string>();
        const items = found
            .filter((m) => {
                const key = m.monsterName.trim().toLowerCase();
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((m) => ({
                value: m.monsterName,
                label: m.monsterName,
                subLabel: m.dungeonName || undefined,
                imageUrl: null,
            }));
        return { success: true, data: items };
    } catch (error) {
        logger.error("[searchMonstersForDefi] Error:", error);
        return { success: false, error: "Erreur recherche monstres" };
    }
}

// --- CREATE ---

export async function createDefi(data: z.infer<typeof DefiFormSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DefiFormSchema.parse(data);
        const isPermanent = validated.isPermanent ?? true;
        // Fenêtre d'événement : permanent → on ignore les dates (null) ; sinon on garde start/end (end >= start).
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (!isPermanent) {
            startDate = validated.startDate ? new Date(validated.startDate) : null;
            endDate = validated.endDate ? new Date(validated.endDate) : null;
            if (startDate && endDate && endDate < startDate) {
                return { success: false, error: "La date de fin doit être après la date de début" };
            }
        }
        const slug = await resolveFinalSlug(validated.slug || "", validated.name);
        const defi = await db.defi.create({
            data: {
                name: validated.name,
                slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? null,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                bossNames: validated.bosses.length > 0 ? validated.bosses : [],
                isPermanent,
                startDate,
                endDate,
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
        const isPermanent = validated.isPermanent ?? true;
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (!isPermanent) {
            startDate = validated.startDate ? new Date(validated.startDate) : null;
            endDate = validated.endDate ? new Date(validated.endDate) : null;
            if (startDate && endDate && endDate < startDate) {
                return { success: false, error: "La date de fin doit être après la date de début" };
            }
        }
        // Slug : si vide ou inchangé, on conserve / auto-génère, en excluant le défi courant de la recherche d'unicité.
        let slug = (validated.slug || "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,150}$/.test(slug)) slug = slugifyName(validated.name);
        if (!slug) throw new Error("Impossible de générer un slug");
        const clash = await db.defi.findFirst({ where: { slug, id: { not: id } }, select: { id: true } });
        if (clash) return { success: false, error: "Ce slug est déjà utilisé par un autre défi" };

        const defi = await db.defi.update({
            where: { id },
            data: {
                name: validated.name,
                slug,
                description: validated.description || null,
                zone: validated.zone || null,
                level: validated.level ?? null,
                imageUrl: validated.imageUrl || null,
                dofensiveUrl: validated.dofensiveUrl || null,
                dpnlUrl: validated.dpnlUrl || null,
                dofuspourlesnoobsUrl: validated.dofuspourlesnoobsUrl || null,
                bossNames: validated.bosses.length > 0 ? validated.bosses : [],
                isPermanent,
                startDate,
                endDate,
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

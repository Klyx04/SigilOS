"use server";
import { logger } from "@/lib/logger";
import { isSafeImageUrl } from "@/lib/security";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { ACHIEVEMENT_KIND, QUEST_KIND, buildQuestTree, collectSubtreeIds, wouldCreateCycle } from "@/lib/dofus-quest-tree";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Security Helper ---
// 🛡️ Fail-closed : autorise super-admin OU un sous-god avec la brique "game-data-quetes".
// Retourne l'userId si autorisé, sinon null.
async function requireSuperAdmin() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const isAdmin = await isSuperAdmin();
    if (isAdmin) return session.user.id;
    const ok = await canAccessBrick("game-data-quetes");
    if (!ok) return null;
    return session.user.id;
}

// 🛡️ Trace une écriture God UNIQUEMENT pour un sous-god (pas super-admin).
async function logQuestWrite(op: string, targetId?: string, metadata?: Record<string, any>) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;
        const isAdmin = await isSuperAdmin();
        if (isAdmin) return; // l'admin est déjà tracé par d'autres canaux
        await createGodAuditLog({
            action: "GOD_QUEST_DATA_UPDATE",
            targetType: "DATA_SYNC",
            targetId,
            metadata: { op, ...metadata },
        });
    } catch {
        // Non bloquant : ne jamais interrompre l'action applicative
    }
}

// --- Schemas ---

const DofusItemSchema = z.object({
    name: z.string().min(1),
    nameShort: z.string().min(1),
    slug: z.string().min(1),
    rarity: z.string(),
    isPrimordial: z.boolean(),
    levelRecommended: z.number().int().min(1),
    color: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    successName: z.string().optional().nullable(),
    displayOrder: z.number().int().default(0),
});

const ChainSchema = z.object({
    dofusId: z.string(),
    sectionType: z.string(), // PREREQUISITE | MAIN_CHAIN | OPTIONAL
    sectionName: z.string().min(1),
    description: z.string().optional().nullable(),
    sectionIcon: z.string().default("serie-de-quete"),
    chainOrder: z.number().int().default(0),
});

const EntrySchema = z.object({
    chainId: z.string(),
    name: z.string().min(1),
    zone: z.string().optional().nullable(),
    npcName: z.string().optional().nullable(),
    npcSubArea: z.string().optional().nullable(),
    level: z.number().int().optional().nullable(),
    isDungeon: z.boolean().optional().default(false),
    questType: z.string().default("QUEST"),
    stepOrder: z.number().int().default(0),
    isOptional: z.boolean().default(false),
    isLast: z.boolean().default(false),
    /** Succès imbriqués : QUEST (quête jouable) | ACHIEVEMENT (succès conteneur d'objectifs). */
    entryKind: z.enum([QUEST_KIND, ACHIEVEMENT_KIND]).default(QUEST_KIND),
    /** Id du succès parent (doit être un ACHIEVEMENT de la même section, sans cycle). */
    parentEntryId: z.string().optional().nullable(),
    dofusdbId: z.number().int().optional().nullable(),
    mapId: z.number().int().optional().nullable(),
    coords: z.object({
        x: z.number().nullable(),
        y: z.number().nullable()
    }).optional().nullable(),
    requirements: z.any().optional(),
    notes: z.string().optional().nullable(),
    externalRef: z.string().optional().nullable(),
    objectives: z.array(z.any()).optional().default([]),
    itemsRequired: z.array(z.any()).optional().default([]),
    dungeonsRequired: z.array(z.any()).optional().default([]),
    positions: z.array(z.object({
        x: z.number(),
        y: z.number(),
        label: z.string().optional().nullable(),
    })).optional().default([]),
    dofusdbUrl: z.string().optional().nullable(),
    dofuspourlesnoobsUrl: z.string().optional().nullable(),
    // #148 CodeQL High — URL d'image strictement allowlistée (http(s) ou chemin relatif) : fail-closed.
    localImageUrl: z.string().optional().nullable().refine(
        (v) => v === null || v === undefined || v === "" || isSafeImageUrl(v),
        { message: "URL d'image invalide (http(s) ou chemin relatif requis)" }
    ),
});

// --- Actions ---

export async function getDofusManagementData(): Promise<ActionResponse<any[]>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const data = await (db as any).dofusItem.findMany({
            orderBy: { displayOrder: "asc" },
            include: {
                questChains: {
                    // #148 — tie-break id asc : l'ordre des flèches (reorder = [field, id]) doit
                    // correspondre EXACTEMENT à l'ordre affiché (évite le décalage God/client).
                    orderBy: [{ chainOrder: "asc" }, { id: "asc" }],
                    include: {
                        entries: {
                            orderBy: [{ stepOrder: "asc" }, { id: "asc" }]
                        }
                    }
                }
            }
        });
        return { success: true, data };
    } catch (error) {
        logger.error("[getDofusManagementData] Error:", error);
        return { success: false, error: "Erreur lors du chargement des données Dofus" };
    }
}

export async function upsertDofusItem(id: string | null, data: z.infer<typeof DofusItemSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DofusItemSchema.parse(data);
        const record = id 
            ? await (db as any).dofusItem.update({ where: { id }, data: validated })
            : await (db as any).dofusItem.create({ data: validated });
        await logQuestWrite(id ? "update-dofus-item" : "create-dofus-item", id ?? (record as any)?.id, { name: validated.name });
        
        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        logger.error("[upsertDofusItem] Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde du Dofus" };
    }
}

export async function updateDofusCategory(id: string, filterCategory: string, filterSubCategory: string | null): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusItem.update({
            where: { id },
            data: { filterCategory, filterSubCategory }
        });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[updateDofusCategory] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour de la catégorie" };
    }
}

export async function getDofusItemsForTagging(): Promise<ActionResponse<any[]>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const items = await (db as any).dofusItem.findMany({
            orderBy: { displayOrder: "asc" },
            select: {
                id: true,
                name: true,
                nameShort: true,
                slug: true,
                imageUrl: true,
                localImageUrl: true,
                color: true,
                isPrimordial: true,
                isMeta: true,
                isSylvestreReq: true,
                displayOrder: true,
                rarity: true,
                filterCategory: true,
            }
        });
        return { success: true, data: items };
    } catch (error) {
        logger.error("[getDofusItemsForTagging] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

export async function updateDofusTags(
    id: string,
    tags: { 
        isPrimordial?: boolean; 
        isMeta?: boolean; 
        isSylvestreReq?: boolean; 
        displayOrder?: number;
        rarity?: string;
        filterCategory?: string;
    }
): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusItem.update({ where: { id }, data: tags });
        await logQuestWrite("update-dofus-tags", id, { tags });
        revalidatePath("/god/game-data");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        logger.error("[updateDofusTags] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour des tags" };
    }
}

export async function deleteDofusItem(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusItem.delete({ where: { id } });
        await logQuestWrite("delete-dofus-item", id);
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[deleteDofusItem] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

export async function upsertQuestChain(id: string | null, data: z.infer<typeof ChainSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = ChainSchema.parse(data);
        const record = id 
            ? await (db as any).dofusQuestChain.update({ where: { id }, data: validated })
            : await (db as any).dofusQuestChain.create({ data: validated });
        await logQuestWrite(id ? "update-quest-chain" : "create-quest-chain", id ?? (record as any)?.id, { sectionName: validated.sectionName });
        
        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        logger.error("[upsertQuestChain] Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde de la chaîne" };
    }
}

export async function deleteQuestChain(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusQuestChain.delete({ where: { id } });
        await logQuestWrite("delete-quest-chain", id);
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[deleteQuestChain] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

import fs from "fs";
import path from "path";

async function syncEntryToLocalJson(
    dofusSlug: string, 
    entryName: string, 
    updatedFields: { 
        externalRef?: string | null; 
        coords?: { x: number | null; y: number | null } | null; 
        dofusdbId?: number | null 
        localImageUrl?: string | null;
        dungeonsRequired?: any[] | null;
        positions?: any[] | null;
        level?: number | null;
        /** Succès imbriqués : nature de l'étape + nom du succès parent (résolu en id au seed). */
        entryKind?: string | null;
        parentName?: string | null;
    }
) {
    const filePath = path.join(process.cwd(), "prisma", "seed-data", "dofus-quests", `${dofusSlug}-compiled.json`);
    if (!fs.existsSync(filePath)) return;
    
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const dofusData = JSON.parse(fileContent);
    
    let modified = false;
    if (dofusData && Array.isArray(dofusData.chains)) {
        for (const chain of dofusData.chains) {
            if (Array.isArray(chain.entries)) {
                for (const entry of chain.entries) {
                    if (entry.name === entryName) {
                        if (updatedFields.externalRef !== undefined) {
                            entry.externalRef = updatedFields.externalRef;
                        }
                        if (updatedFields.coords !== undefined) {
                            entry.coords = updatedFields.coords;
                        }
                        if (updatedFields.dofusdbId !== undefined) {
                            entry.dofusdbId = updatedFields.dofusdbId;
                        }
                        if (updatedFields.localImageUrl !== undefined) {
                            entry.localImageUrl = updatedFields.localImageUrl;
                        }
                        if (updatedFields.dungeonsRequired !== undefined) {
                            entry.dungeonsRequired = updatedFields.dungeonsRequired;
                        }
                        if (updatedFields.positions !== undefined) {
                            entry.positions = updatedFields.positions;
                        }
                        if (updatedFields.level !== undefined) {
                            entry.level = updatedFields.level;
                        }
                        // Succès imbriqués : conservés dans le JSON compilé pour survivre à un re-seed.
                        if (updatedFields.entryKind !== undefined) {
                            entry.entryKind = updatedFields.entryKind;
                        }
                        if (updatedFields.parentName !== undefined) {
                            if (updatedFields.parentName) entry.parentName = updatedFields.parentName;
                            else delete entry.parentName;
                        }
                        modified = true;
                    }
                }
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(dofusData, null, 2), "utf-8");
    }
}

export async function upsertQuestEntry(id: string | null, data: z.infer<typeof EntrySchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = EntrySchema.parse(data);

        // ── Succès imbriqués ────────────────────────────────────────────────
        // Un conteneur (`ACHIEVEMENT`) porte des objectifs : il ne compte pas comme
        // étape (poids 0) et son parent éventuel doit être un succès de la même
        // section, sans créer de cycle (God = seul écrivain, garde-fous ici).
        const entryKind = validated.entryKind ?? QUEST_KIND;
        let parentEntryId: string | null = null;
        let parentName: string | null = null;

        if (validated.parentEntryId) {
            const parent = await (db as any).dofusQuestEntry.findUnique({
                where: { id: validated.parentEntryId },
                select: { id: true, name: true, chainId: true, entryKind: true },
            });
            if (!parent) return { success: false, error: "Succès parent introuvable" };
            if (parent.chainId !== validated.chainId) {
                return { success: false, error: "Le succès parent doit appartenir à la même section" };
            }
            if (parent.entryKind !== ACHIEVEMENT_KIND) {
                return { success: false, error: "Le parent doit être un succès (nature « Succès »)" };
            }
            if (id) {
                const chainEntries = await (db as any).dofusQuestEntry.findMany({
                    where: { chainId: validated.chainId },
                    select: { id: true, parentEntryId: true },
                });
                if (wouldCreateCycle(chainEntries, id, parent.id)) {
                    return { success: false, error: "Lien impossible : ce succès est déjà un objectif descendant" };
                }
            }
            parentEntryId = parent.id;
            parentName = parent.name;
        }

        const payload: any = {
            ...validated,
            entryKind,
            parentEntryId,
        };
        // Un succès conteneur ne pèse pas dans la progression ; une quête garde son
        // poids pondéré (V3) quand elle est ré-enregistrée.
        if (entryKind === ACHIEVEMENT_KIND) payload.weight = 0;

        const record = id 
            ? await (db as any).dofusQuestEntry.update({ where: { id }, data: payload })
            : await (db as any).dofusQuestEntry.create({ data: payload });
        
        const chain = await (db as any).dofusQuestChain.findUnique({
            where: { id: validated.chainId },
            include: { dofus: true }
        });
        
        if (chain?.dofus?.slug) {
            await syncEntryToLocalJson(chain.dofus.slug, validated.name, {
                externalRef: validated.externalRef,
                coords: validated.coords,
                dofusdbId: validated.dofusdbId,
                localImageUrl: validated.localImageUrl,
                dungeonsRequired: (validated as any).dungeonsRequired,
                positions: (validated as any).positions,
                level: validated.level,
                entryKind,
                parentName,
            });
        }
        await logQuestWrite(id ? "update-quest-entry" : "create-quest-entry", id ?? (record as any)?.id, {
            name: validated.name,
            entryKind,
            parentName,
        });

        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        logger.error("[upsertQuestEntry] Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde de l'étape" };
    }
}

export async function deleteQuestEntry(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        // Succès imbriqués : supprimer un succès conteneur supprime ses objectifs
        // (la colonne `parentEntryId` n'a pas de FK — cf. schema.prisma).
        const entry = await (db as any).dofusQuestEntry.findUnique({
            where: { id },
            select: { id: true, chainId: true, entryKind: true },
        });
        if (!entry) return { success: false, error: "Étape introuvable" };

        let idsToDelete = [id];
        if (entry.entryKind === ACHIEVEMENT_KIND) {
            const chainEntries = await (db as any).dofusQuestEntry.findMany({
                where: { chainId: entry.chainId },
                select: { id: true, parentEntryId: true },
            });
            const tree = buildQuestTree(chainEntries);
            idsToDelete = collectSubtreeIds(tree, id);
        }

        await (db as any).dofusQuestEntry.deleteMany({ where: { id: { in: idsToDelete } } });
        await logQuestWrite("delete-quest-entry", id, { cascaded: idsToDelete.length - 1 });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[deleteQuestEntry] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * Move a quest chain (section) up or down in the dofus
 * Approche robuste : on trie TOUS les frères (chainOrder asc + id en tie-break),
 * on permute par index, puis on re-persiste des chainOrder CONTIGUS (0..N-1).
 * → corrige les doublons/lacunes hérités du siphon (chainOrder @default(0))
 *   qui provoquaient un faux « Déjà en dernière position ».
 */
export async function reorderQuestChain(chainId: string, direction: "up" | "down"): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    const dir = z.enum(["up", "down"]).safeParse(direction);
    if (!dir.success) return { success: false, error: "Direction invalide" };

    try {
        const chain = await (db as any).dofusQuestChain.findUnique({
            where: { id: chainId },
            select: { id: true, dofusId: true }
        });

        if (!chain) return { success: false, error: "Section introuvable" };

        const siblings = await (db as any).dofusQuestChain.findMany({
            where: { dofusId: chain.dofusId },
            select: { id: true },
            orderBy: [{ chainOrder: "asc" }, { id: "asc" }]
        });

        const index = siblings.findIndex((s: any) => s.id === chainId);
        if (index === -1) return { success: false, error: "Section introuvable" };

        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= siblings.length) {
            return { success: false, error: direction === "up" ? "Déjà en première position" : "Déjà en dernière position" };
        }

        // Swap positions
        const list = siblings.map((s: any) => s.id);
        [list[index], list[target]] = [list[target], list[index]];

        // Re-persist contiguous chainOrder in one transaction
        await (db as any).$transaction(
            list.map((id: string, i: number) =>
                (db as any).dofusQuestChain.update({ where: { id }, data: { chainOrder: i } })
            )
        );

        revalidatePath("/god/quetes-dofus");
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[reorderQuestChain] Error:", error);
        return { success: false, error: "Erreur lors du réordonnancement" };
    }
}

/**
 * Move a quest entry up or down in the chain order
 * Même approche que reorderQuestChain : tri + swap par index + stepOrder contigus.
 */
export async function reorderQuestEntry(entryId: string, direction: "up" | "down"): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    const dir = z.enum(["up", "down"]).safeParse(direction);
    if (!dir.success) return { success: false, error: "Direction invalide" };

    try {
        const entry = await (db as any).dofusQuestEntry.findUnique({
            where: { id: entryId },
            select: { id: true, chainId: true, parentEntryId: true }
        });

        if (!entry) return { success: false, error: "Étape introuvable" };

        // Fratrie = même section ET même parent (un objectif se réordonne parmi
        // les objectifs de son succès, pas parmi les quêtes racines).
        const siblings = await (db as any).dofusQuestEntry.findMany({
            where: { chainId: entry.chainId, parentEntryId: entry.parentEntryId ?? null },
            select: { id: true },
            orderBy: [{ stepOrder: "asc" }, { id: "asc" }]
        });

        const index = siblings.findIndex((s: any) => s.id === entryId);
        if (index === -1) return { success: false, error: "Étape introuvable" };

        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= siblings.length) {
            return { success: false, error: direction === "up" ? "Déjà en première position" : "Déjà en dernière position" };
        }

        // Swap positions
        const list = siblings.map((s: any) => s.id);
        [list[index], list[target]] = [list[target], list[index]];

        // Re-persist contiguous stepOrder in one transaction
        await (db as any).$transaction(
            list.map((id: string, i: number) =>
                (db as any).dofusQuestEntry.update({ where: { id }, data: { stepOrder: i } })
            )
        );

        revalidatePath("/god/quetes-dofus");
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("[reorderQuestEntry] Error:", error);
        return { success: false, error: "Erreur lors du réordonnancement" };
    }
}

// =============================================================================
// PREREQUISITES — DofusQuestPrerequisite CRUD
// =============================================================================

export async function getQuestPrerequisites(questId: string): Promise<ActionResponse<{ from: any[]; to: any[] }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const from = await (db as any).dofusQuestPrerequisite.findMany({
            where: { toQuestId: questId },
            include: {
                fromQuest: { select: { id: true, name: true, stepOrder: true, questType: true } }
            }
        });

        const to = await (db as any).dofusQuestPrerequisite.findMany({
            where: { fromQuestId: questId },
            include: {
                toQuest: { select: { id: true, name: true, stepOrder: true, questType: true } }
            }
        });

        return { success: true, data: { from, to } };
    } catch (error) {
        logger.error("[getQuestPrerequisites] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

export async function getSiblingQuestEntries(chainId: string, excludeQuestId?: string | null): Promise<ActionResponse<any[]>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const chain = await (db as any).dofusQuestChain.findUnique({
            where: { id: chainId },
            select: { dofusId: true }
        });

        if (!chain) return { success: false, error: "Chaîne introuvable" };

        // #146 : exclusion optionnelle — en mode création (pas encore d'entrée) on liste
        // toutes les quêtes du même Dofus pour préparer les prérequis.
        // Prérequis : uniquement des quêtes jouables (un succès conteneur n'est
        // jamais un prérequis — il n'a pas d'état propre).
        const where: any = {
            chain: { dofusId: chain.dofusId },
            entryKind: QUEST_KIND,
        };
        if (excludeQuestId) where.id = { not: excludeQuestId };

        const entries = await (db as any).dofusQuestEntry.findMany({
            where,
            select: {
                id: true,
                name: true,
                stepOrder: true,
                questType: true,
                zone: true,
                entryKind: true,
                chain: { select: { sectionName: true } }
            },
            orderBy: [{ stepOrder: "asc" }]
        });

        return { success: true, data: entries };
    } catch (error) {
        logger.error("[getSiblingQuestEntries] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

export async function addQuestPrerequisite(fromQuestId: string, toQuestId: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    if (fromQuestId === toQuestId) {
        return { success: false, error: "Une quête ne peut pas être son propre prérequis" };
    }

    try {
        const existing = await (db as any).dofusQuestPrerequisite.findUnique({
            where: { fromQuestId_toQuestId: { fromQuestId, toQuestId } }
        });

        if (existing) return { success: false, error: "Ce prérequis existe déjà" };

        const reverseExists = await (db as any).dofusQuestPrerequisite.findUnique({
            where: { fromQuestId_toQuestId: { fromQuestId: toQuestId, toQuestId: fromQuestId } }
        });

        if (reverseExists) return { success: false, error: "Dépendance circulaire détectée" };

        await (db as any).dofusQuestPrerequisite.create({
            data: { fromQuestId, toQuestId }
        });
        await logQuestWrite("add-quest-prerequisite", undefined, { fromQuestId, toQuestId });

        revalidatePath("/god/quetes-dofus");
        return { success: true };
    } catch (error) {
        logger.error("[addQuestPrerequisite] Error:", error);
        return { success: false, error: "Erreur lors de l'ajout du prérequis" };
    }
}

export async function removeQuestPrerequisite(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusQuestPrerequisite.delete({ where: { id } });
        await logQuestWrite("remove-quest-prerequisite", id);
        revalidatePath("/god/quetes-dofus");
        return { success: true };
    } catch (error) {
        logger.error("[removeQuestPrerequisite] Error:", error);
        return { success: false, error: "Erreur lors de la suppression du prérequis" };
    }
}

// =============================================================================
// DOFUSDB PUMPER — legacy, kept for data imports
// =============================================================================

export async function pumpQuestsFromDofusDB(
    chainId: string,
    questIds: number[]
): Promise<ActionResponse<{ count: number }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        let count = 0;

        for (const qid of questIds) {
            const response = await fetch(`https://api.dofusdb.fr/quests/${qid}`);
            if (!response.ok) continue;
            
            const qData = await response.json();
            
            const lastEntry = await (db as any).dofusQuestEntry.findFirst({
                where: { chainId },
                orderBy: { stepOrder: 'desc' },
                select: { stepOrder: true }
            });
            const nextOrder = (lastEntry?.stepOrder ?? -1) + 1;

            await (db as any).dofusQuestEntry.create({
                data: {
                    chainId,
                    name: qData.name?.fr || qData.className,
                    zone: qData.category?.name?.fr || "DofusDB Import",
                    questType: "QUEST",
                    stepOrder: nextOrder,
                    dofusdbId: qid,
                    notes: qData.steps?.[0]?.description?.fr || "Pumped from DofusDB",
                    requirements: qData.need ? { 
                        quests: qData.need.quests || [],
                        level: qData.levelMin || 1
                    } : null
                }
            });
            count++;
        }

        revalidatePath("/god/game-data");
        return { success: true, data: { count } };
    } catch (error) {
        logger.error("[pumpQuestsFromDofusDB] error:", error);
        return { success: false, error: "Erreur lors du pompage DofusDB" };
    }
}

export async function compileDofusChain(slug: string): Promise<ActionResponse<{ log: string }>> {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
        return { success: false, error: "Slug invalide" };
    }
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const { stdout: compileOut } = await execAsync(
            `npx tsx scripts/dofus-compiler-v3.ts --dofus=${slug}`,
            { cwd: process.cwd() }
        );
        
        const { stdout: seedOut } = await execAsync(
            `npx tsx scripts/seed-argent-tree.ts --dofus=${slug}`,
            { cwd: process.cwd() }
        );

        revalidatePath("/god/quetes-dofus");
        revalidatePath(`/dashboard`);
        return { success: true, data: { log: `${compileOut}\n\n${seedOut}` } };
    } catch (error: any) {
        logger.error("[compileDofusChain] Error:", error);
        return { success: false, error: "Erreur sync: " + (error?.message || "Inconnue") };
    }
}

export async function compileAllDofus(): Promise<ActionResponse<{ log: string }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const { stdout: compileOut } = await execAsync(
            `npx tsx scripts/dofus-compiler-v3.ts --all`,
            { cwd: process.cwd() }
        );
        
        revalidatePath("/god/quetes-dofus");
        return { success: true, data: { log: compileOut || "Compilation globale terminée ✅" } };
    } catch (error: any) {
        logger.error("[compileAllDofus] Error:", error);
        return { success: false, error: "Erreur globale: " + (error?.message || "Inconnue") };
    }
}

export async function getDofusHealthReport(): Promise<ActionResponse<any[]>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const dofusItems = await (db as any).dofusItem.findMany({
            include: {
                _count: {
                    select: { questChains: true }
                },
                questChains: {
                    include: {
                        _count: {
                            select: { entries: true }
                        }
                    }
                }
            }
        });

        const report = dofusItems.map((d: any) => {
            const totalQuests = d.questChains.reduce((acc: number, chain: any) => acc + chain._count.entries, 0);
            const isImageBroken = d.imageUrl?.includes("api.dofusdb.fr") || !d.imageUrl;
            
            return {
                id: d.id,
                name: d.name,
                slug: d.slug,
                chainsCount: d._count.questChains,
                totalQuests,
                imageUrl: d.imageUrl,
                status: totalQuests === 0 ? "EMPTY" : (isImageBroken ? "CRITICAL" : "OK")
            };
        });

        return { success: true, data: report };
    } catch (error) {
        logger.error("[getDofusHealthReport] Error:", error);
        return { success: false, error: "Erreur lors du rapport de santé" };
    }
}
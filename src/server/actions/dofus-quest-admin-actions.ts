"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
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
async function requireSuperAdmin() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    return session.user.id;
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
    chainOrder: z.number().int().default(0),
});

const EntrySchema = z.object({
    chainId: z.string(),
    name: z.string().min(1),
    zone: z.string().optional().nullable(),
    questType: z.string().default("QUEST"),
    stepOrder: z.number().int().default(0),
    isOptional: z.boolean().default(false),
    isLast: z.boolean().default(false),
    dofusdbId: z.number().int().optional().nullable(),
    mapId: z.number().int().optional().nullable(),
    coords: z.object({
        x: z.number().nullable(),
        y: z.number().nullable()
    }).optional().nullable(),
    requirements: z.any().optional(),
    notes: z.string().optional().nullable(),
    externalRef: z.string().optional().nullable(),
    dungeonsRequired: z.any().optional().nullable(),
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
                    orderBy: { chainOrder: "asc" },
                    include: {
                        entries: {
                            orderBy: { stepOrder: "asc" }
                        }
                    }
                }
            }
        });
        return { success: true, data };
    } catch (error) {
        console.error("[getDofusManagementData] Error:", error);
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
        
        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        console.error("[upsertDofusItem] Error:", error);
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
        console.error("[updateDofusCategory] Error:", error);
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
        console.error("[getDofusItemsForTagging] Error:", error);
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
        revalidatePath("/god/game-data");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("[updateDofusTags] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour des tags" };
    }
}

export async function deleteDofusItem(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusItem.delete({ where: { id } });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        console.error("[deleteDofusItem] Error:", error);
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
        
        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        console.error("[upsertQuestChain] Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde de la chaîne" };
    }
}

export async function deleteQuestChain(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusQuestChain.delete({ where: { id } });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        console.error("[deleteQuestChain] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

export async function upsertQuestEntry(id: string | null, data: z.infer<typeof EntrySchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = EntrySchema.parse(data);
        const record = id 
            ? await (db as any).dofusQuestEntry.update({ where: { id }, data: validated })
            : await (db as any).dofusQuestEntry.create({ data: validated });
        
        revalidatePath("/god/game-data");
        return { success: true, data: record };
    } catch (error) {
        console.error("[upsertQuestEntry] Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde de l'étape" };
    }
}

export async function deleteQuestEntry(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).dofusQuestEntry.delete({ where: { id } });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        console.error("[deleteQuestEntry] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * "Pumper" de quêtes DofusDB
 * Prélève les données brutes de l'API DofusDB pour pré-remplir la chaîne
 */
export async function pumpQuestsFromDofusDB(
    chainId: string,
    questIds: number[]
): Promise<ActionResponse<{ count: number }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        let count = 0;

        for (const qid of questIds) {
            // Fetch raw data from DofusDB
            const response = await fetch(`https://api.dofusdb.fr/quests/${qid}`);
            if (!response.ok) continue;
            
            const qData = await response.json();
            
            // Get last order in chain
            const lastEntry = await (db as any).dofusQuestEntry.findFirst({
                where: { chainId },
                orderBy: { stepOrder: 'desc' },
                select: { stepOrder: true }
            });
            const nextOrder = (lastEntry?.stepOrder ?? -1) + 1;

            // Create entry
            await (db as any).dofusQuestEntry.create({
                data: {
                    chainId,
                    name: qData.name?.fr || qData.className,
                    zone: qData.category?.name?.fr || "DofusDB Import",
                    questType: "QUEST",
                    stepOrder: nextOrder, // We use the same 'nextOrder' for bulk for simplicity or increment it
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
        console.error("[pumpQuestsFromDofusDB] error:", error);
        return { success: false, error: "Erreur lors du pompage DofusDB" };
    }
}

export async function compileDofusChain(slug: string): Promise<ActionResponse<{ log: string }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        // 1. Compile
        const { stdout: compileOut } = await execAsync(
            `npx tsx scripts/dofus-compiler-v3.ts --dofus=${slug}`,
            { cwd: process.cwd() }
        );
        
        // 2. Seed
        const { stdout: seedOut } = await execAsync(
            `npx tsx scripts/seed-argent-tree.ts --dofus=${slug}`,
            { cwd: process.cwd() }
        );

        revalidatePath("/god/quetes-dofus");
        revalidatePath(`/dashboard`);
        return { success: true, data: { log: `${compileOut}\n\n${seedOut}` } };
    } catch (error: any) {
        console.error("[compileDofusChain] Error:", error);
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
        console.error("[compileAllDofus] Error:", error);
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
        console.error("[getDofusHealthReport] Error:", error);
        return { success: false, error: "Erreur lors du rapport de santé" };
    }
}


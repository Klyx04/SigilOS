"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db as prisma } from "@/lib/prisma";
import path from "path";

const execAsync = promisify(exec);

export type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Server Action pour déclencher le Siphoner V3
 * (Tougli + DofusDB + DofusPourLesNoobs)
 */
export async function runV3Siphoner(slug: string): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Non autorisé" };

    try {
        console.log(`[V3_SIPHONER] Starting for ${slug}...`);
        
        // On utilise la version JS buildée pour éviter les lenteurs tsx en runtime action
        const scriptPath = path.join(process.cwd(), "scripts", "v3", "multi-source-siphoner.js");
        const { stdout, stderr } = await execAsync(`node ${scriptPath} ${slug}`);
        
        if (stderr && !stdout) {
            console.error(`[V3_SIPHONER] Error for ${slug}:`, stderr);
            return { success: false, error: stderr };
        }

        console.log(`[V3_SIPHONER] Success for ${slug}:`, stdout);
        revalidatePath("/god/quetes-dofus");
        
        return { success: true };
    } catch (error: any) {
        console.error(`[V3_SIPHONER] Fatal error for ${slug}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Update V3 coordinates for a specific quest entry (Atomic)
 */
export async function updateV3QuestCoordinates(
    id: string, 
    coords: { x: number; y: number }
): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Non autorisé" };

    try {
        await (prisma as any).dofusQuestEntry.update({
            where: { id },
            data: { coordinatesV3: coords }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Erreur lors de la mise à jour des coordonnées" };
    }
}

/**
 * Update V3 coordinates for a quest chain (Global/Container offset)
 */
export async function updateV3ChainCoordinates(
    id: string, 
    coords: { x: number; y: number; zoom: number }
): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Non autorisé" };

    try {
        await (prisma as any).dofusQuestChain.update({
            where: { id },
            data: { coordinatesV3: coords }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Erreur lors de la mise à jour de la chaîne" };
    }
}

"use server";
import { logger } from "@/lib/logger";

import { isSuperAdmin } from "./super-admin-actions";
import fs from "fs";
import path from "path";

export type AssetType = "portraits" | "maps";

export interface AssetInfo {
    name: string;
    url: string;
}

/**
 * List assets from the public directory (portraits or maps for bounties)
 * Accessible only by super-admins (God mode)
 */
export async function getBountyAssets(type: AssetType): Promise<{ success: boolean; data?: AssetInfo[]; error?: string }> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const subDir = type === "portraits" ? "portraits" : "maps";
        const relativeDir = `/assets/avis/${subDir}`;
        const absoluteDir = path.join(process.cwd(), "public", "assets", "avis", subDir);

        if (!fs.existsSync(absoluteDir)) {
            return { success: true, data: [] };
        }

        const files = fs.readdirSync(absoluteDir);
        
        // Filter for images
        const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
        const assets: AssetInfo[] = files
            .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
            .map(file => ({
                name: file,
                url: `${relativeDir}/${file}`
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return { success: true, data: assets };
    } catch (error) {
        logger.error(`[Assets] Failed to list ${type}:`, error);
        return { success: false, error: "Erreur lors de la lecture des fichiers" };
    }
}

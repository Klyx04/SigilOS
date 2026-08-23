"use server";

import fs from "fs";
import path from "path";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { revalidatePath } from "next/cache";
import { WorldMapService } from "../games/SigilGuesser/WorldMapService";
import { logger } from "@/lib/logger";

export async function deleteMapFileAndBlacklist(id: number) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // 1. Suppression physique de l'image HD si existante sur le disque
    const sanitizedId = String(id).replace(/[^0-9]/g, "");
    const hdDir = path.resolve(process.cwd(), "public", "game-data", "hd_maps");
    const hdFilePath = path.resolve(hdDir, `${sanitizedId}.webp`);
    try {
        if (fs.existsSync(hdFilePath)) {
            fs.unlinkSync(hdFilePath);
            logger.info(`[GodActions] 🗑️ Image HD physique supprimée du disque : ${hdFilePath}`);
        }
    } catch (err) {
        logger.error(`[GodActions] Erreur suppression fichier image HD : ${hdFilePath}`, { error: err });
    }

    // 2. Récupération et mise à jour de la configuration Singleton (Blacklist + Nettoyage Signalements)
    const config = await getPlatformConfig();
    const currentBlacklist: number[] = Array.isArray(config.geoguesserBlacklist) ? (config.geoguesserBlacklist as number[]) : [];
    const currentReports: any[] = Array.isArray(config.geoguesserReportedMaps) ? (config.geoguesserReportedMaps as any[]) : [];

    const updatedBlacklist = currentBlacklist.includes(id) ? currentBlacklist : [...currentBlacklist, id];
    const updatedReports = currentReports.filter((r: any) => (typeof r === 'number' ? r !== id : r?.id !== id));

    const updated = await db.platformConfig.update({
        where: { id: "singleton" },
        data: {
            geoguesserBlacklist: updatedBlacklist,
            geoguesserReportedMaps: updatedReports as any
        }
    });

    // 3. Synchronisation immédiate de l'instance serveur
    WorldMapService.getInstance().setBlacklist(updatedBlacklist);

    revalidatePath("/god/mini-games");
    revalidatePath("/dashboard/[guildId]/mini-jeux", "layout");
    return { success: true, blacklist: updatedBlacklist, reportedMaps: updatedReports };
}

export async function getMiniGamesStatus() {
    // This action doesn't strictly need superadmin check if we want to show status on public/member pages,
    // but the management part MUST be protected.
    return db.miniGameStatus.findMany();
}

export async function updateMiniGameStatus(gameId: string, isEnabled: boolean, maintenanceMsg?: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const updated = await db.miniGameStatus.upsert({
        where: { gameId },
        update: { 
            isEnabled, 
            maintenanceMsg: maintenanceMsg || "🔧 Ce jeu est temporairement indisponible pour maintenance." 
        },
        create: { 
            gameId, 
            isEnabled, 
            maintenanceMsg: maintenanceMsg || "🔧 Ce jeu est temporairement indisponible pour maintenance." 
        },
    });

    revalidatePath("/god");
    revalidatePath("/dashboard/[guildId]/mini-jeux", "layout");
    return updated;
}

export async function getPlatformConfig() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    let config = await db.platformConfig.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await db.platformConfig.create({ data: { id: "singleton" } });
    }
    logger.debug(`[PlatformConfig] Fetching singleton: ${(config.geoguesserReportedMaps as any[])?.length || 0} reported maps, ${config.geoguesserBlacklist?.length || 0} blacklisted.`);
    return config;
}

export async function updateGeoguesserConfig(data: { blacklist?: number[], reportedMaps?: any[] }) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const updated = await db.platformConfig.update({
        where: { id: "singleton" },
        data: {
            geoguesserBlacklist: data.blacklist,
            geoguesserReportedMaps: data.reportedMaps ? (data.reportedMaps as any) : undefined
        }
    });

    // Immediate sync for the current server instance
    if (data.blacklist) {
        WorldMapService.getInstance().setBlacklist(data.blacklist);
    }

    revalidatePath("/god/mini-games");
    revalidatePath("/dashboard/[guildId]/mini-jeux", "layout");
    return updated;
}

export async function getMapsInfo(ids: number[]) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const svc = WorldMapService.getInstance();
    svc.loadData();
    
    return ids.map(id => {
        const m = svc.getMap(id);
        return m || { id, x: 0, y: 0, worldMap: 0, outdoor: true, unknown: true };
    });
}

"use server";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { revalidatePath } from "next/cache";
import { WorldMapService } from "../games/SigilGuesser/WorldMapService";

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
    console.log(`[PlatformConfig] Fetching singleton: ${(config.geoguesserReportedMaps as any[])?.length || 0} reported maps, ${config.geoguesserBlacklist?.length || 0} blacklisted.`);
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

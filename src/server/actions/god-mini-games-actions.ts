"use server";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { revalidatePath } from "next/cache";

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

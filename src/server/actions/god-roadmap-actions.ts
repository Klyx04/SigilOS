"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

async function isGod() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user.id;
}

export async function getRoadmapItems() {
    try {
        const items = await db.roadmapItem.findMany({
            orderBy: [
                { createdAt: 'asc' },
            ],
        });
        return { success: true, data: items };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createRoadmapItem(data: {
    title: string;
    description: string;
    status: string;
    quarter: string;
    priority: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const item = await db.roadmapItem.create({ data });
        revalidatePath("/god/roadmap");
        revalidatePath("/roadmap");
        return { success: true, data: item };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateRoadmapItem(id: number, data: {
    title?: string;
    description?: string;
    status?: string;
    quarter?: string;
    priority?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.roadmapItem.update({
            where: { id },
            data
        });
        revalidatePath("/god/roadmap");
        revalidatePath("/roadmap");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteRoadmapItem(id: number) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.roadmapItem.delete({
            where: { id }
        });
        revalidatePath("/god/roadmap");
        revalidatePath("/roadmap");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function toggleRoadmapVisibility(enabled: boolean) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.platformConfig.upsert({
            where: { id: "singleton" },
            update: { roadmapEnabled: enabled },
            create: { id: "singleton", roadmapEnabled: enabled }
        });
        revalidatePath("/god/roadmap");
        revalidatePath("/roadmap");
        revalidatePath("/");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e: any) {
        logger.error("[Roadmap] Toggle Visibility Error:", e);
        return { success: false, error: "KO Prisma" };
    }
}


export async function getPlatformConfig() {
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" }
        });
        return { success: true, data: config };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

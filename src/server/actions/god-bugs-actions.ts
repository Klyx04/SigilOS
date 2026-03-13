"use server";

import { db } from "@/lib/prisma";
import { getSuperAdminIds, isSuperAdmin } from "@/server/actions/super-admin-actions";
import { SystemIssueType, SystemIssueStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const SUPER_ADMINS = process.env.SUPER_ADMIN_IDS?.split(",") || [];

async function isGod() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user.id;
}

export async function getSystemIssues() {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisÃ©" };

    try {
        const issues = await db.systemIssue.findMany({
            orderBy: [
                { status: 'asc' }, // A FAIRE first
                { createdAt: 'desc' },
            ],
        });
        return { success: true, data: issues };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createSystemIssue(data: {
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisÃ©" };

    try {
        await db.systemIssue.create({
            data: {
                ...data,
                creatorId: adminId,
            }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateSystemIssueStatus(id: number, status: SystemIssueStatus) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisÃ©" };

    try {
        await db.systemIssue.update({
            where: { id },
            data: { status }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSystemIssue(id: number) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisÃ©" };

    try {
        await db.systemIssue.delete({
            where: { id }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

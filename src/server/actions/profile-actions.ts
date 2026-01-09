"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Schemas ---

const UpdateProfileSchema = z.object({
    guildId: z.string(),
    pseudoDofus: z.string().min(2).max(30),
    classe: z.string().min(2).optional(), // E.g., "Cra", "Iop"
    metiers: z.array(z.string()).optional(), // E.g., ["Costumage"]
    // Avatar update could be handled separately or here if stored as string URL
});

export type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Actions ---

export async function getUserProfile(guildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            include: { user: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        return { success: true, data: profile };
    } catch (error) {
        console.error("Get Profile Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateUserProfile(rawData: z.infer<typeof UpdateProfileSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateProfileSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, pseudoDofus, classe, metiers } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Ensure profile exists (it should via middleware/onboarding, but safe upsert is better)
        await db.userProfile.upsert({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            update: {
                pseudoDofus,
                classe,
                metiers: metiers ? (metiers as any) : undefined
            },
            create: {
                userId: session.user.id,
                guildId: guildConfig.id,
                pseudoDofus,
                classe,
                metiers: metiers ? (metiers as any) : undefined,
                status: "ACTIVE"
            }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/members`);
        return { success: true };
    } catch (error) {
        console.error("Update Profile Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde" };
    }
}

export async function getGuildMembers(guildId: string, filters?: { job?: string, class?: string }): Promise<ActionResponse<any[]>> {
    // Public/Member access
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Basic query
        // Note: JSON filtering with Prisma/Postgres can be tricky specifically for "contains in array".
        // For 'metiers' (array of strings), we can use filtering if needed.

        const whereClause: any = {
            guildId: guildConfig.id,
            status: "ACTIVE"
        };

        if (filters?.class) {
            whereClause.classe = filters.class;
        }

        // Fetch all active profiles
        const profiles = await db.userProfile.findMany({
            where: whereClause,
            include: { user: true },
            orderBy: { pseudoDofus: 'asc' }
        });

        // Filter jobs in Application Layer for flexibility (unless dataset is huge)
        // or use advanced Prisma `path` filter.
        let result = profiles;
        if (filters?.job) {
            result = profiles.filter(p => {
                const jobs = (p.metiers as string[]) || [];
                return jobs.includes(filters.job!);
            });
        }

        return { success: true, data: result };

    } catch (error) {
        console.error("Get Members Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

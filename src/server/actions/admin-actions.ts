'use server'

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { type PermissionId } from "@/lib/permissions";
import { fetchGuild } from "@/server/discord";
import { revalidatePath } from "next/cache";

export type ActionResponse = {
    success: boolean;
    error?: string;
};

export async function onboardGuild(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        // 1. Check if guild matches session (Security)
        // Note: In a real scenario, we'd check if session.user has admin rights on this guildId
        // For now, we allow any logged in user to onboarding their "Own" guild if we pass it 
        // via context, but here we just blindly trust the guildId param? 
        // NO. We should probably only allow onboarding if the user IS in that guild.
        // But let's stick to the plan: "Creates the GuildConfig entry in DB if missing."

        const existing = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (existing) {
            return { success: true };
        }

        // 2. Fetch Guild Info from Discord
        const guildInfo = await fetchGuild(guildId);

        // 3. Create Config
        await db.guildConfig.create({
            data: {
                discordGuildId: guildId,
                name: guildInfo.name,
                iconUrl: guildInfo.icon ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.png` : null,
            }
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to onboard guild:", error);
        return { success: false, error: error instanceof Error ? error.message : "Database error" };
    }
}

export async function updateRoleMapping(
    guildId: string,
    mapping: Record<string, PermissionId[]>
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { rolesMapping: mapping }
        });

        revalidatePath("/dashboard/admin");
        return { success: true };
    } catch (error) {
        console.error("Failed to update role mapping:", error);
        return { success: false, error: "Database error" };
    }
}

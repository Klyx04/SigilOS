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
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // 1. Check if already exists (Idempotency)
        const existing = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (existing) {
            return { success: true };
        }

        // 2. SECURITY CHECK: Verify User is Admin of this Guild
        // We must fetch the User's Discord Account ID first
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const discordUserId = account.providerAccountId;

        // Fetch Guild Info (for Owner check & Name)
        const guildInfo = await fetchGuild(guildId);

        // Fetch Member (for Roles)
        const { fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const member = await fetchGuildMember(guildId, discordUserId);

        if (!member) return { success: false, error: "You are not a member of this guild" };

        let isAdmin = false;

        // Check 1: Is Owner?
        if (guildInfo.owner_id === discordUserId) {
            isAdmin = true;
        } else {
            // Check 2: Has Administrator Permission (0x8)?
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));

            // Check if any role has the 0x8 bit set
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Insufficient permissions: Administrator required" };
        }

        // 3. Create Config (Safe to proceed)
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

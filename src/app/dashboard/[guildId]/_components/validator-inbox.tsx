import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission } from "@/server/actions/user-actions";
import { ValidatorInboxClient } from "./validator-inbox-client";

interface ValidatorInboxProps {
    guildId: string;
}

export async function ValidatorInbox({ guildId }: ValidatorInboxProps) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const [missionGuard, adminGuard] = await Promise.all([
        checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_VALIDATE),
        checkGuildPermission(session, guildId, PERMISSIONS.ADMIN_ACCESS),
    ]);

    if (!missionGuard.allowed && !adminGuard.allowed) return null;

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
    });
    if (!guild) return null;

    const [pendingMissions, pendingAchievements] = await Promise.all([
        missionGuard.allowed
            ? db.submission.count({ where: { mission: { guildId: guild.id }, status: "PENDING" } })
            : 0,
        adminGuard.allowed
            ? (db as any).achievementSubmission.count({ where: { guildId: guild.id, status: "PENDING" } })
            : 0,
    ]);

    const initialData = {
        pendingMissions,
        pendingAchievements,
        total: pendingMissions + pendingAchievements
    };

    // We render the client component if authorized, so it can poll and show up even if initially 0
    return <ValidatorInboxClient guildId={guildId} initialData={initialData} />;
}

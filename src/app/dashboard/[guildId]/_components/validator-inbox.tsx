import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission } from "@/server/actions/user-actions";
import { ClipboardList, Trophy } from "lucide-react";
import Link from "next/link";

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

    const total = pendingMissions + pendingAchievements;
    if (total === 0) return null;

    return (
        <Link
            href={`/dashboard/${guildId}/admin/validation`}
            className="group flex flex-col gap-2 px-4 py-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all shadow-[0_0_20px_rgba(249,115,22,0.08)] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
        >
            {/* Title */}
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
                Pensez à valider !
            </p>

            {/* Counts */}
            <div className="flex items-center gap-3">
                {pendingMissions > 0 && (
                    <div className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span className="text-sm font-black text-white tabular-nums">{pendingMissions}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                            mission{pendingMissions > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
                {pendingMissions > 0 && pendingAchievements > 0 && (
                    <span className="text-zinc-700 text-xs">·</span>
                )}
                {pendingAchievements > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-sm font-black text-white tabular-nums">{pendingAchievements}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                            succès
                        </span>
                    </div>
                )}
            </div>
        </Link>
    );
}

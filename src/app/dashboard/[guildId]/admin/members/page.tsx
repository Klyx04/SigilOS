import { Suspense } from "react";
import { getUserContext, getGuildMemberStats, getGuildMembers } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import MemberManagement from "@/components/admin/members/member-management";
import { db } from "@/lib/prisma";
import { fetchGuildChannels, fetchGuildRoles } from "@/server/discord";

export const metadata = {
    title: "Gestion des Membres | SigilOS",
    description: "Audit, réconciliation et gestion des profils membres.",
};

interface AdminMembersPageProps {
    params: Promise<{
        guildId: string;
    }>;
}

export default async function AdminMembersPage({ params }: AdminMembersPageProps) {
    const { guildId } = await params;
    
    let ctx, stats, members, guildConfig, channels, roles;
    
    try {
        // Parallel fetching for performance
        [ctx, stats, members, guildConfig, channels, roles] = await Promise.all([
            getUserContext(guildId),
            getGuildMemberStats(guildId),
            getGuildMembers(guildId),
            db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { welcomeBadgeName: true }
            }),
            fetchGuildChannels(guildId),
            fetchGuildRoles(guildId)
        ]);
    } catch (err) {
        console.error("[CRITICAL] Members Page Fetch Error:", err);
        throw err; // Re-throw to trigger boundary
    }

    const textChannels = (channels || []).filter(c => c.type === 0 || c.type === 5);

    // RBAC: Need Admin, Member Manage, or Relance Manage permission
    if (!ctx.isAdmin && !ctx.canManageMembers && !ctx.canManageRelance) {
        redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="container max-w-7xl mx-auto py-6 lg:py-10 px-4">
            <Suspense fallback={<AdminMembersSkeleton />}>
                <MemberManagement 
                    guildId={guildId} 
                    initialStats={stats}
                    initialMembers={members}
                    welcomeBadgeName={guildConfig?.welcomeBadgeName || "Nouveau"}
                    isSuperAdmin={ctx.isSuperAdmin}
                    channels={textChannels as any}
                    roles={roles || []}
                    canManageMembers={ctx.canManageMembers || ctx.isAdmin}
                    canManageRelance={ctx.canManageRelance}
                    currentUserId={ctx.id || ""}
                />
            </Suspense>
        </div>
    );
}

function AdminMembersSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="space-y-4">
                <div className="h-12 w-[400px] bg-zinc-900/50 rounded-2xl" />
                <div className="h-4 w-[600px] bg-zinc-900/40 rounded-lg" />
            </div>
            <div className="h-14 w-[500px] bg-zinc-900/50 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 w-full bg-zinc-900/40 rounded-2xl border border-white/5" />
                ))}
            </div>
            <div className="space-y-4">
                <div className="h-16 w-full bg-zinc-900/40 rounded-2xl border border-white/5" />
                <div className="h-[400px] w-full bg-zinc-900/20 rounded-2xl border border-white/5" />
            </div>
        </div>
    );
}

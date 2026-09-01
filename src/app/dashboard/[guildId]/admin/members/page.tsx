import { Suspense } from "react";
import { getUserContext, getGuildMemberStats, getGuildMembers } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import MemberManagement from "@/components/admin/members/member-management";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
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
            <div className="flex items-start justify-between gap-4 mb-6" data-tour="admin-members-header">
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Audit & Gestion des Membres</h1>
                    <p className="text-sm text-muted-foreground mt-1">Audit Discord vs Dashboard, synchronisation des pseudos, archivage et relances.</p>
                </div>
                <ModuleHelpActions 
                    docSlug="admin-members" 
                    docTitle="Audit & Gestion des Membres" 
                    tourPhase="adminMembers" 
                />
            </div>
            <Suspense fallback={<AdminMembersSkeleton />}>
                <div data-tour="admin-members-table">
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
                </div>
            </Suspense>
        </div>
    );
}

function AdminMembersSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="space-y-4">
                <div className="h-12 w-[400px] bg-surface/50 rounded-2xl" />
                <div className="h-4 w-[600px] bg-surface/40 rounded-lg" />
            </div>
            <div className="h-14 w-[500px] bg-surface/50 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 w-full bg-surface/40 rounded-2xl border border-border" />
                ))}
            </div>
            <div className="space-y-4">
                <div className="h-16 w-full bg-surface/40 rounded-2xl border border-border" />
                <div className="h-[400px] w-full bg-surface/20 rounded-2xl border border-border" />
            </div>
        </div>
    );
}

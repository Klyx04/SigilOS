import { Suspense } from "react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { fetchGuildChannels, fetchGuildRoles } from "@/server/discord";
import { getGuildLifecycleData } from "@/server/actions/member-lifecycle-actions";
import { MemberLifecycleManager } from "@/components/admin/members/member-lifecycle-manager";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

export const metadata = {
    title: "Recrutement & Cycle de Vie | SigilOS",
    description: "Annuaire guilde, période d'essai, gestion des mules et historique des départs.",
};

interface AdminRecruitmentPageProps {
    params: Promise<{
        guildId: string;
    }>;
}

export default async function AdminRecruitmentPage({ params }: AdminRecruitmentPageProps) {
    const { guildId } = await params;
    
    let ctx, lifecycleRes, channels, roles;
    
    try {
        [ctx, lifecycleRes, channels, roles] = await Promise.all([
            getUserContext(guildId),
            getGuildLifecycleData(guildId),
            fetchGuildChannels(guildId),
            fetchGuildRoles(guildId)
        ]);
    } catch (err) {
        console.error("[CRITICAL] Recruitment Page Fetch Error:", err);
        throw err;
    }

    const textChannels = (channels || []).filter(c => c.type === 0 || c.type === 5);

    // RBAC: Need Admin or Member Manage permission
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        redirect(`/dashboard/${guildId}`);
    }

    if (!lifecycleRes.success || !lifecycleRes.data) {
        return (
            <div className="container max-w-7xl mx-auto py-10 px-4 text-center">
                <p className="text-destructive font-bold">Erreur de chargement des données de recrutement.</p>
            </div>
        );
    }

    return (
        <div className="container max-w-7xl mx-auto py-6 lg:py-10 px-4 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Recrutement & Cycle de Vie</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Période d&apos;essai, annuaire guilde, gestion des mules et historique des départs.
                    </p>
                </div>
                <ModuleHelpActions 
                    docSlug="module-recrutement-cycle-de-vie" 
                    docTitle="Recrutement & Cycle de Vie" 
                    tourPhase="adminRecruitment" 
                />
            </div>

            <Suspense fallback={<AdminRecruitmentSkeleton />}>
                <MemberLifecycleManager 
                    guildId={guildId}
                    initialData={lifecycleRes.data}
                    roles={roles || []}
                    channels={textChannels as any}
                    canManageMembers={ctx.canManageMembers || ctx.isAdmin}
                    isAdmin={ctx.isAdmin}
                />
            </Suspense>
        </div>
    );
}

function AdminRecruitmentSkeleton() {
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

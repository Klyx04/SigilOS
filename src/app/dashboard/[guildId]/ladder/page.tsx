import { Suspense } from "react";
import { Trophy, Clock, TrendingUp } from "lucide-react";
import { LadderTabs } from "./_components/ladder-tabs";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function LadderPage({ params }: Props) {
    const { guildId } = await params;

    // RBAC: Check permission to view Ladder
    const user = await getUserContext(guildId);
    if (!user.canViewLadder) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Classement de Guilde"
                description="Découvrez les membres les plus actifs et leur progression en jeu."
                imageSrc="/assets/ui/icons/ladder.png"
                backHref={`/dashboard/${guildId}`}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                        <span className="text-sm font-medium text-purple-300">Activité</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">XP gagnée via les missions</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-cyan-400" />
                        <span className="text-sm font-medium text-cyan-300">Ancienneté</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Les piliers de la guilde</p>
                </div>
            </div>

            {/* Ladder Tabs */}
            <Suspense fallback={<LadderSkeleton />}>
                <LadderTabs guildId={guildId} />
            </Suspense>
        </div>
    );
}

function LadderSkeleton() {
    return (
        <div className="space-y-4">
            <div className="h-12 bg-muted/20 rounded-lg animate-pulse" />
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/10 rounded-lg animate-pulse" />
                ))}
            </div>
        </div>
    );
}

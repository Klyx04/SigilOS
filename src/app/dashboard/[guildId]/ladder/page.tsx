import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { LadderClient } from "./_components/ladder-client";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { redirect } from "next/navigation";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function LadderPage({ params }: Props) {
    const { guildId } = await params;

    // Module guard
    if (!await isModuleEnabled(guildId, "ladder")) {
        redirect(`/dashboard/${guildId}`);
    }

    // RBAC: Check permission to view Ladder
    const user = await getUserContext(guildId);
    if (!user.canViewLadder) {
        return <AccessDenied />;
    }

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-10 pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
                <UnifiedModuleHeader
                    title="Classement de Guilde"
                    description="Découvrez les membres les plus actifs et leur progression en jeu."
                    icon={Trophy}
                    iconColor="#f59e0b"
                    backHref={`/dashboard/${guildId}`}
                />

                {/* Main Client Module */}
                <Suspense fallback={<LadderSkeleton />}>
                    <LadderClient guildId={guildId} canValidate={user.canValidateMissions} />
                </Suspense>
            </div>
        </div>
    );
}

function LadderSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 bg-white/5 border border-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-white/5 border border-white/5 rounded-lg animate-pulse" />
                ))}
            </div>
        </div>
    );
}

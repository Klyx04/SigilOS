import { BarChart3 } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { db } from "@/lib/prisma";
import StatsClient from "./_components/stats-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

export default async function StatsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewStats) {
        return <AccessDenied />;
    }

    if (!user.isSuperAdmin && !await isModuleEnabled(guildId, "stats")) {
        redirect(`/dashboard/${guildId}`);
    }

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { missionVitrineMode: true },
    });

    const missionsModuleEnabled = await isModuleEnabled(guildId, "missions");
    const missionsEnabled = missionsModuleEnabled && !guildConfig?.missionVitrineMode;
    const questsEnabled = await isModuleEnabled(guildId, "quests");
    const servicesEnabled = await isModuleEnabled(guildId, "services");
    const songesEnabled = await isModuleEnabled(guildId, "songes");
    const minigamesEnabled = await isModuleEnabled(guildId, "minigames");

    const result = await getGuildStats(guildId);

    if (!result.success || !result.stats) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-border">
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                        <BarChart3 className="w-12 h-12 text-violet-500 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Statistiques Guilde</h1>
                        <p className="text-muted-foreground">Erreur lors du téléchargement des données.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="stats-header">
                <UnifiedModuleHeader
                    title="Statistiques Guilde"
                    description="Suivez l'activité de votre guilde et de ses membres."
                    icon={BarChart3}
                    iconColor="#a78bfa"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="stats" />}
                />
            </div>
            <div data-tour="stats-board">
                <StatsClient
                    stats={result.stats}
                    missionsEnabled={missionsEnabled}
                    questsEnabled={questsEnabled}
                    servicesEnabled={servicesEnabled}
                    songesEnabled={songesEnabled}
                    minigamesEnabled={minigamesEnabled}
                />
            </div>
        </div>
    );
}

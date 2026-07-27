import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Sparkles, BookOpen, BarChart3 } from "lucide-react";
import { getGuildPresentation } from "@/server/actions/presentation-actions";
import PresentationContent from "./_components/presentation-content";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import StatsClient from "../stats/_components/stats-client";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { GuildHubTabs } from "./_components/guild-hub-tabs";

type Props = { 
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ tab?: string }>;
};

export default async function GuildHubPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { tab } = await searchParams;
    const initialTab = tab || "presentation";

    const user = await getUserContext(guildId);
    
    // Check if user has access to at least one of the tabs
    const canViewAny = user.canViewPresentation || user.canViewStats;
    if (!canViewAny) return <AccessDenied />;

    return (
        <div className="space-y-12 pb-24">
            <UnifiedModuleHeader
                title="La Guilde"
                description="Espace communautaire • Vie interne, histoire et performances."
                icon={Sparkles}
                iconColor="#ffffff"
                backHref={`/dashboard/${guildId}`}
            />

            <Tabs value={initialTab} className="w-full">
                <GuildHubTabs 
                    initialTab={initialTab}
                    canViewWelcome={false}
                    canViewPresentation={!!user.canViewPresentation}
                    canViewStats={!!user.canViewStats}
                />

                {/* --- Presentation Tab --- */}
                {user.canViewPresentation && (
                    <TabsContent value="presentation" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                        <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                            <PresentationTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}

                {/* --- Stats Tab --- */}
                {user.canViewStats && (
                    <TabsContent value="stats" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                        <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                            <StatsTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

async function PresentationTabContent({ guildId, user }: { guildId: string, user: any }) {
    const guild = await getGuildPresentation(guildId, false);
    if (!guild) return null;

    return <PresentationContent guild={guild} user={user} guildId={guildId} />;
}

async function StatsTabContent({ guildId, user }: { guildId: string, user: any }) {
    const enabled = await isModuleEnabled(guildId, "stats");
    if (!user.isAdmin && !enabled) return <AccessDenied />;

    const result = await getGuildStats(guildId);
    if (!result.success || !result.stats) {
        return (
            <div className="p-12 text-center text-zinc-500 bg-white/5 rounded-2xl border border-white/5">
                Erreur lors du chargement des statistiques.
            </div>
        );
    }

    return <StatsClient stats={result.stats} />;
}

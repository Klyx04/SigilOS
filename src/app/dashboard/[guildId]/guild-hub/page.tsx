import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Sparkles, BookOpen, BarChart3, MessageSquare } from "lucide-react";
import { getGuildPresentation } from "@/server/actions/presentation-actions";
import { db } from "@/lib/prisma";
import PresentationContent from "./_components/presentation-content";
import { getWelcomePosts } from "@/server/actions/onboarding-admin-actions";
import { WelcomeFeedClient } from "../welcome/_components/welcome-feed-client";
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

    const user = await getUserContext(guildId);
    
    // Check if user has access to at least one of the tabs
    const canViewAny = user.canViewWelcome || user.canViewPresentation;
    if (!canViewAny) return <AccessDenied />;

    // Determine initial tab based on available permissions
    const defaultTab = user.canViewPresentation ? "presentation" : "welcome";
    const initialTab = tab || defaultTab;

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
                    canViewWelcome={!!user.canViewWelcome}
                    canViewPresentation={!!user.canViewPresentation}
                />

                {/* --- Welcome Tab --- */}
                {user.canViewWelcome && (
                    <TabsContent value="welcome" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                        <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                            <WelcomeTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}

                {/* --- Presentation Tab --- */}
                {user.canViewPresentation && (
                    <TabsContent value="presentation" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                        <Suspense fallback={<div className="h-64 rounded-2xl bg-white/5 animate-pulse" />}>
                            <PresentationTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

async function WelcomeTabContent({ guildId, user }: { guildId: string, user: any }) {
    const { posts, reactorNames } = await getWelcomePosts(guildId);
    if (posts.length === 0) {
        return (
            <div className="p-12 rounded-2xl border border-white/5 bg-zinc-900/40 text-center space-y-4 max-w-3xl mx-auto">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-6 h-6 text-zinc-500" />
                </div>
                <div className="space-y-1">
                    <p className="text-zinc-400 font-bold">Aucun message de bienvenue</p>
                    <p className="text-xs text-zinc-600">Les nouveaux membres s'afficheront ici quand ils rejoindront la guilde.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <WelcomeFeedClient
                initialPosts={posts}
                reactorNames={reactorNames}
                currentProfileId={user.profileId || ""}
                guildId={guildId}
            />
        </div>
    );
}

async function PresentationTabContent({ guildId, user }: { guildId: string, user: any }) {
    const guild = await getGuildPresentation(guildId, false);
    if (!guild) return null;

    return <PresentationContent guild={guild} user={user} guildId={guildId} />;
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Sparkles, MessageSquare } from "lucide-react";
import { getGuildPresentation } from "@/server/actions/presentation-actions";
import PresentationContent from "./_components/presentation-content";
import ReglementContent from "./_components/reglement-content";
import { getWelcomePosts } from "@/server/actions/onboarding-admin-actions";
import { WelcomeFeedClient } from "../welcome/_components/welcome-feed-client";
import { GuildHubTabs } from "./_components/guild-hub-tabs";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

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
                actions={<ModuleHelpActions docSlug="introduction" docTitle="La Guilde & Présentation" tourPhase="presentation" />}
            />

            <Tabs value={initialTab} className="w-full">
                <GuildHubTabs 
                    initialTab={initialTab}
                    canViewWelcome={!!user.canViewWelcome}
                    canViewPresentation={!!user.canViewPresentation}
                    canViewRules={!!user.canViewPresentation}
                />

                {/* --- Welcome Tab --- */}
                {user.canViewWelcome && (
                    <TabsContent value="welcome" className="mt-6 border-none p-0 outline-none">
                        <Suspense fallback={<div className="h-64 rounded-lg border border-border-strong bg-surface" />}>
                            <WelcomeTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}

                {/* --- Presentation Tab --- */}
                {user.canViewPresentation && (
                    <TabsContent value="presentation" className="mt-6 border-none p-0 outline-none">
                        <Suspense fallback={<div className="h-64 rounded-lg border border-border-strong bg-surface" />}>
                            <PresentationTabContent guildId={guildId} user={user} />
                        </Suspense>
                    </TabsContent>
                )}

                {/* --- Règlement Tab (contenu interne, membres connectés uniquement) --- */}
                {user.canViewPresentation && (
                    <TabsContent value="reglement" className="mt-6 border-none p-0 outline-none">
                        <Suspense fallback={<div className="h-64 rounded-lg border border-border-strong bg-surface" />}>
                            <ReglementTabContent guildId={guildId} user={user} />
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
            <div className="p-12 rounded-2xl border border-border bg-surface/40 text-center space-y-4 max-w-3xl mx-auto">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mx-auto">
                    <MessageSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground font-bold">Aucun message de bienvenue</p>
                    <p className="text-xs text-muted-foreground">Les nouveaux membres s'afficheront ici quand ils rejoindront la guilde.</p>
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

async function ReglementTabContent({ guildId, user }: { guildId: string, user: any }) {
    // `false` = contexte **interne** : c'est le seul appel qui fait remonter `internalRules`
    // (le rendu public, lui, reçoit `internalRules: null` par construction).
    const guild = await getGuildPresentation(guildId, false);
    if (!guild) return null;

    return <ReglementContent guild={guild} user={user} guildId={guildId} />;
}

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { getUserGuilds } from "@/server/actions/user-actions";
import { isGuildAllowed } from "@/server/actions/super-admin-actions";
import { AlmanaxWidget } from "@/components/layout/almanax-widget";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { getGuildModules } from "@/server/actions/module-actions";
import { Suspense } from "react";
import { PresenceHeartbeat } from "./_components/presence-heartbeat";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // --- SECURITY: GUILD WHITELIST (Database-based) ---
    const allowed = await isGuildAllowed(guildId);
    if (!allowed) {
        return (
            <AccessDenied
                title="Bêta Fermée"
                message="L'accès à SigilOS est actuellement limité aux serveurs partenaires. Ce serveur n'est pas encore autorisé."
                variant="lock"
                action={<SignOutButton />}
            />
        );
    }


    const [user, guildData, userGuilds, events, modules] = await Promise.all([
        getUserContext(guildId),
        getGuildHeaderData(guildId),
        getUserGuilds(),
        import("@/server/actions/event-actions").then(mod => mod.getUpcomingGuildEvents(guildId)),
        getGuildModules(guildId),
    ]);

    if (!user.isMember) {
        return (
            <AccessDenied
                title="Accès Restreint"
                message={`Vous devez être membre du serveur Discord ${user.guildName} pour accéder à ce tableau de bord.`}
                variant="lock"
                action={<SignOutButton variant="ghost" />}
            />
        );
    }

    if (user.isCapacityFull) {
        return (
            <AccessDenied
                title="Guilde Pleine"
                message="Désolé, cette guilde a atteint sa capacité maximale sur SigilOS (350 membres). Contactez un administrateur pour augmenter la limite."
                variant="lock"
                action={<SignOutButton />}
            />
        );
    }

    return (
        <NebulaClientWrapper>
            <div className="flex h-screen h-[100dvh] overflow-hidden bg-zinc-950 font-sans selection:bg-primary/30 text-zinc-100 fixed inset-0">

                {/* 1. DESKTOP SIDEBAR (Fixed) */}
                <div className="hidden md:flex w-[280px] flex-col fixed inset-y-0 z-50">
                    <AppSidebar
                        guildId={guildId}
                        user={user}
                        guildData={guildData}
                        userGuilds={userGuilds}
                        modules={modules}
                        className="h-full border-r border-white/5"
                    />
                </div>

                {/* Silent Presence Update Hook */}
                <PresenceHeartbeat guildId={guildId} />

                {/* 2. MAIN CONTENT AREA (Offset by Sidebar width) */}
                <div className="flex-1 flex flex-col md:pl-[280px] transition-all duration-300 ease-in-out h-full overflow-hidden bg-black">

                    {/* Top Navigation - Fixed at top of content area */}
                    <div className="flex-shrink-0 z-50">
                        <TopNav
                            userId={user.id || ""}
                            sidebarProps={{ guildId, user, guildData, userGuilds, modules }}
                            events={events}
                        >
                            <div className="relative">
                                <Suspense fallback={<div className="h-8 w-8 bg-white/5 rounded-full animate-pulse" />}>
                                    <AlmanaxWidget />
                                </Suspense>
                            </div>
                        </TopNav>
                    </div>

                    {/* Scrollable Main Content - THE ONLY SCROLLABLE AREA */}
                    <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="container max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 min-h-full flex flex-col">

                            {/* Page Content */}
                            <div className="flex-1 animate-in fade-in duration-500 slide-in-from-bottom-4">
                                <Suspense fallback={<div className="h-full w-full bg-white/5 animate-pulse rounded-2xl min-h-[400px]" />}>
                                    {children}
                                </Suspense>
                            </div>

                            {/* Footer at bottom of content - Increased pb to 32 (128px) for safe dock area */}
                            <div className="mt-12 md:mt-24 pb-32">
                                <GalacticFooter />
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </NebulaClientWrapper>
    );
}

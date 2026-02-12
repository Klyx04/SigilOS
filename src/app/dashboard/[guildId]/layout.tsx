import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { getUserGuilds } from "@/server/actions/user-actions";
import { isGuildAllowed } from "@/server/actions/super-admin-actions";
import { AlmanaxWidget } from "@/components/layout/almanax-widget";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { Suspense } from "react";
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


    const [user, guildData, userGuilds, events] = await Promise.all([
        getUserContext(guildId),
        getGuildHeaderData(guildId),
        getUserGuilds(),
        import("@/server/actions/event-actions").then(mod => mod.getUpcomingGuildEvents(guildId))
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

    return (
        <NebulaClientWrapper>
            <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans selection:bg-primary/30 text-zinc-100">

                {/* 1. DESKTOP SIDEBAR (Fixed) */}
                <div className="hidden md:flex w-[280px] flex-col fixed inset-y-0 z-50">
                    <AppSidebar
                        guildId={guildId}
                        user={user}
                        guildData={guildData}
                        userGuilds={userGuilds}
                        className="h-full border-r border-white/5"
                    />
                </div>

                {/* 2. MAIN CONTENT AREA (Offset by Sidebar width) */}
                <div className="flex-1 flex flex-col md:pl-[280px] transition-all duration-300 ease-in-out h-full">

                    {/* Top Navigation */}
                    <TopNav
                        userId={user.id || ""}
                        sidebarProps={{ guildId, user, guildData, userGuilds }}
                        events={events}
                    >
                        {/* Pass Almanax Widget as child to TopNav (Right Side) */}
                        <div className="scale-90 origin-right">
                            <Suspense fallback={<div className="h-8 w-8 bg-white/5 rounded-full animate-pulse" />}>
                                {/* Just a trigger here? Or the full widget? */}
                                <AlmanaxWidget />
                            </Suspense>
                        </div>
                    </TopNav>

                    {/* Scrollable Main Content */}
                    <main className="flex-1 overflow-y-scroll overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="container max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] flex flex-col">

                            {/* Page Content */}
                            <div className="flex-1 animate-in fade-in duration-500 slide-in-from-bottom-4">
                                {children}
                            </div>

                            {/* Footer at bottom of content */}
                            <div className="mt-12 md:mt-24">
                                <GalacticFooter />
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </NebulaClientWrapper>
    );
}

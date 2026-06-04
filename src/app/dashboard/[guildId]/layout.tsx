import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { getUserContext, getUserGuilds } from "@/server/actions/user-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";

import { getGuildModules } from "@/server/actions/module-actions";
import { Suspense } from "react";
import { PresenceHeartbeat } from "./_components/presence-heartbeat";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AccessDenied } from "@/components/layout/access-denied";
import { TelemetryTracker } from "@/components/telemetry/telemetry-tracker";


import { ValidatorInbox } from "./_components/validator-inbox";
import { PseudoWarningBanner } from "@/components/layout/pseudo-warning-banner";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuildActivityStream } from "@/components/layout/guild-activity-stream";
import { PresenceProvider } from "@/components/providers/PresenceProvider";
import { GamesLiveWidget } from "@/components/shared/GamesLiveWidget";
import { ChangelogModal } from "@/components/changelog/changelog-modal";
import { CommandMenu } from "@/components/layout/command-menu";
import { SupportOrb } from "@/components/shared/support-orb";
import { GalacticFooter } from "@/components/layout/galactic-footer";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // --- SECURITY: BASE AUTH CHECK ---
    const session = await auth();
    if (!session?.user) redirect("/");

    // SECURITY FIX: Detect expired Discord OAuth token (sessions immortelles)
    // The JWT callback marks sessions with error="DiscordTokenExpired" when token is expired
    if ((session as any).error === "DiscordTokenExpired") {
        redirect("/auth/signout?reason=token_expired");
    }

    const eventsPromise = import("@/server/actions/event-actions").then(mod => mod.getUpcomingGuildEvents(guildId));
    
    const [user, guildData, userGuilds, modules, configRes] = await Promise.all([
        getUserContext(guildId),
        getGuildHeaderData(guildId),
        getUserGuilds(),
        getGuildModules(guildId),
        import("@/server/actions/god-roadmap-actions").then(mod => mod.getPlatformConfig())
    ]);

    const roadmapEnabled = configRes.success && configRes.data ? (configRes.data as any).roadmapEnabled : false;
    const donationsEnabled = configRes.success && configRes.data ? (configRes.data as any).donationsEnabled : true;

    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";

    // ── GUILD NOT WHITELISTED (getUserContext returns isAuthenticated:false for blocked guilds) ──
    if (!user.isAuthenticated) {
        return (
            <AccessDenied
                guildId={guildId}
                title="Bêta Fermée"
                message="L'accès à SigilOS est actuellement limité aux serveurs partenaires. Ce serveur n'est pas encore autorisé."
                variant="lock"
                action={<SignOutButton />}
            />
        );
    }

    // ── ARCHIVED: specific message to contact staff ──
    if ((user as any).isArchived) {
        return (
            <AccessDenied
                title="Compte Archivé"
                message={`Votre profil sur ${user.guildName} a été archivé par un administrateur. Contactez votre staff sur Discord pour demander votre réactivation.`}
                variant="archive"
                action={<SignOutButton variant="ghost" />}
                countdownDate={(user as any).scheduledDeletion}
                hasPendingReactivation={user.hasPendingReactivation}
            />
        );
    }

    // ── BANNED ──
    if ((user as any).isBanned) {
        return (
            <AccessDenied
                title="Accès Banni"
                message={`Votre accès au tableau de bord de ${user.guildName} a été révoqué. Contactez votre staff sur Discord si vous pensez qu'il s'agit d'une erreur.`}
                variant="ban"
                action={<SignOutButton variant="ghost" />}
                countdownDate={(user as any).scheduledDeletion}
            />
        );
    }

    // ── NOT A MEMBER ──
    if (!user.isMember) {
        return (
            <AccessDenied
                guildId={guildId}
                title="Accès Restreint"
                message={`Vous devez être membre du serveur Discord ${user.guildName} pour accéder à ce tableau de bord.`}
                variant="lock"
                action={<SignOutButton variant="ghost" />}
            />
        );
    }

    // ── ONOARDING/CONFIGURATION COMPLIANCE GATEWAY ──
    if (!user.isOnboardingComplete) {
        if (user.isAdmin) {
            const allowedOnboardingPaths = [
                `/dashboard/${guildId}/admin/getting-started`,
                `/dashboard/${guildId}/admin/settings`,
                `/dashboard/${guildId}/admin/permissions`
            ];
            const isPathAllowed = allowedOnboardingPaths.some(p => pathname.startsWith(p));
            if (!isPathAllowed) {
                redirect(`/dashboard/${guildId}/admin/getting-started`);
            }
        } else {
            return (
                <AccessDenied
                    title="Configuration en cours"
                    message={`Le tableau de bord de ${user.guildName || "votre guilde"} est en cours de configuration par les administrateurs. Revenez très bientôt !`}
                    variant="lock"
                    action={<SignOutButton variant="ghost" />}
                />
            );
        }
    }

    // ── NO DASHBOARD ACCESS (role-based) ──
    if (!user.canViewDashboard) {
        return (
            <AccessDenied
                title="Accès Non Autorisé"
                message={`Votre rôle Discord ne vous donne pas accès au tableau de bord de ${user.guildName}. Contactez un administrateur pour obtenir les permissions nécessaires.`}
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
            <TelemetryTracker />
            <div className="flex h-screen h-[100dvh] overflow-hidden bg-background font-sans selection:bg-primary/20 text-foreground fixed inset-0 dashboard-layout">


                {/* 1. DESKTOP SIDEBAR (Fixed) */}
                <div className="hidden lg:flex w-[280px] flex-col fixed inset-y-0 z-50">
                    <AppSidebar
                        guildId={guildId}
                        user={user}
                        guildData={guildData}
                        userGuilds={userGuilds}
                        modules={modules}
                        roadmapEnabled={roadmapEnabled}
                        className="h-full border-r border-border bg-muted/40 backdrop-blur-3xl shadow-[5px_0_30px_rgba(0,0,0,0.02)] dark:shadow-[20px_0_40px_rgba(0,0,0,0.4)]"
                    />
                </div>

                {/* Silent Presence Update Hook */}
                <PresenceHeartbeat guildId={guildId} />

                {/* 2. MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col lg:pl-[280px] h-full overflow-hidden">
                    {/* Top Navigation - Fixed at top of content area */}
                    <div className="flex-shrink-0 z-50 border-b border-border bg-background/40 backdrop-blur-xl">
                        <TopNav
                            userId={user.id || ""}
                            sidebarProps={{ guildId, user, guildData, userGuilds, modules }}
                            eventsPromise={eventsPromise}
                            roadmapEnabled={roadmapEnabled}
                        />
                    </div>

                    {/* Scrollable Main Content area */}
                    <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="relative z-10">
                            {/* System Announcement Banner */}
                            <Suspense fallback={null}>
                                <AnnouncementBanner />
                            </Suspense>

                            <div className="container max-w-[1536px] mx-auto p-4 sm:p-6 lg:p-8 pb-28 min-h-full flex flex-col">
                                {/* Pseudo issues (sync) banner */}
                                {user.hasPseudoIssue && (
                                    <PseudoWarningBanner guildId={guildId} pseudoDofus={user.pseudoDofus} />
                                )}

                                {/* Page Content */}
                                <div className="flex-1 animate-in fade-in duration-700">
                                    <Suspense fallback={<div className="h-full w-full bg-white/5 animate-pulse rounded-2xl min-h-[400px]" />}>
                                        {children}
                                    </Suspense>
                                </div>
                            </div>
                        </div>

                        {/* subtle background decoration */}
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse-slow" />
                    </main>
                </div>

                {/* Validator Inbox - Fixed floating reminder for validators (all pages) */}
                <div className="fixed top-[76px] right-8 z-40 hidden md:block">
                    <Suspense fallback={null}>
                        <ValidatorInbox guildId={guildId} />
                    </Suspense>
                </div>

                {/* Guild Activity Stream — popup toasts only */}
                <GuildActivityStream guildId={guildId} />

                {/* Changelog Modal (Global Platform Updates) */}
                <ChangelogModal />

                {/* Support Orb (Donation system STATE OF ART 2026) */}
                {donationsEnabled && <SupportOrb />}

                {/* Command Palette (Cmd+K) */}
                <CommandMenu guildId={guildId} user={user} />

                {/* 4. FLOATING FOOTER (Compact version) */}
                <GalacticFooter variant="compact" isMember={true} />
            </div>
        </NebulaClientWrapper>
    );
}

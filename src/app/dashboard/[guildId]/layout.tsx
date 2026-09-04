import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { GuildAccentStyle } from "@/components/layout/guild-accent-style";
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
import { ServiceReplyModal } from "@/components/services/service-reply-modal";
import { CommandMenu } from "@/components/layout/command-menu";
import { GalacticFooterGate } from "@/components/layout/galactic-footer-gate";
import { GameProvider } from "@/components/providers/GameProvider";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { TourProvider } from "@/components/tour/tour-provider";
import { TourOverlay } from "@/components/tour/tour-overlay";
import { TourCompletion } from "@/components/tour/tour-completion";
import { DocDrawerProvider } from "@/components/doc/doc-drawer-context";
import { DocDrawer } from "@/components/doc/doc-drawer";
import { RushOverlayHost } from "./_components/rush-overlay-host";

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

    // #5 — Couleur de guilde (teinte OKLCH) : le dashboard se teinte via --accent/--ring.
    const accentHue = await db.guildConfig
        .findUnique({ where: { discordGuildId: guildId }, select: { accentHue: true } })
        .then(g => g?.accentHue ?? null)
        .catch(() => null);

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

    // ── SERVER DELETED: specific message + signout button ──
    if ((user as any).isServerDeleted) {
        return (
            <AccessDenied
                title="Serveur Supprimé"
                message={`Le serveur Discord "${user.guildName}" a été supprimé. SigilOS n'est plus accessible pour ce serveur. Vous allez être déconnecté.`}
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

    // ── TIMEOUT DISCORD (« Exclure temporairement ») — suspension temporaire ──
    if ((user as any).isTimedOut && !(user as any).isSuperAdmin) {
        return (
            <AccessDenied
                title="Accès Temporairement Suspendu"
                message={`Vous êtes temporairement exclu du serveur Discord ${user.guildName} (timeout). Votre accès au tableau de bord sera rétabli automatiquement à la fin de la sanction.`}
                variant="timeout"
                action={<SignOutButton variant="ghost" />}
                countdownLabel="Accès rétabli dans"
                expiredLabel="Accès disponible"
                countdownDate={(user as any).timedOutUntil}
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

    // ── ONBOARDING/CONFIGURATION COMPLIANCE GATEWAY ──
    if (!user.isOnboardingComplete && !user.isAdmin) {
        return (
            <AccessDenied
                title="Configuration en cours"
                message={`Le tableau de bord de ${user.guildName || "votre guilde"} est en cours de configuration par les administrateurs. Revenez très bientôt !`}
                variant="lock"
                action={<SignOutButton variant="ghost" />}
            />
        );
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
            <GameProvider>
            <TelemetryTracker />
            <DocDrawerProvider>
            <TourProvider guildId={guildId} modules={modules} user={user}>
                <div className="dashboard-tour">
                    <TourOverlay />
                    <TourCompletion guildId={guildId} />
                </div>
                {/* Global Slide-Over Doc Drawer */}
                <DocDrawer guildId={guildId} />
                {/* V2 Phase 0 — teinte de guilde posée sur le root EXISTANT du dashboard
                    (pas de div empilé, ne casse pas le flex h-screen) :
                    --guild-hue / --guild-chroma-* / --success-hue → --accent / --ring /
                    --success recalculés par les tokens GROK. Un seul mécanisme d'injection. */}
                <GuildAccentStyle
                    hue={accentHue}
                    className="flex h-screen h-[100dvh] overflow-hidden bg-background font-sans selection:bg-primary/20 text-foreground fixed inset-0 dashboard-layout"
                >


                {/* 1. DESKTOP SIDEBAR (Fixed) */}
                <div data-tour="sidebar-root" className="dashboard-sidebar hidden lg:flex w-[var(--app-sidebar-width,280px)] flex-col fixed inset-y-0 z-50">
                    <AppSidebar
                        guildId={guildId}
                        user={user}
                        guildData={guildData}
                        userGuilds={userGuilds}
                        modules={modules}
                        roadmapEnabled={roadmapEnabled}
                        className="h-full border-r border-border bg-surface"
                    />
                </div>

                {/* Silent Presence Update Hook */}
                <PresenceHeartbeat guildId={guildId} />

                {/* 2. MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col lg:pl-[var(--app-sidebar-width,280px)] h-full overflow-hidden">
                    {/* Top Navigation - Fixed at top of content area */}
                    <div className="dashboard-topnav flex-shrink-0 z-50 border-b border-border bg-background">
                        <TopNav
                            userId={user.id || ""}
                            sidebarProps={{ guildId, user, guildData, userGuilds, modules }}
                            eventsPromise={eventsPromise}
                            roadmapEnabled={roadmapEnabled}
                        />
                    </div>

                    {/* Scrollable Main Content area */}
                    <main data-scroll-container="true" className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent [scrollbar-gutter:stable]">
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
                                <div className="flex-1 animate-in fade-in duration-200">
                                    <Suspense fallback={<div className="h-full w-full bg-surface animate-pulse rounded-2xl min-h-[400px]" />}>
                                        {children}
                                    </Suspense>
                                </div>
                            </div>
                        </div>
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

                {/* Global Service Dialogue Modal — visible sur toute page / refresh */}
                <ServiceReplyModal guildId={guildId} />

                {/* Overlay Rush persistant — survit à la navigation entre modules */}
                <RushOverlayHost />

                {/* Command Palette (Cmd+K) */}
                <CommandMenu guildId={guildId} user={user} />

                {/* 4. FLOATING FOOTER (Compact version) - hidden in game view */}
                <div className="dashboard-footer">
                    <GalacticFooterGate />
                </div>

                {/* Forced Onboarding Wizard (Missing character pseudo, class or preferred activities) */}
                {!user.isAdmin && (user.hasPseudoIssue || !user.classe || !user.hasPreferredActivities) && (
                    <OnboardingWizard
                        guildId={guildId}
                        userName={user.name || "Aventurier"}
                        show={true}
                        initialStep={user.hasPseudoIssue ? 1 : !user.classe ? 2 : 3}
                        initialPseudo={user.pseudoDofus || ""}
                        requireActivities={!user.hasPreferredActivities}
                    />
                )}
            </GuildAccentStyle>
            </TourProvider>
            </DocDrawerProvider>
            </GameProvider>
        </NebulaClientWrapper>
    );
}

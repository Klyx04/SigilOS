import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivePresence } from "@/server/actions/presence-actions";
import { getActivityLadder } from "@/server/actions/ladder-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { getUnifiedActiveGroups } from "@/server/actions/unified-groups-actions";
import { getStuffGalleryPage } from "@/server/actions/gallery-actions";
import { getUnifiedGuildActivity } from "@/server/actions/unified-activity-actions";
import { getUpcomingEvents, getActiveRaid } from "@/server/actions/calendar-actions";
import { getPolls } from "@/server/actions/poll-actions";

import { QuickStatsRow } from "./_components/quick-stats-row";
import { RecentDjPosts } from "./_components/recent-dj-posts";
import { RecentStuffGallery } from "./_components/recent-stuff-gallery";
import { AlmanaxWidget } from "./_components/almanax-widget";
import { GuildActivityFeed } from "./_components/guild-activity-feed";
import { UpcomingEventsWidget } from "./_components/upcoming-events-widget";
import { EchoDuSigil } from "./_components/echo-du-sigil";
import { ActivePollsWidget } from "./_components/active-polls-widget";
import { RaidHeroBanner } from "./_components/raid-hero-banner";

import { AccessDenied } from "@/components/layout/access-denied";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { MemberWelcomeModal } from "@/components/dashboard/member-welcome-modal";
import { DashboardAdminTourButton } from "@/components/tour/dashboard-admin-tour-button";

export default async function DashboardPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // ONBOARDING REDIRECT
    if (!user.isOnboardingComplete && user.isAdmin) {
        redirect(`/dashboard/${guildId}/admin/getting-started`);
    }

    // RBAC: Must be authenticated member of the guild
    if (!user.isAuthenticated || !user.isMember) {
        return <AccessDenied />;
    }

    // CAPACITY CHECK
    if (user.isCapacityFull) {
        return (
            <AccessDenied
                title="Guilde Pleine"
                message="Désolé, cette guilde a atteint sa capacité maximale sur SigilOS (350 membres)."
                variant="lock"
                action={<SignOutButton />}
            />
        );
    }

    // Parallel Data Fetching
    const [
        onlineUsersResult,
        weeklyLadder,
        monthlyLadder,
        profileResult,
        ocreProgress,
        guildStatsResult,
        almanaxItems,
        groupsResult,
        stuffResult,
        guildLogs,
        calendarResult,
        pollsResult,
        activeRaid,
    ] = await Promise.all([
        getActivePresence(guildId, 50),
        getActivityLadder(guildId, "weekly"),
        getActivityLadder(guildId, "monthly"),
        getUserProfile(guildId),
        user.canViewOcre ? getMyOcreProgress(guildId) : Promise.resolve({ success: false, data: undefined }),
        getGuildStats(guildId),
        getUpcomingAlmanax().catch(() => null),
        getUnifiedActiveGroups(guildId),
        getStuffGalleryPage(guildId, 1, undefined, undefined, undefined, "newest"),
        getUnifiedGuildActivity(guildId, 12).catch(() => []),
        getUpcomingEvents(guildId, 7).catch(() => ({ success: false, events: [] })),
        user.canViewPolls ? getPolls(guildId).catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: false, data: [] }),
        getActiveRaid(guildId).catch(() => null),
    ]);

    // Derived Data
    const focusData = await getDashboardFocus(guildId, user, ocreProgress.success ? ocreProgress.data : undefined);
    const profile = profileResult.success && profileResult.data ? profileResult.data : null;
    const activeGroups = groupsResult.success ? groupsResult.groups : [];
    const latestBuilds = stuffResult.success && stuffResult.data ? stuffResult.data.builds : [];
    const upcomingEvents = calendarResult.success ? calendarResult.events : [];
    const polls = pollsResult.success && pollsResult.data ? (pollsResult.data as any[]) : [];
    const hasRaidNow = !!activeRaid;

    // Quick Stats Data
    const guildStats = guildStatsResult.success && guildStatsResult.stats ? guildStatsResult.stats : null;
    const dofusCompletionRate = guildStats?.quests?.guildCompletionRate || 0;
    const onlineCount = onlineUsersResult.success ? (onlineUsersResult.totalActive || 0) : 0;
    const onlineUsers = onlineUsersResult.success ? onlineUsersResult.data : [];
    const totalMembers = guildStats?.activeMembers || 0;
    const songesCompleted = guildStats?.totalSongesCompleted || 0;
    const eventsCount = guildStats?.totalEvents || 0;
    const topActivityName = guildStats?.records?.[0]?.label || "";
    const topActivityValue = guildStats?.records?.[0]?.value || "";

    return (
        <div className="relative w-full min-h-full pb-20">
            {/* Background Decorators */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_50%_50%,var(--primary),transparent_70%)]" />
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-[0.02] dark:opacity-[0.04] saturate-100 blur-3xl scale-125 transition-opacity duration-1000" />

            {/* Modals */}
            {user.isAdmin && profile && !profile.hasSeenWelcome && (
                <WelcomeModal guildId={guildId} show={true} />
            )}
            {!user.isAdmin && profile && !profile.hasSeenWelcome && (
                <MemberWelcomeModal
                    guildId={guildId}
                    guildName={user.guildName || "ta guilde"}
                    userName={profile.pseudoDofus || user.name || "Aventurier"}
                    show={true}
                />
            )}

            <div className="relative z-10 p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">

                {/* ── 0. Subtle page label ─────────────────────────────── */}
                <header className="flex items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground/5 drop-shadow-sm uppercase italic select-none">
                        Dashboard
                    </h1>
                    <DashboardAdminTourButton isAdmin={user.isAdmin} />
                </header>

                {/* ── 1. QUICK STATS ROW ───────────────────────────────── */}
                <section data-tour="dash-stats" className="animate-in fade-in slide-in-from-top-2 duration-500">
                    <QuickStatsRow
                        onlineCount={onlineCount}
                        totalMembers={totalMembers}
                        songesCompleted={songesCompleted}
                        eventsCount={eventsCount}
                        dofusCompletionRate={dofusCompletionRate}
                        topActivityName={topActivityName}
                        topActivityValue={topActivityValue}
                        onlineUsers={onlineUsers}
                    />
                </section>

                {/* ── 2. RAID HERO (prioritaire — conditionnel) ────────── */}
                {hasRaidNow && (
                    <section data-tour="dash-raid" className="animate-in fade-in slide-in-from-top-2 duration-500">
                        <RaidHeroBanner guildId={guildId} raid={activeRaid as any} />
                    </section>
                )}

                {/* ── 3. INTELLIGENCE FOCUS (masqué si raid actif) ─────── */}
                {focusData && !hasRaidNow && (
                    <section data-tour="dash-focus" className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        <EchoDuSigil data={focusData} />
                    </section>
                )}

                {/* ── 4. EVENTS + SONDAGES ─────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <section data-tour="dash-events" className="lg:col-span-7 min-h-[340px]">
                        <UpcomingEventsWidget
                            guildId={guildId}
                            events={upcomingEvents as any}
                        />
                    </section>
                    <section data-tour="dash-polls" className="lg:col-span-5 min-h-[340px]">
                        <ActivePollsWidget
                            guildId={guildId}
                            polls={polls}
                        />
                    </section>
                </div>

                {/* ── 5. GROUPES ACTIFS + GALERIE ──────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                    <section data-tour="dash-groups" className="min-h-[360px]">
                        <RecentDjPosts guildId={guildId} groups={activeGroups} />
                    </section>
                    <section data-tour="dash-gallery" className="min-h-[360px]">
                        <RecentStuffGallery guildId={guildId} builds={latestBuilds} />
                    </section>
                </div>

                {/* ── 6. ALMANAX + ACTIVITÉ ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                    <section data-tour="dash-almanax">
                        <AlmanaxWidget
                            guildId={guildId}
                            initialAlmanax={almanaxItems?.[0] ?? null}
                        />
                    </section>
                    <section data-tour="dash-activity">
                        <GuildActivityFeed logs={guildLogs} guildId={guildId} />
                    </section>
                </div>

            </div>
        </div>
    );
}
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivityLadder } from "@/server/actions/ladder-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { getUnifiedActiveGroups } from "@/server/actions/unified-groups-actions";
import { getStuffGalleryPage } from "@/server/actions/gallery-actions";
import { getUnifiedGuildActivity } from "@/server/actions/unified-activity-actions";
import { getUpcomingEvents } from "@/server/actions/calendar-actions";

import { MissionsHero } from "./_components/missions-hero";
import { RecentDjPosts } from "./_components/recent-dj-posts";
import { RecentStuffGallery } from "./_components/recent-stuff-gallery";
import { AlmanaxWidget } from "./_components/almanax-widget";
import { GuildActivityFeed } from "./_components/guild-activity-feed";
import { UpcomingEventsWidget } from "./_components/upcoming-events-widget";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ArrowRight,
    Users,
    InfinityIcon,
    Sparkles,
    Target,
    Bug,
    CircleDashed,
    Flame,
    ScrollText,
    Library,
    Sword
} from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/layout/access-denied";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { MemberWelcomeModal } from "@/components/dashboard/member-welcome-modal";

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
        weeklyLadder, 
        monthlyLadder,
        profileResult, 
        ocreProgress, 
        guildStatsResult, 
        almanaxItems,
        groupsResult,
        stuffResult,
        guildLogs,
        calendarResult
    ] = await Promise.all([
        getActivityLadder(guildId, "weekly"),
        getActivityLadder(guildId, "monthly"),
        getUserProfile(guildId),
        user.canViewOcre ? getMyOcreProgress(guildId) : Promise.resolve({ success: false, data: undefined }),
        getGuildStats(guildId),
        getUpcomingAlmanax().catch(() => null),
        getUnifiedActiveGroups(guildId),
        getStuffGalleryPage(guildId, 1, undefined, undefined, undefined, "newest"),
        getUnifiedGuildActivity(guildId, 12).catch(() => []),
        getUpcomingEvents(guildId, 7).catch(() => ({ success: false, events: [] }))
    ]);

    // Derived Data
    const focusData = await getDashboardFocus(guildId, user, ocreProgress.success ? ocreProgress.data : undefined);
    const topWeeklyEntries = weeklyLadder.success && weeklyLadder.data ? weeklyLadder.data.entries : [];
    const topMonthlyEntries = monthlyLadder.success && monthlyLadder.data ? monthlyLadder.data.entries : [];
    const guildStats = guildStatsResult.success && guildStatsResult.stats ? guildStatsResult.stats : null;
    const profile = profileResult.success && profileResult.data ? profileResult.data : null;
    const activeGroups = groupsResult.success ? groupsResult.groups : [];
    const latestBuilds = stuffResult.success && stuffResult.data ? stuffResult.data.builds : [];
    const upcomingEvents = calendarResult.success ? calendarResult.events : [];

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

            <div className="relative z-10 p-4 md:p-6 space-y-8 max-w-[1600px] mx-auto">
                <header className="flex items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground/5 drop-shadow-sm uppercase italic select-none">
                        Dashboard
                    </h1>
                </header>

                {/* --- 1. HERO SECTION: MISSIONS --- */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <MissionsHero 
                        guildId={guildId} 
                        totalMissionsValidated={guildStats?.totalMissionsValidated}
                        totalXp={guildStats?.totalXp}
                    />
                </section>

                {/* --- 2. ACTIVITY & GALLERY ROW --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 min-h-[400px]">
                        <RecentDjPosts guildId={guildId} groups={activeGroups} />
                    </section>
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 min-h-[400px]">
                        <RecentStuffGallery guildId={guildId} builds={latestBuilds} />
                    </section>
                </div>

                {/* --- 3. SIDEBAR INFO ROW (Now Horizontal) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Almanax Widget */}
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                        <AlmanaxWidget 
                            guildId={guildId} 
                            initialAlmanax={almanaxItems?.[0] ?? null} 
                        />
                    </section>

                    {/* Upcoming Events Widget */}
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                        <UpcomingEventsWidget 
                            guildId={guildId}
                            events={upcomingEvents as any}
                        />
                    </section>

                    {/* Guild Activity Feed */}
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
                        <GuildActivityFeed logs={guildLogs} />
                    </section>
                </div>
            </div>
        </div>
    );
}

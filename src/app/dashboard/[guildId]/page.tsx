import { AuroraBackground } from "@/components/ui/aurora-background";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivityLadder } from "@/server/actions/ladder-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { getDjPosts } from "@/server/actions/dungeon-finder-actions";
import { getStuffGalleryPage } from "@/server/actions/gallery-actions";
import { getModuleLogs } from "@/server/actions/activity-log-actions";

import { MissionsHero } from "./_components/missions-hero";
import { RecentDjPosts } from "./_components/recent-dj-posts";
import { RecentStuffGallery } from "./_components/recent-stuff-gallery";
import { AlmanaxWidget } from "./_components/almanax-widget";
import { GuildActivityFeed } from "./_components/guild-activity-feed";

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
    ScrollText
} from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/layout/access-denied";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { GuidePulse } from "@/components/dashboard/guide-pulse";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { MemberWelcomeModal } from "@/components/dashboard/member-welcome-modal";

export default async function DashboardPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

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
        djPostsResult,
        stuffResult,
        guildLogs
    ] = await Promise.all([
        getActivityLadder(guildId, "weekly"),
        getActivityLadder(guildId, "monthly"),
        getUserProfile(guildId),
        user.canViewOcre ? getMyOcreProgress(guildId) : Promise.resolve({ success: false, data: undefined }),
        getGuildStats(guildId),
        getUpcomingAlmanax().catch(() => null),
        getDjPosts(guildId, { status: ["OPEN", "FULL"] }),
        getStuffGalleryPage(guildId, 1, undefined, undefined, undefined, "newest"),
        getModuleLogs(guildId, undefined, 10).catch(() => [])
    ]);

    // Derived Data
    const focusData = await getDashboardFocus(guildId, user, ocreProgress.success ? ocreProgress.data : undefined);
    const topWeeklyEntries = weeklyLadder.success && weeklyLadder.data ? weeklyLadder.data.entries : [];
    const topMonthlyEntries = monthlyLadder.success && monthlyLadder.data ? monthlyLadder.data.entries : [];
    const guildStats = guildStatsResult.success && guildStatsResult.stats ? guildStatsResult.stats : null;
    const profile = profileResult.success && profileResult.data ? profileResult.data : null;
    const activeDjPosts = djPostsResult.success ? djPostsResult.data || [] : [];
    const latestBuilds = stuffResult.success && stuffResult.data ? stuffResult.data.builds : [];

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

                {/* --- 2. MAIN BENTO GRID --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: Activity & Community (span 8) */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* Upper Row: Recruitment & Creations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 min-h-[400px]">
                                <RecentDjPosts guildId={guildId} posts={activeDjPosts} />
                            </section>
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 min-h-[400px]">
                                <RecentStuffGallery guildId={guildId} builds={latestBuilds} />
                            </section>
                        </div>


                        {/* Balanced Row: Songes & Monthly Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-12 lg:col-span-7">
                                 <Link href={`/dashboard/${guildId}/songes`} className="block h-full">
                                    <Card className="glass-premium border-border/50 hover:border-emerald-500/20 transition-all overflow-hidden relative group h-full min-h-[160px] flex flex-col justify-center">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-2">
                                                <InfinityIcon className="w-3 h-3 text-emerald-500" />
                                                Progression Songes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-end gap-2">
                                                <span className="text-4xl font-black text-foreground">{guildStats?.totalSongesCompleted || 0}</span>
                                                <span className="text-[10px] text-emerald-500 font-black uppercase mb-1">Runs complétées</span>
                                            </div>
                                        </CardContent>
                                        <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:scale-125 transition-transform duration-700">
                                            <InfinityIcon className="w-20 h-20 text-emerald-500" />
                                        </div>
                                    </Card>
                                </Link>
                            </div>
                            <div className="md:col-span-12 lg:col-span-5 text-center">
                                <Card className="glass-premium border-border/50 overflow-hidden p-6 text-center space-y-4 h-full flex flex-col justify-center">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Aperçu Mensuel</p>
                                    <div className="flex justify-center -space-x-2">
                                        {topMonthlyEntries.slice(0, 5).map((e) => (
                                            <Avatar key={e.profileId} className="h-8 w-8 ring-2 ring-background">
                                                <AvatarImage src={e.discordImage ?? undefined} />
                                                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{e.pseudoDofus?.[0]}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                    </div>
                                    <Link href={`/dashboard/${guildId}/ladder`} className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-foreground transition-colors">
                                        Voir le Ladder Complet →
                                    </Link>
                                </Card>
                            </div>
                        </div>

                        {/* Lower Row: Ocre & Profil */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {user.canViewOcre && (
                                <Link href={`/dashboard/${guildId}/archimonstres`} className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                                    <Card className="glass-premium hover:border-amber-500/50 transition-all group overflow-hidden relative h-32 flex flex-col justify-center">
                                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                                <Bug className="w-4 h-4 text-amber-500" />
                                                Quête Ocre
                                            </CardTitle>
                                            {ocreProgress.success && ocreProgress.data && (
                                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-black text-[9px]">
                                                    {ocreProgress.data.stats.progressPercent}%
                                                </Badge>
                                            )}
                                        </CardHeader>
                                        <CardContent className="px-4 pb-4 pt-0">
                                            <p className="text-[10px] text-muted-foreground font-bold italic">
                                                {ocreProgress.success && ocreProgress.data
                                                    ? `${ocreProgress.data.stats.manquants} archimonstres manquants.`
                                                    : "Liez Metamob pour suivre."}
                                            </p>
                                        </CardContent>
                                        <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-125 transition-transform duration-700">
                                            <Bug className="w-20 h-20 text-amber-500" />
                                        </div>
                                    </Card>
                                </Link>
                            )}

                            <Link href={`/dashboard/${guildId}/profile`} className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
                                <Card className="glass-premium hover:border-blue-500/50 transition-all group overflow-hidden relative h-32 flex flex-col justify-center">
                                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-blue-500" />
                                            Mon Profil
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 pt-0">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic opacity-60">
                                            Gérer mes métiers & identité
                                        </p>
                                    </CardContent>
                                    <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-125 transition-transform duration-700">
                                        <Users className="w-20 h-20 text-blue-500" />
                                    </div>
                                </Card>
                            </Link>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar Stats (span 4) */}
                    <aside className="lg:col-span-4 space-y-6">
                        {/* Almanax Widget */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                            <AlmanaxWidget 
                                guildId={guildId} 
                                initialAlmanax={almanaxItems?.[0] ?? null} 
                            />
                        </section>

                        {/* Guild Activity Feed */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 h-full">
                            <GuildActivityFeed logs={guildLogs} />
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
}

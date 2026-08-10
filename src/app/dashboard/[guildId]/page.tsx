import { redirect } from "next/navigation";

import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivePresence } from "@/server/actions/presence-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { getUnifiedActiveGroups } from "@/server/actions/unified-groups-actions";
import { getStuffGalleryPage } from "@/server/actions/gallery-actions";
import { getUnifiedGuildActivity } from "@/server/actions/unified-activity-actions";
import { getUpcomingEvents, getActiveRaid } from "@/server/actions/calendar-actions";
import { getPolls } from "@/server/actions/poll-actions";
import Link from "next/link";

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

    // Comparaisons temporelles (point 4 — KPI "parlants") : réutilise des données
    // DÉJÀ calculées par getGuildStats (0 requête supplémentaire → pas d'impact sur le pool).
    // - Membres : croissance nette du dernier mois (joins − leaves) via retention.growth.
    // - Événements : nombre créés ce mois-ci via events.thisMonth.
    const growth = guildStats?.retention?.growth || [];
    const lastGrowth = growth[growth.length - 1];
    const membersDelta = lastGrowth ? lastGrowth.joins - lastGrowth.leaves : null;
    const eventsDelta = typeof guildStats?.events?.thisMonth === "number" ? guildStats.events.thisMonth : null;
    // Vitrine (admin → missions) : on masque la carte "Progression Dofus" (même règle
    // que l'onglet "Présence & Feed" des profils — infos de progression cachées en lecture seule).
    const isVitrineActive = !!user.missionVitrineMode;

    // Contextual greeting (direction 2026 : header contextuel, plus de watermark ghost)
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
    const firstName = (user.name || "Aventurier").split(" ")[0];
    const nextEvent = upcomingEvents[0] as any;
    const contextLine = nextEvent?.title
        ? `Prochain rendez-vous : ${nextEvent.title}`
        : "Rien de prévu — la guilde est au calme";
    // "À faire maintenant" (direction 2026 §9.3) — actions compactes, jamais de vide pur
    const todoItems: { href: string; label: string; action: string }[] = [];
    const activePolls = (polls as any[]).filter((p: any) => p?.status === "ACTIVE");
    if (activePolls.length > 0) todoItems.push({ href: `/dashboard/${guildId}/sondages`, label: `${activePolls.length} sondage${activePolls.length > 1 ? "s" : ""} en cours`, action: "Voter" });
    if (nextEvent?.title) todoItems.push({ href: `/dashboard/${guildId}/calendar`, label: `Prochain : ${nextEvent.title}`, action: "Voir" });
    const todayAlmanax = almanaxItems?.[0];
    if (todayAlmanax) todoItems.push({ href: `/dashboard/${guildId}/ressources`, label: "Almanax du jour", action: "Offrande" });



    return (
        <div className="relative w-full min-h-full pb-20">
            
            
            

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

                <header className="flex items-end justify-between gap-6">
                    <div>
                        <h1 className="text-[26px] md:text-[28px] font-bold italic tracking-tight text-foreground">
                            {greeting} {firstName} ⚔
                        </h1>
                        <p className="text-[13px] text-muted-foreground mt-1">{contextLine}</p>
                    </div>
                    <DashboardAdminTourButton isAdmin={user.isAdmin} />
                </header>

                {/* ── 1. QUICK STATS ROW ───────────────────────────────── */}
                <section data-tour="dash-stats" className="animate-in fade-in slide-in-from-top-1 duration-150">
                    <QuickStatsRow
                        onlineCount={onlineCount}
                        totalMembers={totalMembers}
                        songesCompleted={songesCompleted}
                        eventsCount={eventsCount}
                        dofusCompletionRate={dofusCompletionRate}
                        topActivityName={topActivityName}
                        topActivityValue={topActivityValue}
                        onlineUsers={onlineUsers}
                        membersDelta={membersDelta}
                        eventsDelta={eventsDelta}
                        hideDofusProgress={isVitrineActive}
                    />
                </section>

                {/* ── 1.5 À FAIRE MAINTENANT (compact, direction §9.3) ──── */}
                {todoItems.length > 0 && (
                    <section data-tour="dash-todo" className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">À faire maintenant</span>
                                <span className="flex-1 h-px bg-white/[0.06]" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                {todoItems.map((item) => (
                                    <Link
                                        key={item.href + item.label}
                                        href={item.href}
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="text-[13px] truncate">{item.label}</span>
                                        <span className="ml-auto text-[12px] font-medium text-emerald-400/80 shrink-0">{item.action}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── 2. RAID HERO (prioritaire — conditionnel) ────────── */}
                {hasRaidNow && (
                    <section data-tour="dash-raid" className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <RaidHeroBanner guildId={guildId} raid={activeRaid as any} />
                    </section>
                )}

                {/* ── 3. INTELLIGENCE FOCUS (masqué si raid actif) ─────── */}
                {focusData && !hasRaidNow && (
                    <section data-tour="dash-focus" className="animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <EchoDuSigil data={focusData} />
                    </section>
                )}

                {/* ── 4. EVENTS + SONDAGES ─────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <section data-tour="dash-groups" className="min-h-[360px]">
                        <RecentDjPosts guildId={guildId} groups={activeGroups} />
                    </section>
                    <section data-tour="dash-gallery" className="min-h-[360px]">
                        <RecentStuffGallery guildId={guildId} builds={latestBuilds} />
                    </section>
                </div>

                {/* ── 6. ALMANAX + ACTIVITÉ ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
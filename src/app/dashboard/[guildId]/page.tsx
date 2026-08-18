import { redirect } from "next/navigation";

import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivePresence } from "@/server/actions/presence-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { getUnifiedActiveGroups } from "@/server/actions/unified-groups-actions";
import { getUnifiedGuildActivity } from "@/server/actions/unified-activity-actions";
import { getUpcomingEvents, getActiveRaid } from "@/server/actions/calendar-actions";
import { getPolls } from "@/server/actions/poll-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { hasFilledAvailability } from "@/lib/dofus-assets";
import { getISOWeek, getYear } from "date-fns";
import NextImage from "next/image";
import Link from "next/link";

import { QuickStatsRow } from "./_components/quick-stats-row";
import { RecentDjPosts } from "./_components/recent-dj-posts";
import { GuildActivityFeed } from "./_components/guild-activity-feed";
import { UpcomingEventsWidget } from "./_components/upcoming-events-widget";
import { EchoDuSigil } from "./_components/echo-du-sigil";
import { RaidHeroBanner } from "./_components/raid-hero-banner";

import { AccessDenied } from "@/components/layout/access-denied";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { MemberWelcomeModal } from "@/components/dashboard/member-welcome-modal";
import { DashboardAdminTourButton } from "@/components/tour/dashboard-admin-tour-button";
import { AvailabilityReminderPopup } from "@/components/dashboard/availability-reminder-popup";

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
        guildLogs,
        calendarResult,
        pollsResult,
        activeRaid,
        availabilityModuleEnabled,
    ] = await Promise.all([
        getActivePresence(guildId, 50),
        getUserProfile(guildId),
        user.canViewOcre ? getMyOcreProgress(guildId) : Promise.resolve({ success: false, data: undefined }),
        getGuildStats(guildId),
        getUpcomingAlmanax().catch(() => null),
        getUnifiedActiveGroups(guildId),
        getUnifiedGuildActivity(guildId, 12).catch(() => []),
        getUpcomingEvents(guildId, 7).catch(() => ({ success: false, events: [] })),
        user.canViewPolls ? getPolls(guildId).catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: false, data: [] }),
        getActiveRaid(guildId).catch(() => null),
        isModuleEnabled(guildId, "availability"),
    ]);

    // Derived Data
    const focusData = await getDashboardFocus(guildId, user, ocreProgress.success ? ocreProgress.data : undefined);
    const profile = profileResult.success && profileResult.data ? profileResult.data : null;
    const activeGroups = groupsResult.success ? groupsResult.groups : [];
    const upcomingEvents = calendarResult.success ? calendarResult.events : [];
    const polls = pollsResult.success && pollsResult.data ? (pollsResult.data as any[]) : [];
    const hasRaidNow = !!activeRaid;

    // Module Disponibilités — rappel hebdomadaire doux.
    // JAMAIS si : onboarding en cours, module inactif, pas de permission, semaine déjà remplie ou déjà dismissée cette semaine sur n'importe quel appareil.
    const now = new Date();
    const currentWeekKey = `${getYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
    const profileAvail = (profile as any)?.availability as Record<string, any> | undefined;
    const isDismissedThisWeek = profileAvail?.dismissedWeek === currentWeekKey;

    const showAvailabilityReminder =
        user.isOnboardingComplete &&
        availabilityModuleEnabled &&
        !!user.canViewAvailability &&
        !!profile &&
        !isDismissedThisWeek &&
        !hasFilledAvailability(profileAvail);

    // Quick Stats Data
    const guildStats = guildStatsResult.success && guildStatsResult.stats ? guildStatsResult.stats : null;
    const dofusCompletionRate = guildStats?.quests?.guildCompletionRate || 0;
    const onlineCount = onlineUsersResult.success ? (onlineUsersResult.totalActive || 0) : 0;
    const onlineUsers = onlineUsersResult.success ? onlineUsersResult.data : [];
    const totalMembers = guildStats?.activeMembers || 0;
    const topActivityName = guildStats?.records?.[0]?.label || "";
    const topActivityValue = guildStats?.records?.[0]?.value || "";

    // Comparaison temporelle (point 4 — KPI "parlant") : réutilise des données
    // DÉJÀ calculées par getGuildStats (0 requête supplémentaire → pas d'impact sur le pool).
    // - Membres : croissance nette du dernier mois (joins − leaves) via retention.growth.
    const growth = guildStats?.retention?.growth || [];
    const lastGrowth = growth[growth.length - 1];
    const membersDelta = lastGrowth ? lastGrowth.joins - lastGrowth.leaves : null;
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
    const todoItems: { href: string; label: string; action: string; image?: string | null; imageQty?: number }[] = [];
    const activePolls = (polls as any[]).filter((p: any) => p?.status === "ACTIVE");
    if (activePolls.length > 0) todoItems.push({ href: `/dashboard/${guildId}/sondages`, label: `${activePolls.length} sondage${activePolls.length > 1 ? "s" : ""} en cours`, action: "Voter" });
    if (nextEvent?.title) todoItems.push({ href: `/dashboard/${guildId}/calendar`, label: `Prochain : ${nextEvent.title}`, action: "Voir" });
    const todayAlmanax = almanaxItems?.[0];
    if (todayAlmanax) todoItems.push({
        href: `/dashboard/${guildId}/ressources?tab=almanax`,
        label: todayAlmanax.tribute.item.name,
        action: "Offrande",
        image: todayAlmanax.tribute.item.image_urls.icon,
        imageQty: todayAlmanax.tribute.quantity,
    });



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
                        <p className="text-body-sm text-muted-foreground mt-1">{contextLine}</p>
                    </div>
                    <DashboardAdminTourButton isAdmin={user.isAdmin} />
                </header>

                {/* ── 1. QUICK STATS ROW ───────────────────────────────── */}
                <section data-tour="dash-stats" className="animate-in fade-in slide-in-from-top-1 duration-150">
                    <QuickStatsRow
                        onlineCount={onlineCount}
                        totalMembers={totalMembers}
                        dofusCompletionRate={dofusCompletionRate}
                        topActivityName={topActivityName}
                        topActivityValue={topActivityValue}
                        onlineUsers={onlineUsers}
                        membersDelta={membersDelta}
                        hideDofusProgress={isVitrineActive}
                    />
                </section>

                {/* ── 1.5 À FAIRE MAINTENANT (compact, direction §9.3) ──── */}
                {todoItems.length > 0 && (
                    <section data-tour="dash-todo" className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">À faire maintenant</span>
                                <span className="flex-1 h-px bg-surface" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                {todoItems.map((item) => (
                                    <Link
                                        key={item.href + item.label}
                                        href={item.href}
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                                    >
                                        {item.image ? (
                                            <div className="relative h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                                                <NextImage
                                                    src={item.image}
                                                    alt={item.label}
                                                    fill
                                                    className="object-contain p-1"
                                                    unoptimized
                                                />
                                                {item.imageQty != null && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 bg-warning text-warning-foreground text-[10px] font-bold px-1 rounded-sm leading-tight">
                                                        x{item.imageQty}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                                        )}
                                        <span className="text-body-sm truncate">{item.label}</span>
                                        <span className="ml-auto text-label font-medium text-success/80 shrink-0">{item.action}</span>
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

                {/* ── 4. AGENDA DE GUILDE (pleine largeur) ─────────────── */}
                {user.canViewCalendar && (
                    <section data-tour="dash-events" className="min-h-[340px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <UpcomingEventsWidget
                            guildId={guildId}
                            events={upcomingEvents as any}
                        />
                    </section>
                )}

                {/* ── 5. GROUPES ACTIFS (pleine largeur) ─────────────────── */}
                <section data-tour="dash-groups" className="min-h-[360px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <RecentDjPosts guildId={guildId} groups={activeGroups} />
                </section>

                {/* ── 6. FLUX DE VIE DE LA GUILDE (pleine largeur) ─────── */}
                <section data-tour="dash-activity" className="animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <GuildActivityFeed logs={guildLogs} guildId={guildId} canViewLogs={user.canViewAuditLogs} />
                </section>

            </div>

            {/* #Module Disponibilités — popup hebdo (1x/semaine si non rempli) */}
            <AvailabilityReminderPopup guildId={guildId} enabled={showAvailabilityReminder} />
        </div>
    );
}
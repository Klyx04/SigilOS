import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivityLadder } from "@/server/actions/ladder-actions";
import { getActivePresence } from "@/server/actions/presence-actions";
import { getDashboardFocus } from "@/server/actions/intelligence-actions";
import { getMyOcreProgress } from "@/server/actions/ocre-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { getAlmanaxData } from "@/server/actions/external/almanax-actions";
import { getUpcomingAlmanax } from "@/server/actions/resources-actions";
import { EchoDuSigil } from "./_components/echo-du-sigil";
import { DashboardNews } from "./_components/dashboard-news";
import { PresenceFacepile } from "./_components/presence-facepile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowRight,
    Users,
    ScrollText,
    Bug,
    InfinityIcon,
    Sparkles,
    Target,
    BookOpen,
    CircleDashed,
    Flame
} from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/layout/access-denied";
import { LadderPreview } from "./_components/ladder-preview";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { StatProgress } from "./_components/stat-progress";
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

    // CAPACITY CHECK: If guild is full and user is just joining
    if (user.isCapacityFull) {
        return (
            <AccessDenied
                title="Guilde Pleine"
                message="Désolé, cette guilde a atteint sa capacité maximale sur SigilOS (350 membres). Contactez le support pour augmenter la limite."
                variant="lock"
                action={<SignOutButton />}
            />
        );
    }

    // All data fetches run concurrently — none depend on each other’s results
    const [presenceData, ladderResult, profileResult, ocreProgress, guildStatsResult, almanaxItems] = await Promise.all([
        getActivePresence(guildId),
        getActivityLadder(guildId, "monthly"),
        getUserProfile(guildId),
        user.canViewArchis 
            ? getMyOcreProgress(guildId) 
            : Promise.resolve({ success: false, data: undefined }),
        getGuildStats(guildId),
        getUpcomingAlmanax().catch(() => null)
    ]);

    // Focus data depends on Ocre result to avoid refetching
    const focusData = await getDashboardFocus(guildId, user, ocreProgress.success ? ocreProgress.data : undefined);

    const topLadder = ladderResult.success && ladderResult.data ? ladderResult.data : [];
    const guildStats = guildStatsResult.success && guildStatsResult.stats ? guildStatsResult.stats : null;
    const profile = profileResult.success && profileResult.data ? profileResult.data : null;

    return (
        <div className="relative w-full min-h-full pb-20">
            {/* Ambient Background Layer */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.03),transparent_70%)]" />
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-[0.03] saturate-100 blur-3xl scale-125" />

            {/* Onboarding Welcome Modal (Admins only) */}
            {user.isAdmin && profile && !profile.hasSeenWelcome && (
                <WelcomeModal guildId={guildId} show={true} />
            )}

            {/* Onboarding Welcome Modal (Members — non-admin) */}
            {!user.isAdmin && profile && !profile.hasSeenWelcome && (
                <MemberWelcomeModal
                    guildId={guildId}
                    guildName={user.guildName || "ta guilde"}
                    userName={profile.pseudoDofus || user.name || "Aventurier"}
                    show={true}
                />
            )}

            <div className="relative z-10 p-4 md:p-6 space-y-10 max-w-[1600px] mx-auto">

                {/* --- HEADER LAYER : IDENTITY & PRESENCE --- */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="space-y-1">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-sm">
                            Dashboard
                        </h1>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-3 group">
                        {/* Presence removed here to avoid redundancy with the TopNav */}
                    </div>
                </header>

                {/* --- ONBOARDING LAYER (Admin & Member) --- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                    {user.isAdmin && (() => {
                        const adminSteps = [
                            { id: "discord", title: "Bot", description: "Serveur Discord lié", href: `/dashboard/${guildId}/admin/settings`, completed: !!guildStats, icon: "shield" },
                            { id: "missions", title: "Missions", description: "Système de quêtes", href: `/dashboard/${guildId}/missions/manage`, completed: (guildStats?.totalMissionsValidated ?? 0) > 0, icon: "scroll-text" },
                            { id: "wiki", title: "Documentation", description: "Base de connaissances", href: `/docs`, completed: (guildStats?.totalXp ?? 0) > 100, icon: "book-open" }
                        ];
                        const allDone = adminSteps.every(s => s.completed);
                        
                        return (
                            <div className="md:col-span-12">
                                <OnboardingBanner
                                    guildId={guildId}
                                    guideHref={`/dashboard/${guildId}/admin/getting-started`}
                                    steps={adminSteps}
                                    dismissible={true} // Always allow hiding if the user wishes
                                    storageKey={`admin-setup-${guildId}`}
                                />
                            </div>
                        );
                    })()}

                    {/* Member Profile Completion (For EVERYONE if incomplete) */}
                    {(() => {
                        if (!user.canViewProfile || !profile) return null;

                        const memberSteps = [
                            { id: "profile", title: "Identité", description: "Pseudo Dofus & Classe", href: `/dashboard/${guildId}/profile?edit=identity`, completed: !!profile.pseudoDofus && !!profile.classe, icon: "users" },
                            user.canViewArchis && { id: "metamob", title: "Metamob", description: "Lier mon compte Metamob", href: `/dashboard/${guildId}/profile`, completed: !!profile.metamobVerified, icon: "infinity" },
                            { id: "jobs", title: "Métiers", description: "Renseigner mes métiers", href: `/dashboard/${guildId}/profile`, completed: (profile.metiers as string[] || []).length > 0, icon: "scroll-text" },
                            { id: "docs", title: "Guide", description: "Comprendre SigilOS", href: `/docs`, completed: (profile.xp ?? 0) > 0, icon: "book-open" }
                        ].filter(Boolean) as any[];

                        const allDone = memberSteps.every(s => s.completed);

                        return (
                            <div className="md:col-span-12">
                                <OnboardingBanner
                                    guildId={guildId}
                                    variant="user"
                                    title={`Bienvenue sur SigilOS, ${profile.pseudoDofus || user.name || "Aventurier"} !`}
                                    subtitle="Préparation Personnelle"
                                    checklistLabel="Ma progression"
                                    steps={memberSteps}
                                    dismissible={true} // Always allow hiding
                                    storageKey={`member-setup-${user.id}`}
                                />
                            </div>
                        );
                    })()}
                </div>

                {/* --- 1. THE NEWS FEED (Almanax & Community News) --- */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                    <DashboardNews 
                        guildId={guildId} 
                        initialAlmanax={almanaxItems?.[0] ?? null}
                    />
                </section>

                {/* --- 1. THE ECHO (Intelligence Focus) --- */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <EchoDuSigil data={focusData} />
                </section>

                {/* --- 2. BENTO GRID 2.0 --- */}
                <main className="grid grid-cols-1 md:grid-cols-12 auto-rows-[180px] gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">

                    {/* Missions (Main landscape - Priority 1) */}
                    {user.canViewMissions && (
                        <div className="md:col-span-12 lg:col-span-8 row-span-1">
                            <Link href={`/dashboard/${guildId}/missions`} className="block h-full">
                                <Card className="glass-premium h-full hover:border-emerald-500/50 transition-all cursor-pointer group relative overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-zinc-200 group-hover:text-emerald-400 transition-colors flex items-center gap-2 text-base font-black uppercase tracking-wider">
                                                <ScrollText className="w-4 h-4" />
                                                Missions
                                                <GuidePulse
                                                    description="C'est ici que vous validez vos défis hebdomadaires pour faire progresser la guilde."
                                                    className="ml-1"
                                                    side="right"
                                                />
                                            </CardTitle>
                                            <Badge variant="outline" className="border-emerald-500/20 text-emerald-400/60 text-[8px] font-black">ACTIF</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-zinc-500 font-bold text-[11px] mb-4">Objectifs et défis hebdomadaires.</p>
                                        <div className="flex items-center text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">
                                            Voir les missions <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </CardContent>
                                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Flame className="w-16 h-16 text-emerald-500" />
                                    </div>
                                </Card>
                            </Link>
                        </div>
                    )}

                    {/* Guild Stats (Vertical Focus - Side Column) */}
                    {user.canViewStats && (
                        <div className="md:col-span-12 lg:col-span-4 lg:row-span-2">
                            <Card className="glass-premium h-full saturate-boost relative overflow-hidden border-white/10">
                                <BorderBeam size={150} duration={8} delay={2} colorFrom="#10b981" colorTo="#34d399" />
                                <CardHeader className="pb-8 pt-6">
                                    <CardTitle className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] flex items-center gap-2">
                                        <Target className="h-4 w-4" />
                                        Activité Hebdomadaire
                                        <GuidePulse
                                            description="Suivez la progression collective de la guilde et votre contribution personnelle en XP."
                                            side="top"
                                        />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    {guildStats ? (
                                        <>
                                            <div className="group/stat">
                                                <p className="text-[9px] text-zinc-600 font-black uppercase mb-1 tracking-widest group-hover/stat:text-emerald-400 transition-colors">Progression Hebdo</p>
                                                <div className="flex items-end gap-2">
                                                    <span className="text-4xl font-black text-white leading-none tracking-tighter">{guildStats.totalMissionsValidated}</span>
                                                    <span className="text-[10px] text-zinc-500 font-bold mb-1 uppercase">Missions</span>
                                                </div>
                                            </div>
                                            <div className="group/stat">
                                                <p className="text-[9px] text-zinc-600 font-black uppercase mb-1 tracking-widest group-hover/stat:text-emerald-400 transition-colors">Points de Gloire</p>
                                                <div className="flex items-end gap-2">
                                                    <span className="text-4xl font-black text-yellow-400 leading-none tracking-tighter">+{guildStats.totalXp}</span>
                                                    <span className="text-[10px] text-zinc-500 font-bold mb-1 uppercase">XP</span>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-white/5">
                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-black uppercase">
                                                    <span>Songes actifs</span>
                                                    <span className="text-emerald-400 font-black">{guildStats.totalSongesCompleted} Complétés</span>
                                                </div>
                                                <StatProgress value={65} color="bg-emerald-500" glowColor="rgba(16,185,129,0.5)" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-zinc-600 italic text-sm py-10">
                                            <CircleDashed className="animate-spin w-4 h-4" /> Collecte des échos...
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Songes (Main landscape - Priority 2) */}
                    {user.canViewSonges && (
                        <div className="md:col-span-6 lg:col-span-8 row-span-1">
                            <Link href={`/dashboard/${guildId}/songes`} className="block h-full">
                                <Card className="glass-premium h-full hover:border-emerald-500/50 transition-all cursor-pointer group relative overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-zinc-200 group-hover:text-emerald-400 transition-colors flex items-center gap-2 text-base font-black uppercase tracking-wider">
                                            <InfinityIcon className="w-5 h-5" />
                                            Songes
                                            <GuidePulse
                                                description="Gérez vos runs de songes infinis et trouvez des partenaires de combat."
                                                side="right"
                                            />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-zinc-500 font-bold text-[11px] mb-4">Gestion des étages et recrutement.</p>
                                        <div className="flex items-center text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">
                                            Voir les runs <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </CardContent>
                                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                        <InfinityIcon className="w-24 h-24 text-emerald-500" />
                                    </div>
                                </Card>
                            </Link>
                        </div>
                    )}

                    {/* Ladder Preview (Horizontal row) */}
                    {user.canViewLadder && (
                        <div className="md:col-span-6 lg:col-span-8 row-span-1">
                            <LadderPreview guildId={guildId} topLadder={topLadder} />
                        </div>
                    )}

                    {/* Tertiary Quick Modules */}
                    <div className="md:col-span-12 lg:col-span-4 row-span-1 grid grid-cols-2 gap-4">
                        {user.canViewArchis && (
                            <Link href={`/dashboard/${guildId}/archimonstres`} className="h-full">
                                <Card className="glass-premium h-full hover:border-amber-500/50 transition-all group overflow-hidden relative">
                                    <CardHeader className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <Bug className="w-5 h-5 text-amber-500" />
                                            {ocreProgress.success && ocreProgress.data && (
                                                <span className="text-[10px] font-black text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                    {ocreProgress.data.stats.progressPercent}%
                                                </span>
                                            )}
                                        </div>
                                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                                            Quête Ocre
                                            <GuidePulse
                                                description="Gardez un œil sur votre progression de la quête Ocre via Metamob."
                                                side="top"
                                            />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 pt-0">
                                        <p className="text-[10px] text-zinc-500 font-bold leading-tight">
                                            {ocreProgress.success && ocreProgress.data
                                                ? `${ocreProgress.data.stats.manquants} manquants pour l'étape.`
                                                : "Liez Metamob pour suivre."}
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}
                        {user.canViewProfile && (
                            <Link href={`/dashboard/${guildId}/profile`} className="h-full">
                                <Card className="glass-premium h-full hover:border-blue-500/50 transition-all group overflow-hidden relative">
                                    <CardHeader className="p-4">
                                        <Sparkles className="w-5 h-5 text-blue-500 mb-2" />
                                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-300">Profil</CardTitle>
                                    </CardHeader>
                                    <div className="absolute -bottom-2 -right-2 opacity-5">
                                        <Sparkles className="w-12 h-12 text-blue-500" />
                                    </div>
                                </Card>
                            </Link>
                        )}
                        {user.canViewRoster && (
                            <Link href={`/dashboard/${guildId}/members`} className="h-full">
                                <Card className="glass-premium h-full hover:border-pink-500/50 transition-all group overflow-hidden relative">
                                    <CardHeader className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <Users className="w-5 h-5 text-pink-500" />
                                            {guildStats && (
                                                <span className="text-[10px] font-black text-pink-500/80 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                                                    {guildStats.activeMembers}
                                                </span>
                                            )}
                                        </div>
                                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-300">Annuaire</CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 pt-0">
                                        <p className="text-[10px] text-zinc-500 font-bold leading-tight">Membres & Métiers.</p>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}
                    </div>

                </main>
            </div>
        </div>
    );
}

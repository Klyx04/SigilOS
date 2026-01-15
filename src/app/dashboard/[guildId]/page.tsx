import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
import { getActivityLadder } from "@/server/actions/ladder-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowRight,
    Shield,
    Users,
    ScrollText,
    Trophy,
    Bug,
    InfinityIcon,
    Sparkles,
    Target
} from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { LadderPreview } from "./_components/ladder-preview";

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

    // Parallel data fetching for performance
    const [guildStatsResult, ladderResult] = await Promise.all([
        getGuildStats(guildId),
        getActivityLadder(guildId, "monthly")
    ]);

    const guildStats = guildStatsResult.success && guildStatsResult.data ? guildStatsResult.data : null;
    const topLadder = ladderResult.success && ladderResult.data ? ladderResult.data : [];

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <div className="relative w-full overflow-hidden rounded-md">
            {/* Aurora Background */}
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-40" />

            <div className="relative z-10 p-2">

                {/* Main Grid Layout: 2/3 Left, 1/3 Right */}
                <div className="grid md:grid-cols-3 gap-6">

                    {/* LEFT COLUMN (Content & Modules) */}
                    <div className="md:col-span-2 flex flex-col gap-6">

                        {/* Compact Welcome Banner */}
                        <Card className="bg-card/40 border-border backdrop-blur-md shadow-lg relative overflow-hidden group">
                            <BorderBeam size={200} duration={15} delay={9} colorFrom="var(--primary)" colorTo="var(--purple-500)" />
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            <CardContent className="p-6 flex items-center justify-center relative z-10">
                                <div className="text-center">
                                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60 mb-1 ">
                                        Bienvenue <span style={{ color: roleColorHex }}>{user.name}</span>
                                    </h1>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Module Grid - Main Action Area */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Missions Module */}
                            {user.canViewMissions && (
                                <Link href={`/dashboard/${guildId}/missions`}>
                                    <Card className="bg-card/20 border-border hover:border-blue-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="group-hover:text-blue-400 transition-colors flex items-center gap-2 text-base">
                                                <ScrollText className="w-5 h-5" />
                                                Missions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                Quêtes hebdomadaires de guilde
                                            </p>
                                            <div className="mt-4 flex items-center text-xs text-blue-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                                Voir les objectifs <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )}

                            {/* Songes Module */}
                            {user.canViewSonges && (
                                <Link href={`/dashboard/${guildId}/songes`}>
                                    <Card className="bg-card/20 border-border hover:border-purple-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="group-hover:text-purple-400 transition-colors flex items-center gap-2 text-base">
                                                <InfinityIcon className="w-5 h-5" />
                                                Songes Infinis
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                Runs de groupe et recrutement
                                            </p>
                                            <div className="mt-4 flex items-center text-xs text-purple-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                                Trouver un groupe <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )}

                            {/* Archis Module */}
                            {user.canViewArchis && (
                                <Link href={`/dashboard/${guildId}/archimonstres`}>
                                    <Card className="bg-card/20 border-border hover:border-amber-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="group-hover:text-amber-400 transition-colors flex items-center gap-2 text-base">
                                                <Bug className="w-5 h-5" />
                                                Bourse Archis
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                Échanges d'archimonstres
                                            </p>
                                            <div className="mt-4 flex items-center text-xs text-amber-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                                Consulter la bourse <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )}

                            {/* Ladder Module */}
                            {user.canViewLadder && (
                                <Link href={`/dashboard/${guildId}/ladder`}>
                                    <Card className="bg-card/20 border-border hover:border-cyan-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="group-hover:text-cyan-400 transition-colors flex items-center gap-2 text-base">
                                                <Trophy className="w-5 h-5" />
                                                Ladder
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                Classements de la guilde
                                            </p>
                                            <div className="mt-4 flex items-center text-xs text-cyan-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                                Voir le top classement <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )}

                            {/* Annuaire (If visible) */}
                            {user.canViewRoster && (
                                <Link href={`/dashboard/${guildId}/members`}>
                                    <Card className="bg-card/20 border-border hover:border-pink-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="group-hover:text-pink-400 transition-colors flex items-center gap-2 text-base">
                                                <Users className="w-5 h-5" />
                                                Annuaire
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                Liste des membres
                                            </p>
                                            <div className="mt-4 flex items-center text-xs text-pink-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                                Parcourir l'annuaire <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )}

                            {/* Profile Card (Always visible) */}
                            <Link href={`/dashboard/${guildId}/profile`}>
                                <Card className="bg-card/20 border-border hover:border-primary/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2 text-base">
                                            <Sparkles className="w-5 h-5" />
                                            Mon Profil
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Fiche personnage & stats
                                        </p>
                                        <div className="mt-4 flex items-center text-xs text-primary font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                            Gérer mon profil <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    </div>

                    {/* RIGHT COLUMN (Stats & Information) */}
                    <div className="flex flex-col gap-6">
                        {/* Guild Stats Panel */}
                        <Card className="bg-card/40 border-border backdrop-blur-md relative overflow-hidden flex-shrink-0">
                            <BorderBeam size={150} duration={10} delay={3} colorFrom="#10b981" colorTo="#34d399" />
                            <CardHeader className="pb-3 pt-4">
                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                    Stats Guilde Semaine
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pb-5">
                                {guildStats ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-sm font-medium">Missions validées</span>
                                            <span className="text-xl font-bold text-emerald-400 bg-emerald-500/10 px-2 rounded">{guildStats.missionsValidatedThisWeek}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-sm font-medium">Points d'activités</span>
                                            <span className="font-bold text-yellow-400 bg-yellow-500/10 px-2 rounded">+{guildStats.activityPointsThisWeek} XP</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-sm font-medium">Runs Songes actifs</span>
                                            <span className="font-bold text-purple-400 bg-purple-500/10 px-2 rounded">{guildStats.activeSongesRuns}</span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Chargement...</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Ladder Preview - Fills remaining height if needed */}
                        <div className="w-full">
                            <LadderPreview guildId={guildId} topLadder={topLadder} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

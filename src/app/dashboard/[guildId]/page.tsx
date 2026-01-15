import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildStats } from "@/server/actions/guild-stats-actions";
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

    // Fetch guild stats (replacing personal stats)
    const guildStatsResult = await getGuildStats(guildId);
    const guildStats = guildStatsResult.success && guildStatsResult.data ? guildStatsResult.data : null;

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <div className="relative h-full w-full overflow-hidden rounded-md">
            {/* Aurora Background */}
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-40" />

            <div className="relative z-10 p-2 h-full flex flex-col gap-6">

                {/* Welcome Hero Section */}
                <section className="grid md:grid-cols-3 gap-6">
                    {/* Main Welcome Card */}
                    <Card className="md:col-span-2 bg-card/40 border-border backdrop-blur-md shadow-2xl relative overflow-hidden group">
                        <BorderBeam size={250} duration={12} delay={9} colorFrom="var(--primary)" colorTo="var(--purple-500)" />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <CardHeader className="pb-3">
                            <CardTitle className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
                                Bienvenue, <span style={{ color: roleColorHex }}>{user.name}</span>
                            </CardTitle>
                            <CardDescription className="text-base">
                                Le système SigilOS est opérationnel. Vos accréditations de niveau{" "}
                                <Badge variant="outline" style={{ borderColor: roleColorHex, color: roleColorHex }}>
                                    {user.roleName}
                                </Badge>
                                {" "}ont été vérifiées.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-3">
                                <Button asChild className="bg-primary/10 hover:bg-primary/20 text-foreground border border-border backdrop-blur">
                                    <Link href={`/dashboard/${guildId}/members`}>
                                        <Users className="mr-2 h-4 w-4" />
                                        Consulter l'Annuaire
                                    </Link>
                                </Button>
                                {user.canViewMissions && (
                                    <Button asChild variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                                        <Link href={`/dashboard/${guildId}/missions`}>
                                            <ScrollText className="mr-2 h-4 w-4" />
                                            Missions
                                        </Link>
                                    </Button>
                                )}
                                {user.isAdmin && (
                                    <Button asChild variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
                                        <Link href={`/dashboard/${guildId}/admin`}>
                                            <Shield className="mr-2 h-4 w-4" />
                                            Administration
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Guild Stats Panel */}
                    <Card className="bg-card/40 border-border backdrop-blur-md relative overflow-hidden">
                        <BorderBeam size={150} duration={10} delay={3} colorFrom="#10b981" colorTo="#34d399" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-400" />
                                Stats Guilde
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {guildStats ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-sm">Missions cette semaine</span>
                                        <span className="text-xl font-bold text-emerald-400">{guildStats.missionsValidatedThisWeek}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-sm">Runs Songes actifs</span>
                                        <span className="font-semibold text-purple-400">{guildStats.activeSongesRuns}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-sm">Membres actifs</span>
                                        <span className="font-semibold text-foreground">{guildStats.activeMembersThisWeek}/{guildStats.totalMembers}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Chargement des stats...</p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* Module Grid */}
                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Accès Rapide aux Modules
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Missions Module */}
                        {user.canViewMissions && (
                            <Link href={`/dashboard/${guildId}/missions`}>
                                <Card className="bg-card/20 border-border hover:border-blue-500/50 transition-all cursor-pointer group h-full">
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
                                        <div className="mt-3 flex items-center text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Accéder <ArrowRight className="ml-1 w-3 h-3" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}

                        {/* Songes Module */}
                        {user.canViewSonges && (
                            <Link href={`/dashboard/${guildId}/songes`}>
                                <Card className="bg-card/20 border-border hover:border-purple-500/50 transition-all cursor-pointer group h-full">
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
                                        <div className="mt-3 flex items-center text-xs text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Accéder <ArrowRight className="ml-1 w-3 h-3" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}

                        {/* Archis Module */}
                        {user.canViewArchis && (
                            <Link href={`/dashboard/${guildId}/archimonstres`}>
                                <Card className="bg-card/20 border-border hover:border-amber-500/50 transition-all cursor-pointer group h-full">
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
                                        <div className="mt-3 flex items-center text-xs text-amber-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Accéder <ArrowRight className="ml-1 w-3 h-3" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}

                        {/* Ladder Module */}
                        {user.canViewLadder && (
                            <Link href={`/dashboard/${guildId}/ladder`}>
                                <Card className="bg-card/20 border-border hover:border-cyan-500/50 transition-all cursor-pointer group h-full">
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
                                        <div className="mt-3 flex items-center text-xs text-cyan-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Accéder <ArrowRight className="ml-1 w-3 h-3" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )}
                    </div>
                </section>

                {/* Secondary Actions Row */}
                <section className="grid md:grid-cols-2 gap-4">
                    {/* Annuaire Card - Only visible if canViewRoster */}
                    {user.canViewRoster && (
                        <Link href={`/dashboard/${guildId}/members`}>
                            <Card className="bg-card/20 border-border hover:border-pink-500/50 transition-all cursor-pointer group">
                                <CardContent className="flex items-center gap-4 py-4">
                                    <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                                        <Users className="h-6 w-6 text-pink-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold group-hover:text-pink-400 transition-colors">Annuaire</h3>
                                        <p className="text-sm text-muted-foreground">Voir tous les membres de la guilde</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-pink-400 transition-colors" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {/* Profile Card */}
                    <Link href={`/dashboard/${guildId}/profile`}>
                        <Card className="bg-card/20 border-border hover:border-primary/50 transition-all cursor-pointer group">
                            <CardContent className="flex items-center gap-4 py-4">
                                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                                    <Sparkles className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold group-hover:text-primary transition-colors">Mon Profil</h3>
                                    <p className="text-sm text-muted-foreground">Gérer votre fiche personnage</p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </CardContent>
                        </Card>
                    </Link>
                </section>
            </div>
        </div>
    );
}

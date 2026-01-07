import { AuroraBackground } from "@/components/ui/aurora-background";
import { BorderBeam } from "@/components/ui/border-beam";
import { getUserContext } from "@/server/actions/user-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, ScrollText } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage({
    params,
}: {
    params: { guildId: string };
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // ... (rest of logic)

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <div className="relative h-full w-full overflow-hidden rounded-md">
            {/* Aurora Background as the base layer for the dashboard content area */}
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-50" />

            <div className="relative z-10 p-2 h-full flex flex-col gap-6">

                {/* Welcome / Hero Section */}
                <section className="grid md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2 bg-card/40 border-border backdrop-blur-md shadow-2xl relative overflow-hidden group">
                        <BorderBeam size={250} duration={12} delay={9} colorFrom="#var(--primary)" colorTo="#var(--indigo-500)" />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <CardHeader>
                            <CardTitle className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
                                Bienvenue, <span style={{ color: roleColorHex }}>{user.name}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg text-muted-foreground max-w-xl">
                                Le système SigilOS est opérationnel. Vos accréditations de niveau <span className="font-semibold text-foreground">{user.roleName}</span> ont été vérifiées.
                            </p>
                            <div className="mt-6 flex gap-3">
                                <Button asChild className="bg-primary/10 hover:bg-primary/20 text-foreground border border-border backdrop-blur">
                                    <Link href={`/dashboard/${guildId}/roster`}>
                                        <Users className="mr-2 h-4 w-4" />
                                        Consulter l'Annuaire
                                    </Link>
                                </Button>
                                {user.isAdmin && (
                                    <Button asChild variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
                                        <Link href={`/dashboard/${guildId}/admin`}>
                                            <Shield className="mr-2 h-4 w-4" />
                                            Accès Prioritaire
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Stats or Status */}
                    <Card className="bg-card/40 border-border backdrop-blur-md flex flex-col justify-center items-center text-center p-6 relative overflow-hidden">
                        <BorderBeam size={150} duration={10} delay={3} colorFrom="#10b981" colorTo="#34d399" />
                        <div className="absolute top-0 right-0 p-3 opacity-20">
                            <ScrollText className="w-24 h-24" />
                        </div>
                        <h3 className="text-muted-foreground font-medium uppercase tracking-wider text-sm mb-2">État du Réseau</h3>
                        <div className="text-3xl font-bold text-emerald-400 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            Connecté
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">V 0.1.0-Alpha</p>
                    </Card>
                </section>

                {/* Bento Grid for Modules */}
                <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                    {/* Placeholder Modules */}
                    <Card className="bg-card/20 border-border hover:border-primary/50 transition-colors cursor-pointer group">
                        <CardHeader>
                            <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                                <ScrollText className="w-5 h-5" />
                                Missions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Accédez au tableau des quêtes et missions de guilde.
                            </p>
                            <div className="mt-4 flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                Ouvrir le module <ArrowRight className="ml-1 w-3 h-3" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/20 border-border hover:border-purple-500/50 transition-colors cursor-pointer group">
                        <CardHeader>
                            <CardTitle className="group-hover:text-purple-400 transition-colors flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Effectifs
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {`Gérez votre fiche personnage et consultez l'annuaire.`}
                            </p>
                            <div className="mt-4 flex items-center text-xs text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                Voir les membres <ArrowRight className="ml-1 w-3 h-3" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Empty Slot / Coming Soon */}
                    <Card className="bg-card/10 border-border border-dashed flex flex-col items-center justify-center text-muted-foreground/50 p-6 min-h-[150px]">
                        <span>Module en développement...</span>
                    </Card>
                </section>
            </div>
        </div>
    );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, Shield, PlusCircle, LayoutDashboard, Crown, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { GuildSetupCard } from "@/components/guild-setup-card";
import { NoGuildMessage } from "@/components/no-guild-message";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";

type GuildData = {
    id: string;
    name: string;
    icon: string | null;
    isAdmin: boolean;
};

import { unstable_cache } from "next/cache";

import { getGuildsSeparated } from "@/server/actions/user-actions";

export default async function GuildSelectorPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const { active, pending, rateLimited, needsReconnect } = await getGuildsSeparated();
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";

    // Smart Redirect: if only one guild, go directly without showing the portal
    if (active.length === 1 && pending.length === 0) {
        redirect(`/dashboard/${active[0].id}`);
    }

    // Check if empty
    const isEmpty = active.length === 0 && pending.length === 0;

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-background font-sans selection:bg-accent-teal/30 landing-theme">
            <PublicHeader 
                user={session.user} 
                dashboardHref="/dashboard" 
                isMember={active.length > 0} 
                clientId={clientId}
            />

            <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 pt-24 pb-24">

                {isEmpty ? (
                    <NoGuildMessage rateLimited={rateLimited} needsReconnect={needsReconnect} />
                ) : (
                    <div className="relative z-10 max-w-5xl w-full space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-300">

                        {/* Hero Section */}
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-caption font-bold uppercase tracking-widest text-success">
                                <LayoutDashboard className="w-3.5 h-3.5 text-success" />
                                <span>Portail Unifié</span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-2 font-heading">
                                Votre <span className="text-success">QG Galactique</span>
                            </h1>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                                Accédez à vos guildes actives ou déployez SigilOS si votre serveur est autorisé.
                            </p>
                        </div>

                        <div className={cn(
                            "grid gap-8",
                            pending.length > 0 ? "lg:grid-cols-12" : "lg:grid-cols-1"
                        )}>

                            {/* ACTIVE GUILDS COLUMN */}
                            <div className={cn(
                                "space-y-6",
                                pending.length > 0 ? "lg:col-span-7" : "lg:col-span-12"
                            )}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                                            <Shield className="w-5 h-5 text-success" />
                                        </div>
                                        Guildes Actives
                                    </h2>
                                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-surface border border-border text-muted-foreground">
                                        {active.length} disponible{active.length > 1 ? 's' : ''}
                                    </span>
                                </div>

                                {active.length > 0 ? (
                                    <div className="grid gap-4">
                                        {active.map((guild) => (
                                            <Link key={guild.id} href={`/dashboard/${guild.id}`} className="group block">
                                                <GlassPanel className="p-0 hover:border-info/50">
                                                    <div className="p-5 flex items-center gap-5">
                                                        <div className="relative">
                                                            <Avatar className="h-14 w-14 rounded-2xl border-2 border-border group-hover:border-info/50 transition-colors">
                                                                <AvatarImage src={guild.icon || ""} alt={guild.name} className="object-cover" />
                                                                <AvatarFallback className="bg-elevated text-muted-foreground font-bold rounded-2xl">
                                                                    {guild.name.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface rounded-full flex items-center justify-center border border-border">
                                                                <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-lg font-bold text-foreground group-hover:text-info transition-colors truncate">
                                                                {guild.name}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                                                                <span className="text-success font-medium text-xs uppercase tracking-wider">Opérationnel</span>
                                                                <span className="w-1 h-1 rounded-full bg-muted"></span>
                                                                <span className={cn("truncate", guild.isAdmin ? "text-info" : guild.hasAccess ? "text-muted-foreground" : "text-warning")}>
                                                                    {guild.accessLabel}
                                                                </span>
                                                            </p>
                                                        </div>

                                                        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-info group-hover:text-info-foreground transition-all duration-300">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </GlassPanel>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <GlassPanel className="p-8 text-center border-dashed border-border">
                                        <p className="text-muted-foreground italic">Aucune guilde active trouvée.</p>
                                    </GlassPanel>
                                )}
                            </div>

                            {/* PENDING GUILDS COLUMN - Only show if there are pending guilds */}
                            {pending.length > 0 && (
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
                                                <PlusCircle className="w-5 h-5 text-warning" />
                                            </div>
                                            Déploiement
                                        </h2>
                                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-surface border border-border text-muted-foreground">
                                            Admin requis
                                        </span>
                                    </div>

                                    <GlassPanel className="min-h-[200px] border-border bg-surface">
                                        <div className="p-4 border-b border-border bg-elevated rounded-t-xl mb-2">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Les serveurs ci-dessous sont éligibles pour l'installation de SigilOS car vous y disposez des droits d'administrateur.
                                            </p>
                                        </div>

                                        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {pending.length > 0 ? (
                                                pending.map((guild) => (
                                                    <GuildSetupCard
                                                        key={guild.id}
                                                        guild={guild}
                                                        clientId={clientId}
                                                        // Un seul serveur éligible + bot déjà présent :
                                                        // on l'active sans exiger un clic « Déployer »
                                                        // (comme les autres bots : invité = fonctionnel).
                                                        autoDeploy={pending.length === 1}
                                                    />
                                                ))
                                            ) : (
                                                <div className="py-12 px-6 text-center">
                                                    <div className="w-12 h-12 rounded-full bg-elevated/50 flex items-center justify-center mx-auto mb-3">
                                                        <Crown className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground">Aucun serveur éligible</p>
                                                    <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                                        Aucun nouveau serveur éligible trouvé. Assurez-vous d'être proprétaire ou administrateur.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </GlassPanel>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <GalacticFooter isMember={active.length > 0} />
        </div>
    );
}

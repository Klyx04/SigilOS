import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, Shield, PlusCircle, LayoutDashboard, Crown, Star, Hourglass } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { GuildSetupCard } from "@/components/guild-setup-card";
import { NoGuildMessage } from "@/components/no-guild-message";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import Image from "next/image";

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
    // Non connecté → page de connexion sobre (bouton Discord + rappel CGU),
    // au lieu d'un retour silencieux vers la landing. Le reste du routing
    // est inchangé : 1 guilde → redirect direct, N → choix, 0 → NoGuildMessage.
    if (!session?.user?.id) {
        return (
            <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-background font-sans landing-theme">
                <PublicHeader user={undefined} dashboardHref="/dashboard" isMember={false} clientId="" />
                <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 pt-24 pb-24">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center space-y-6">
                        <div className="mx-auto w-16 h-16 relative">
                            <Image
                                src="/assets/ui/logo-v2.png"
                                alt="SigilOS"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Bon retour
                            </h1>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Connecte-toi pour accéder à ton tableau de bord.
                            </p>
                        </div>
                        <form action={loginWithDiscord}>
                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center gap-2.5 h-12 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-sm cursor-pointer"
                            >
                                Se connecter avec Discord
                            </button>
                        </form>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            En te connectant, tu acceptes nos{" "}
                            <Link href="/legal/cgu" className="underline underline-offset-2 hover:text-foreground">
                                Conditions d&apos;Utilisation
                            </Link>{" "}
                            et notre{" "}
                            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground">
                                Politique de Confidentialité
                            </Link>
                            .
                        </p>
                    </div>
                </main>
                <GalacticFooter isMember={false} />
            </div>
        );
    }

    const { active, pending, awaiting, rateLimited, needsReconnect } = await getGuildsSeparated();
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";
    const platformCfg = await db.platformConfig.findUnique({
        where: { id: "singleton" },
        select: { autoOnboardingEnabled: true },
    }).catch(() => null);
    const autoOnboardingOn = platformCfg?.autoOnboardingEnabled !== false;

    // Pilotage cross-guilde (« mes serveurs ») : signaux admin par guilde
    // (verrous staff, récupération, gel) — calculés uniquement pour les
    // guildes dont l'utilisateur est admin Discord natif.
    const { getPilotSignals } = await import("@/server/actions/guild-owner-actions");
    const pilotSignals = await getPilotSignals(active.filter((g) => g.isAdmin).map((g) => g.id)).catch(() => ({}));

    // Smart Redirect: if only one guild, go directly without showing the portal
    if (active.length === 1 && pending.length === 0) {
        redirect(`/dashboard/${active[0].id}`);
    }

    // Check if empty
    const isEmpty = active.length === 0 && pending.length === 0 && awaiting.length === 0;

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
                    <NoGuildMessage rateLimited={rateLimited} needsReconnect={needsReconnect} autoOnboardingOn={autoOnboardingOn} />
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
                            (pending.length > 0 || awaiting.length > 0) ? "lg:grid-cols-12" : "lg:grid-cols-1"
                        )}>

                            {/* ACTIVE GUILDS COLUMN */}
                            <div className={cn(
                                "space-y-6",
                                (pending.length > 0 || awaiting.length > 0) ? "lg:col-span-7" : "lg:col-span-12"
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
                                                            {(() => {
                                                                const sig = (pilotSignals as Record<string, { locks: number; hasOpenClaim: boolean; frozen: boolean }>)[guild.id];
                                                                if (!sig || (!sig.locks && !sig.hasOpenClaim && !sig.frozen)) return null;
                                                                return (
                                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                                        {sig.locks > 0 && (
                                                                            <Link href={`/dashboard/${guild.id}/admin/modules`} className="text-caption font-bold px-1.5 py-0.5 rounded-md bg-info/10 border border-info/30 text-info hover:bg-info/20">
                                                                                🔒 {sig.locks} verrou{sig.locks > 1 ? "x" : ""} staff
                                                                            </Link>
                                                                        )}
                                                                        {sig.hasOpenClaim && (
                                                                            <Link href={`/dashboard/${guild.id}`} className="text-caption font-bold px-1.5 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20">
                                                                                🏚️ récupération en cours
                                                                            </Link>
                                                                        )}
                                                                        {sig.frozen && (
                                                                            <span className="text-caption font-bold px-1.5 py-0.5 rounded-md bg-danger/10 border border-danger/30 text-danger">
                                                                                ❄️ gelée — voir file d&apos;attente
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
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

                            {/* RIGHT COLUMN — Déploiement et/ou file d'attente staff */}
                            {(pending.length > 0 || awaiting.length > 0) && (
                                <div className="lg:col-span-5 space-y-8">
                            {/* PENDING GUILDS COLUMN - Only show if there are pending guilds */}
                            {pending.length > 0 && (
                                <div className="space-y-6">
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
                                                Les serveurs ci-dessous sont éligibles pour l&apos;installation de SigilOS car vous y disposez des droits d&apos;administrateur.
                                            </p>
                                        </div>

                                        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {pending.map((guild) => (
                                                <GuildSetupCard
                                                    key={guild.id}
                                                    guild={guild}
                                                    clientId={clientId}
                                                    // Un seul serveur éligible + bot déjà présent :
                                                    // on l'active sans exiger un clic « Déployer »
                                                    // (comme les autres bots : invité = fonctionnel).
                                                    autoDeploy={pending.length === 1}
                                                />
                                            ))}
                                        </div>
                                    </GlassPanel>
                                </div>
                            )}

                            {/* AWAITING COLUMN — serveurs gelés/file God : visibles, jamais fantômes */}
                            {awaiting.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-info/10 border border-info/20">
                                                <Hourglass className="w-5 h-5 text-info" />
                                            </div>
                                            En attente
                                        </h2>
                                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-surface border border-border text-muted-foreground">
                                            Validation staff
                                        </span>
                                    </div>

                                    <GlassPanel className="min-h-[200px] border-border bg-surface">
                                        <div className="p-4 border-b border-border bg-elevated rounded-t-xl mb-2">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Le bot est installé sur ces serveurs. L&apos;équipe SigilOS valide les nouvelles guildes — elles apparaîtront ici dès l&apos;approbation, sans rien réinstaller.
                                            </p>
                                        </div>

                                        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {awaiting.map((guild) => (
                                                <div key={guild.id} className="p-4 rounded-xl border border-dashed border-border bg-black/20 flex items-center gap-4">
                                                    <Avatar className="h-12 w-12 rounded-2xl border border-border grayscale opacity-70">
                                                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                        <AvatarFallback className="bg-muted text-muted-foreground font-bold rounded-2xl">
                                                            {guild.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold truncate text-foreground">{guild.name}</h3>
                                                        <p className="text-xs text-info font-medium">En attente de validation — rien à réinstaller</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </GlassPanel>
                                </div>
                            )}
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

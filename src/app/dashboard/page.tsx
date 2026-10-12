import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, PlusCircle, Hourglass } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { GuildSetupCard } from "@/components/guild-setup-card";
import { NoGuildMessage } from "@/components/no-guild-message";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { getGuildsSeparated } from "@/server/actions/user-actions";

export default async function GuildSelectorPage() {
    const session = await auth();

    // Visiteur non connecté : cette route n'a plus d'écran dédié. L'ancien
    // « Bon retour » faisait doublon avec le bouton Connexion de l'en-tête.
    // Le bouton « Tableau de bord » de l'en-tête déclenche directement
    // l'authentification Discord et revient ici une fois connecté ; un accès
    // direct sans session repart donc vers la landing.
    if (!session?.user?.id) {
        redirect("/");
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
        <div className="registre min-h-screen flex flex-col bg-background text-foreground">
            <PublicHeader 
                user={session.user} 
                dashboardHref="/dashboard" 
                isMember={active.length > 0} 
                clientId={clientId}
            />

            <main className="flex-1">

                {isEmpty ? (
                    <div className="reg-shell py-10 lg:py-14">
                        <NoGuildMessage rateLimited={rateLimited} needsReconnect={needsReconnect} autoOnboardingOn={autoOnboardingOn} />
                    </div>
                ) : (
                    <div className="reg-shell py-10 lg:py-14 space-y-10">

                        {/* En-tête de page — gauche-aligné, sans badge ni titre centré */}
                        <header>
                            <p className="reg-eyebrow">Portail de guilde</p>
                            <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                                Vos guildes
                            </h1>
                            <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                                Accédez à vos guildes actives ou déployez SigilOS si votre serveur est autorisé.
                            </p>
                        </header>

                        <div className={cn(
                            "grid gap-10",
                            (pending.length > 0 || awaiting.length > 0) ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "grid-cols-1"
                        )}>

                            {/* Guildes actives */}
                            <section aria-labelledby="guildes-actives">
                                <div className="flex items-baseline justify-between gap-4">
                                    <h2 id="guildes-actives" className="reg-eyebrow">
                                        Guildes actives
                                    </h2>
                                    <span className="reg-mono text-xs text-muted-foreground">
                                        {active.length} disponible{active.length > 1 ? "s" : ""}
                                    </span>
                                </div>

                                {active.length > 0 ? (
                                    <div className="reg-panel mt-3">
                                        {active.map((guild) => (
                                            <Link
                                                key={guild.id}
                                                href={`/dashboard/${guild.id}`}
                                                className="reg-row grid-cols-[auto_minmax(0,1fr)_auto] px-4 hover:bg-muted"
                                            >
                                                <Avatar className="h-11 w-11 rounded-md border border-border">
                                                    <AvatarImage src={guild.icon || ""} alt={guild.name} className="object-cover" />
                                                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                                                        {guild.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-semibold text-foreground truncate">
                                                        {guild.name}
                                                    </h3>
                                                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
                                                            Opérationnel
                                                        </span>
                                                        <span className={cn("truncate", guild.isAdmin ? "text-foreground" : guild.hasAccess ? "text-muted-foreground" : "text-warning")}>
                                                            {guild.accessLabel}
                                                        </span>
                                                    </p>
                                                    {(() => {
                                                        const sig = (pilotSignals as Record<string, { locks: number; hasOpenClaim: boolean; frozen: boolean }>)[guild.id];
                                                        if (!sig || (!sig.locks && !sig.hasOpenClaim && !sig.frozen)) return null;
                                                        return (
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                {sig.locks > 0 && (
                                                                    <Link href={`/dashboard/${guild.id}/admin/modules`} className="reg-tag text-info">
                                                                        {sig.locks} verrou{sig.locks > 1 ? "x" : ""} staff
                                                                    </Link>
                                                                )}
                                                                {sig.hasOpenClaim && (
                                                                    <Link href={`/dashboard/${guild.id}`} className="reg-tag text-warning">
                                                                        récupération en cours
                                                                    </Link>
                                                                )}
                                                                {sig.frozen && (
                                                                    <span className="reg-tag text-danger">
                                                                        gelée — voir file d&apos;attente
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="reg-panel mt-3 p-6">
                                        <p className="text-sm text-muted-foreground">Aucune guilde active.</p>
                                    </div>
                                )}
                            </section>

                            {/* Colonne droite — déploiement et file d'attente staff */}
                            {(pending.length > 0 || awaiting.length > 0) && (
                                <div className="space-y-10">
                            {/* Déploiement */}
                            {pending.length > 0 && (
                                <section aria-labelledby="deploiement">
                                    <div className="flex items-baseline justify-between gap-4">
                                        <h2 id="deploiement" className="reg-eyebrow flex items-center gap-2">
                                            <PlusCircle className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                                            Déploiement
                                        </h2>
                                        <span className="reg-mono text-xs text-muted-foreground">Admin requis</span>
                                    </div>

                                    <div className="reg-panel mt-3">
                                        <p className="border-b border-border p-4 text-xs text-muted-foreground leading-relaxed">
                                            Les serveurs ci-dessous sont éligibles pour l&apos;installation de SigilOS car vous y disposez des droits d&apos;administrateur.
                                        </p>

                                        <div className="max-h-[400px] space-y-2 overflow-y-auto custom-scrollbar p-2">
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
                                    </div>
                                </section>
                            )}

                            {/* En attente de validation staff */}
                            {awaiting.length > 0 && (
                                <section aria-labelledby="en-attente">
                                    <div className="flex items-baseline justify-between gap-4">
                                        <h2 id="en-attente" className="reg-eyebrow flex items-center gap-2">
                                            <Hourglass className="w-3.5 h-3.5 text-info" aria-hidden="true" />
                                            En attente
                                        </h2>
                                        <span className="reg-mono text-xs text-muted-foreground">Validation staff</span>
                                    </div>

                                    <div className="reg-panel mt-3">
                                        <p className="border-b border-border p-4 text-xs text-muted-foreground leading-relaxed">
                                            Le bot est installé sur ces serveurs. L&apos;équipe SigilOS valide les nouvelles guildes — elles apparaîtront ici dès l&apos;approbation, sans rien réinstaller.
                                        </p>

                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {awaiting.map((guild) => (
                                                <div key={guild.id} className="reg-row grid-cols-[auto_minmax(0,1fr)] px-4">
                                                    <Avatar className="h-10 w-10 rounded-md border border-border opacity-70">
                                                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                                                            {guild.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-semibold text-foreground truncate">{guild.name}</h3>
                                                        <p className="reg-mono mt-1 text-xs text-info">En attente de validation — rien à réinstaller</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
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

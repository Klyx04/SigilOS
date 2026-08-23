import { getPublicGuilds } from "@/server/actions/presentation-actions";
import Link from "next/link";
import Image from "next/image";
import { Gamepad2, Compass, ArrowRight, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";

import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Annuaire des Guildes Dofus 2026 | SigilOS",
    description: "Trouvez votre guilde Dofus idéale. Annuaire complet des guildes avec profils, serveurs, recrutement ouvert et statistiques. Comparez les guildes Dofus Unity 2026.",
    alternates: {
        canonical: `${getAppBaseUrl()}/guilds`,
    },
    openGraph: {
        title: "Annuaire des Guildes Dofus | SigilOS",
        description: "Explorez les guildes d'élite Dofus. Profils détaillés, serveurs, statut de recrutement.",
    },
};

export default async function GuildsDirectoryPage() {
    const guilds = await getPublicGuilds();
    const session = await auth();

    const { getUserContext, getUserGuilds } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    // #59 — guildes dont le visiteur est membre (badge « Votre guilde » + CTA Dashboard).
    const myGuilds = await getUserGuilds();
    const myGuildIds = new Set(myGuilds.map(g => g.id));

    return (
        <div className="relative min-h-screen landing-theme bg-background text-foreground selection:bg-accent-teal/30 font-sans flex flex-col">

            <PublicHeader user={session?.user} backHref="/" backLabel="Retour à l'accueil" isMember={userContext.isMember} />

            {/* Main Content */}
            <main className="flex-1 w-auto relative z-10 pt-32 pb-24 px-6 md:px-8">
                <div className="max-w-7xl mx-auto space-y-16">

                    {/* Hero Section */}
                    <div className="text-center space-y-6 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-medium text-muted-foreground mb-4">
                            <span>Guildes publiques</span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
                            Annuaire des <span className="text-success">guildes Dofus</span>
                        </h1>
                        <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            Trouvez votre prochaine guilde : serveurs, recrutement ouvert et statistiques réelles.
                        </p>
                    </div>

                    {/* Guild Grid */}
                    {guilds.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-surface/30 p-12 text-center">
                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                                <Gamepad2 className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground mb-2">Annuaire Vide</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">
                                Les protocoles de présentation n'ont pas encore été initialisés par les commandants de guilde.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {guilds.map((guild) => (
                                <Link
                                    key={guild.id}
                                    href={myGuildIds.has(guild.discordGuildId) ? `/dashboard/${guild.discordGuildId}` : `/guilds/${guild.discordGuildId}`}
                                    className="group block"
                                >
                                    <article className="h-full rounded-2xl border border-border bg-surface/40 hover:bg-surface/60 hover:border-success/30 transition-all duration-300 overflow-hidden flex flex-col">
                                        {/* Banner Area */}
                                        <div className="h-32 relative bg-background overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-t from-surface/90 to-transparent z-10" />
                                            {guild.bannerUrl ? (
                                                <Image
                                                    src={guild.bannerUrl}
                                                    alt={guild.name}
                                                    fill
                                                    className="object-cover group- transition-transform duration-300 opacity-60"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-elevated" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 pt-0 flex-1 flex flex-col -mt-8 relative z-20">
                                            {/* Icon */}
                                            <div className="w-16 h-16 rounded-xl border-4 border-border bg-elevated shadow-lg mb-4 overflow-hidden relative">
                                                {guild.iconUrl ? (
                                                    <Image
                                                        src={guild.iconUrl}
                                                        alt={guild.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                                                        {guild.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2 mb-6 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-foreground group-hover:text-success transition-colors truncate pr-2">
                                                        {guild.name}
                                                    </h3>
                                                    {myGuildIds.has(guild.discordGuildId) ? (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-success/15 text-success text-caption font-bold uppercase tracking-wide border border-success/30">
                                                            Votre guilde
                                                        </span>
                                                    ) : guild.isRecruiting ? (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-success/10 text-success text-caption font-bold uppercase tracking-wide border border-success/20">
                                                            Recrutement
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {guild.server && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                        <Compass className="w-3.5 h-3.5" />
                                                        <span className="uppercase tracking-wide">{guild.server}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                                    <span>Publique</span>
                                                </div>
                                                {myGuildIds.has(guild.discordGuildId) ? (
                                                    <div className="flex items-center gap-1 font-bold text-success group-hover:translate-x-1 transition-transform">
                                                        Ouvrir le Dashboard
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 font-medium text-foreground group-hover:translate-x-1 transition-transform">
                                                        Voir le profil
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>



            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}

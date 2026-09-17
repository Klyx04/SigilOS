import Link from "next/link";
import type { PublicGuildShowcase } from "@/server/actions/presentation-actions";
import { getGuildSlug } from "@/lib/presentation-constants";
import { GuildEmblem } from "@/components/guild/guild-emblem";

/**
 * Landing — preuve communautaire.
 *
 * Remplace « Elles avancent ensemble » / « Guildes à bord », qui mettaient en
 * scène une pluralité institutionnelle autour d'une seule guilde publique. On
 * assume la réalité : une guilde de terrain, des chiffres vérifiables, deux
 * liens vers des pages qui existent vraiment (profil public, journal).
 *
 * Aucun témoignage n'est fabriqué.
 *
 * L'emblème de la guilde vit désormais dans la ligne de données (« Guilde ») et
 * non dans une colonne de 4fr qui ne portait que lui : d'où le grand vide à
 * gauche. Il passe par `GuildEmblem`, qui affiche les initiales quand l'icône
 * Discord manque — l'ancien rendu laissait un carré noir.
 */

function formatCount(value: number): string {
    return value.toLocaleString("fr-FR");
}

export function LandingProof({ guilds = [] }: { guilds?: PublicGuildShowcase[] }) {
    const ranked = [...guilds].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    const primary = ranked[0] ?? null;
    const totalMembers = ranked.reduce((sum, guild) => sum + (guild.memberCount || 0), 0);

    return (
        <section aria-labelledby="preuve-titre" className="reg-section bg-surface">
            <div className="reg-shell">
                <div>
                    <p className="reg-eyebrow">Pas une fausse preuve sociale</p>
                    <h2
                        id="preuve-titre"
                        className="mt-3 max-w-[28ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                    >
                        Construit avec une vraie guilde.
                    </h2>
                    <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                        SigilOS sert d&apos;abord à l&apos;organisation d&apos;une guilde réelle. Les fonctions sont
                        confrontées aux sorties, aux objectifs et aux besoins des membres avant d&apos;être proposées à
                        d&apos;autres guildes.
                    </p>

                    {primary && (
                        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-3 border-y border-border">
                            <div className="py-4 sm:pr-5 sm:border-r border-border">
                                <dt className="text-xs text-muted-foreground">Guilde</dt>
                                <dd className="mt-1 flex items-center gap-3">
                                    <GuildEmblem src={primary.iconUrl} name={primary.name} size={40} />
                                    <span className="min-w-0 text-base font-bold text-foreground">
                                        {primary.name}
                                        {primary.server ? (
                                            <span className="block reg-mono text-xs font-normal text-muted-foreground">
                                                {primary.server}
                                            </span>
                                        ) : null}
                                    </span>
                                </dd>
                            </div>
                            <div className="py-4 sm:px-5 border-t sm:border-t-0 sm:border-r border-border">
                                <dt className="text-xs text-muted-foreground">Membres actifs</dt>
                                <dd className="reg-metric mt-1 text-base font-bold text-foreground">
                                    {formatCount(primary.memberCount || 0)}
                                </dd>
                            </div>
                            <div className="py-4 sm:pl-5 border-t sm:border-t-0 border-border">
                                <dt className="text-xs text-muted-foreground">
                                    {ranked.length > 1 ? "Guildes publiques" : "Guilde publique"}
                                </dt>
                                <dd className="reg-metric mt-1 text-base font-bold text-foreground">
                                    {formatCount(ranked.length)}
                                    {ranked.length > 1 ? (
                                        <span className="block reg-mono text-xs font-normal text-muted-foreground">
                                            {formatCount(totalMembers)} membres
                                        </span>
                                    ) : null}
                                </dd>
                            </div>
                        </dl>
                    )}

                    {ranked.length > 1 && (
                        <ul className="mt-6 space-y-2">
                            {ranked.slice(1).map((guild) => (
                                <li key={guild.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                                    <Link
                                        href={`/guilds/${getGuildSlug(guild)}`}
                                        className="font-semibold text-foreground hover:text-accent"
                                    >
                                        {guild.name}
                                    </Link>
                                    <span className="reg-mono text-xs text-muted-foreground">
                                        {formatCount(guild.memberCount || 0)} membres
                                        {guild.server ? ` · ${guild.server}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                        <Link
                            href={primary ? `/guilds/${getGuildSlug(primary)}` : "/guilds"}
                            className="reg-link text-sm"
                        >
                            {primary ? `Page publique de ${primary.name}` : "Annuaire des guildes"}
                        </Link>
                        <Link href="/changelog" className="reg-link text-sm">
                            Lire le journal des mises à jour
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { getGuildSlug } from "@/lib/presentation-constants";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { GuildEmblem } from "@/components/guild/guild-emblem";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { auth } from "@/auth";

import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";

/**
 * Annuaire public des guildes — registre (refonte anti-slop).
 *
 * Ce qui a été retiré : l'en-tête centré et son badge pilule, la grille de
 * cartes `rounded-2xl` avec bannière assombrie par un dégradé, la vignette
 * d'icône en `border-4 shadow-lg`, les pastilles en capitales espacées et les
 * flèches animées au survol.
 *
 * Un annuaire est une liste : il se lit maintenant comme un tableau (guilde,
 * serveur, recrutement, profil), et chaque guilde porte son emblème. L'emblème
 * passe par `GuildEmblem`, qui affiche les initiales quand l'icône Discord
 * manque — l'ancien rendu laissait un carré noir sans explication.
 */
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

    const guildCountLabel = guilds.length > 1
        ? `${guilds.length} guildes publiques`
        : guilds.length === 1
            ? "1 guilde publique"
            : "Aucune guilde publique";

    return (
        <div className="registre relative min-h-screen bg-background text-foreground font-sans flex flex-col">

            <PublicHeader
                user={session?.user}
                activePage="annuaire"
                backHref="/"
                backLabel="Retour à l'accueil"
                isMember={userContext.isMember}
            />

            <main className="flex-1">
                <section className="reg-section" aria-labelledby="annuaire-titre">
                    <div className="reg-shell">
                        <h1
                            id="annuaire-titre"
                            className="max-w-[36ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            Annuaire des guildes Dofus
                        </h1>
                        <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            Trouvez votre prochaine guilde : serveurs, recrutement ouvert et statistiques réelles.
                        </p>
                        <p className="reg-mono mt-6 text-xs text-muted-foreground">{guildCountLabel}</p>

                        {guilds.length === 0 ? (
                            <div className="reg-callout mt-8">
                                <h2 className="text-base font-semibold text-foreground">Annuaire vide</h2>
                                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                    Les protocoles de présentation n'ont pas encore été initialisés par les commandants de guilde.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-8 overflow-x-auto">
                                <table className="reg-table">
                                    <caption className="sr-only">
                                        Guildes publiques référencées par SigilOS
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">Guilde</th>
                                            <th scope="col" className="hidden w-[9rem] sm:table-cell">Serveur</th>
                                            <th scope="col" className="hidden w-[9rem] sm:table-cell">Recrutement</th>
                                            <th scope="col" className="w-[12rem] text-right">Profil</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {guilds.map((guild) => {
                                            const isMine = myGuildIds.has(guild.discordGuildId);
                                            const href = isMine
                                                ? `/dashboard/${guild.discordGuildId}`
                                                : `/guilds/${getGuildSlug(guild)}`;

                                            return (
                                                <tr key={guild.id}>
                                                    <th
                                                        scope="row"
                                                        className="border-b border-border py-[0.85rem] pr-4 text-left align-middle text-sm font-semibold normal-case tracking-normal text-foreground"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <GuildEmblem src={guild.iconUrl} name={guild.name} size={36} />
                                                            <Link
                                                                href={href}
                                                                className="min-w-0 truncate text-foreground hover:text-accent"
                                                            >
                                                                {guild.name}
                                                            </Link>
                                                            {isMine && (
                                                                <span className="reg-tag reg-tag-accent shrink-0">Votre guilde</span>
                                                            )}
                                                        </span>
                                                    </th>
                                                    <td className="hidden align-middle text-sm text-muted-foreground sm:table-cell">
                                                        {guild.server ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                {getDofusServerImage(guild.server) && (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={getDofusServerImage(guild.server)!}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                        draggable={false}
                                                                        className="h-5 w-5 rounded object-cover border border-black/30"
                                                                    />
                                                                )}
                                                                {guild.server}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td className="hidden align-middle sm:table-cell">
                                                        <span
                                                            className={
                                                                guild.isRecruiting
                                                                    ? "reg-tag reg-tag-accent"
                                                                    : "reg-tag text-muted-foreground"
                                                            }
                                                        >
                                                            {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                                        </span>
                                                    </td>
                                                    <td className="align-middle text-right">
                                                        <Link href={href} className="reg-link text-sm">
                                                            {isMine ? "Ouvrir le tableau de bord" : "Voir le profil"}
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}

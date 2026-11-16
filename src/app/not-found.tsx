import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { GameIcon } from "@/components/shared/game-icon";
import { DiscordIcon } from "@/components/shared/icons";
import { logNotFound } from "@/server/not-found-log";

export const metadata: Metadata = {
    title: "Page introuvable",
    description: "Cette adresse n'existe pas ou n'existe plus sur SigilOS.",
    // Une 404 reste explorable (on suit ses liens), mais ne doit jamais être indexée.
    robots: { index: false, follow: true },
};

/**
 * 404 publique — rendue pour toute URL sans route (et pour chaque `notFound()` hors
 * dashboard/espace visiteur).
 *
 * Chrome de la landing, donc aucun cul-de-sac : une action principale, une secondaire et
 * quatre raccourcis portés par de **vrais pictos Dofus** (`GameIcon`). L'illustration est
 * un asset du jeu (`hall-creation.webp`, inutilisé jusqu'ici) recadré à gauche pour ne
 * garder que le portail : les libellés dessinés dans l'image n'apparaissent pas. Le chemin
 * demandé n'est jamais réaffiché.
 */
export default async function NotFound() {
    const session = await auth();
    await logNotFound();

    const destinations = [
        { href: "/guides", label: "Guides", detail: "Donjons, quêtes et rushs", icon: "/assets/dofus/modules/guide.png" },
        { href: "/visiteurs", label: "Visiteurs", detail: "Les profils publics", icon: "/assets/dofus/modules/character.png" },
        { href: "/almanax", label: "Almanax", detail: "L'offrande du jour", icon: "/assets/dofus/game-icons/almanax.png" },
        session?.user
            ? { href: "/dashboard", label: "Mon espace", detail: "Ton tableau de bord", icon: "/assets/dofus/modules/guild.png" }
            : { href: "/login", label: "Se connecter", detail: "Avec Discord", icon: "discord" },
    ];

    return (
        <div className="registre landing-theme flex min-h-dvh flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} />

            <main className="reg-shell flex flex-1 flex-col justify-center py-12 sm:py-16">
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
                    <div>
                        <p className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                            <GameIcon src="/assets/dofus/game-icons/zaap.png" className="h-4 w-4" />
                            Erreur 404 — destination inconnue
                        </p>

                        <h1 className="mt-4 max-w-[16ch] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.12] tracking-[-0.01em] text-foreground">
                            Cette page n&apos;existe pas
                        </h1>

                        <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-muted-foreground">
                            Le lien est peut-être ancien ou mal orthographié. Voici les portes encore ouvertes.
                        </p>

                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <Link href="/" className="reg-btn reg-btn-primary">
                                Retour à l&apos;accueil
                            </Link>
                            <Link href="/modules" className="reg-btn reg-btn-secondary">
                                Voir les modules
                            </Link>
                        </div>

                        <ul className="mt-8 grid gap-1 sm:grid-cols-2">
                            {destinations.map((destination) => (
                                <li key={destination.href}>
                                    <Link
                                        href={destination.href}
                                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        {destination.icon === "discord" ? (
                                            <DiscordIcon className="h-5 w-5 shrink-0 text-foreground/80" />
                                        ) : (
                                            <GameIcon src={destination.icon} className="h-6 w-6 shrink-0" />
                                        )}
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-foreground">{destination.label}</span>
                                            <span className="block text-xs text-muted-foreground">{destination.detail}</span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <figure className="relative">
                        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface/40">
                            <Image
                                src="/assets/dofus/vista/hall-creation.webp"
                                alt=""
                                fill
                                priority
                                sizes="(min-width: 1024px) 42vw, 92vw"
                                className="object-cover object-left"
                            />
                        </div>
                        <figcaption className="mt-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                            Le hall ne mène pas à cette porte
                        </figcaption>
                    </figure>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { logNotFound } from "@/server/not-found-log";

export const metadata: Metadata = {
    title: "Page introuvable",
    description: "Cette adresse n'existe pas ou n'existe plus sur SigilOS.",
    // Une 404 reste explorable (on suit ses liens), mais ne doit jamais être indexée.
    robots: { index: false, follow: true },
};

/**
 * 404 publique — rendue pour toute URL sans route (et pour chaque `notFound()` hors
 * dashboard/espace visiteur). Chrome de la landing, donc aucun cul-de-sac : quatre
 * destinations réelles, dont le CTA dépend de la session. Le chemin demandé n'est
 * jamais réaffiché.
 */
export default async function NotFound() {
    const session = await auth();
    await logNotFound();

    const destinations = [
        { href: "/", label: "Accueil", detail: "L'entrée du site" },
        { href: "/guides", label: "Guides", detail: "Donjons, quêtes et rushs" },
        { href: "/visiteurs", label: "Visiteurs", detail: "Les profils publics" },
        session?.user
            ? { href: "/dashboard", label: "Mon espace", detail: "Ton tableau de bord" }
            : { href: "/login", label: "Se connecter", detail: "Avec Discord" },
    ];

    return (
        <div className="registre landing-theme flex min-h-dvh flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} />

            <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Erreur 404</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Cette page n&apos;existe pas
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Le lien est peut-être ancien ou mal orthographié. Voici par où continuer.
                </p>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                    {destinations.map((destination) => (
                        <li key={destination.href}>
                            <Link
                                href={destination.href}
                                className="block rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:border-border-strong hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <span className="block text-sm font-medium text-foreground">{destination.label}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{destination.detail}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </main>

            <GalacticFooter />
        </div>
    );
}

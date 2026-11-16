import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logNotFound } from "@/server/not-found-log";

export const metadata: Metadata = {
    title: "Page introuvable",
    robots: { index: false, follow: false },
};

/**
 * 404 de l'espace visiteur.
 *
 * Mesuré sur un build de prod : une URL non reconnue rend cet écran **sans** le layout
 * `espace-visiteur` (donc sans garde de session ni chrome) ; un `notFound()` lancé par
 * une page le rend dans le chrome. Le bloc reste autonome et son texte ne présume pas
 * d'une session.
 */
export default async function VisitorNotFound() {
    await logNotFound();

    return (
        <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Erreur 404</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Cette page n&apos;existe pas
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Le lien est peut-être ancien. Tu peux revenir à l&apos;accueil ou à ton espace visiteur.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild>
                    <Link href="/espace-visiteur/general">Mon espace visiteur</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/">Accueil du site</Link>
                </Button>
            </div>
        </section>
    );
}

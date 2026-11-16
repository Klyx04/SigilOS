import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { logNotFound } from "@/server/not-found-log";

export const metadata: Metadata = {
    title: "Page introuvable",
    robots: { index: false, follow: false },
};

/**
 * Le seul identifiant accepté est un snowflake Discord **borné** : le chemin brut n'est
 * jamais réaffiché, et toute valeur inattendue retombe sur `/dashboard`. `not-found` ne
 * reçoit pas les `params` du segment — d'où la lecture de `x-pathname` (posé par le proxy).
 */
const GUILD_ID_IN_PATH = /^\/dashboard\/(\d{17,20})(?:\/|$)/;

function readGuildId(pathname: string | null): string | null {
    if (!pathname) return null;
    const match = GUILD_ID_IN_PATH.exec(pathname);
    return match?.[1] ?? null;
}

/**
 * 404 du tableau de bord.
 *
 * Mesuré sur un build de prod : deux rendus possibles — un `notFound()` lancé par une
 * page s'affiche **dans** le chrome du layout `dashboard/[guildId]` ; une URL non
 * reconnue rend cet écran **sans** ce layout (la garde de session ne s'applique pas).
 * Le bloc est donc autonome (marges + largeur) et n'ajoute jamais un second chrome.
 */
export default async function DashboardNotFound() {
    const requestHeaders = await headers();
    const guildId = readGuildId(requestHeaders.get("x-pathname"));
    await logNotFound();

    const homeHref = guildId ? `/dashboard/${guildId}` : "/dashboard";

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-16 sm:px-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Erreur 404</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Cette page n&apos;existe pas dans ce serveur
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Le lien est peut-être ancien, ou la page a été retirée du tableau de bord.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild>
                    <Link href={homeHref}>Retour à l&apos;accueil de la guilde</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/dashboard">Changer de serveur</Link>
                </Button>
            </div>
        </div>
    );
}

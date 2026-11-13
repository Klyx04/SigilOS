import type { ReactNode } from "react";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { requirePublicSession } from "@/server/public-account";
import { VisitorNav } from "./_components/visitor-nav";

export const metadata = {
    title: "Espace visiteur | SigilOS",
    description:
        "Ton profil public de visiteur : identité Dofus, mules, présentation, succès de donjons et métiers.",
};

/**
 * Coque de l'espace visiteur (rang 57, D-V6 + D-V14).
 *
 * **Chrome public, pas chrome de guilde** : l'en-tête et le pied de page de la landing sont
 * rendus tels quels — aucun `guildId`, aucune sidebar, aucun module de guilde. La correction
 * du 06/11/2026 : la V1c n'avait **aucun** chrome, donc un visiteur ne pouvait plus revenir
 * aux guides, au rush ni aux outils autrement qu'en se déconnectant.
 *
 * `dashboardHref` reste dans l'espace : « Tableau de bord » ne doit pas repasser par
 * `/dashboard`, qui redirige ici (D-V13).
 *
 * La garde de session est aussi posée ici (défense en profondeur) ; chaque **page** appelle
 * la sienne, car un `layout` ne protège pas une route imbriquée rendue seule.
 */
export default async function VisitorLayout({ children }: { children: ReactNode }) {
    await requirePublicSession();
    const session = await auth();

    return (
        <div className="registre flex min-h-dvh flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} dashboardHref="/espace-visiteur/general" />

            <div className="border-b border-border bg-surface/40">
                <div className="mx-auto w-full max-w-6xl px-4 pt-5">
                    <p className="text-xs text-muted-foreground">Espace perso</p>
                    <p className="text-lg font-semibold text-foreground">Espace visiteur</p>
                </div>
                <VisitorNav />
            </div>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-16">{children}</main>

            <GalacticFooter />
        </div>
    );
}

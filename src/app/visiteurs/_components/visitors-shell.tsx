import type { ReactNode } from "react";
import type { User } from "next-auth";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";

/**
 * Coque commune aux pages du hub « Communauté SigilOS » (`/visiteurs` et sa fiche).
 *
 * Pourquoi un composant : la coque était recopiée dans `page.tsx` et `[id]/page.tsx`.
 * Une troisième page (les succès en commun) l'aurait recopiée une troisième fois — la
 * première évolution aurait alors divergé. Un seul en-tête, un seul pied, un seul
 * `aria-labelledby`.
 */
export function VisitorsShell({
    user,
    titleId,
    backHref,
    backLabel,
    children,
}: {
    user?: User;
    /** Id du `h1` de la page — le `section` y est rattaché. */
    titleId: string;
    backHref: string;
    backLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="registre relative min-h-screen flex flex-col bg-background text-foreground">
            <PublicHeader
                user={user}
                activePage="visiteurs"
                backHref={backHref}
                backLabel={backLabel}
            />

            <main className="flex-1">
                <section className="reg-section" aria-labelledby={titleId}>
                    <div className="reg-shell">{children}</div>
                </section>
            </main>

            <GalacticFooter />
        </div>
    );
}

/** Titre de page du hub : une seule taille, un seul rythme. */
export function VisitorsTitle({ id, children }: { id: string; children: ReactNode }) {
    return (
        <h1
            id={id}
            className="max-w-[36ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
        >
            {children}
        </h1>
    );
}

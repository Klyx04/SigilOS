import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { DemoNav } from "../_components/demo-nav";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * Coquille de la démo publique (lot S-2a) — **route group `(vitrine)`**.
 *
 * Le group n'apparaît pas dans l'URL (`/demo`, `/demo/annuaire`, `/demo/songes`) : il
 * isole la coquille de `src/app/demo/boss-sim/`, démo **pré-existante** à chrome propre
 * et hors périmètre (elle lit Dofensive et ne doit pas porter le bandeau de démo).
 *
 * `robots: { index: false }` est posé **ici** ⇒ hérité par toutes les pages de la démo
 * (décision D2 du plan : indexation différée tant que le contenu n'est pas unique).
 */
export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();
    const d = t.demoPage;
    return {
        title: d.metaTitle,
        description: d.metaDesc,
        alternates: { canonical: "/demo" },
        robots: { index: false, follow: true },
        openGraph: { title: d.metaTitle, description: d.metaDesc, type: "website", url: "/demo" },
    };
}

export default async function DemoVitrineLayout({ children }: { children: ReactNode }) {
    const { t } = await getServerI18n();
    const d = t.demoPage;

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col">
            <a className="reg-skip" href="#contenu">
                {t.nav.skipToContent}
            </a>

            {/* `isMember={false}` et aucun `user` : aucune session lue, donc aucune requête d'auth. */}
            <PublicHeader variant="hero" isMember={false} />

            {/* Bandeau d'honnêteté — on ne doit jamais pouvoir croire à une vraie guilde. */}
            <div className="border-b border-border bg-surface">
                <div className="reg-shell flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                    <span className="reg-mono text-xs font-semibold uppercase tracking-wider text-warning">
                        {d.bannerLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">{d.bannerDetail}</span>
                </div>
            </div>

            <DemoNav />

            <main id="contenu" className="flex-1 w-full">
                {children}
            </main>

            <GalacticFooter isMember={false} />
        </div>
    );
}

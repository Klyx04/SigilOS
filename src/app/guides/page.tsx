import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { publishedGuides } from "@/content/guides";
import { headers } from "next/headers";
import { JsonLd } from "@/components/shared/json-ld";

/**
 * Index des guides — registre.
 *
 * Ce qui a été retiré volontairement : la carte d'introduction
 * (`rounded-3xl bg-[#101313] shadow-2xl` + orbe `blur-3xl` décoratif), le badge
 * d'encyclopédie en capitales, les vignettes de catégorie à six palettes
 * codées en dur (`bg-cyan-500/10`, `bg-rose-500/10`…), les cartes de guide
 * `rounded-2xl backdrop-blur-md shadow-lg hover:shadow-2xl` avec dégradé au
 * survol. À la place : un en-tête gauche-aligné et une liste de lignes
 * séparées par des filets — le contenu décide du contenant.
 */

export const metadata = {
    title: "Guides Dofus — Raids, Forgemagie, Élevage & Guilde",
    description: "Guides stratégiques et tutoriels complets pour Dofus 3 : Raids de guilde (Gigalodon, Sanctuaire des Jardins Éternels), forgemagie, brisage et gestion de guilde.",
    alternates: {
        canonical: `${getAppBaseUrl()}/guides`,
    },
    openGraph: {
        title: "Guides Stratégiques Dofus — SigilOS",
        description: "Toutes les mécaniques décortiquées : Raids de guilde, rentabilité de brisage, poids des runes et élevage d'enclos.",
        url: `${getAppBaseUrl()}/guides`,
        type: "website",
    },
};

export default async function GuidesPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="registre min-h-screen w-full flex flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    <JsonLd
                        id="json-ld-guides"
                        nonce={nonce}
                        data={{
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            "itemListElement": [
                                { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                                { "@type": "ListItem", "position": 2, "name": "Guides", "item": `${getAppBaseUrl()}/guides` },
                            ],
                        }}
                    />

                    <header>
                        <p className="reg-eyebrow">Guides &amp; tutoriels</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                            Guides Dofus
                        </h1>
                        <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                            Dossiers complets : mécaniques de raids de guilde, optimisation de la forgemagie,
                            brisage rentable, élevage d&apos;enclos et administration de guilde.
                        </p>
                    </header>

                    <div className="mt-8 border-t border-border">

                        {publishedGuides.length === 0 ? (
                            <p className="py-14 text-sm text-muted-foreground">Aucun guide publié pour le moment.</p>
                        ) : (
                            <ul>
                                {publishedGuides.map((guide) => {
                                    const updated = new Date(guide.updatedAt);
                                    return (
                                        <li key={guide.slug}>
                                            <Link
                                                href={`/guides/${guide.slug}`}
                                                className="group flex items-start gap-4 border-b border-border py-5 transition-colors hover:bg-surface"
                                            >
                                                {guide.coverImage && (
                                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-16 sm:w-16">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={guide.coverImage}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                            loading="lazy"
                                                            width={64}
                                                            height={64}
                                                        />
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        {guide.category && (
                                                            <span className="reg-mono text-[0.6875rem] uppercase tracking-wider text-accent">
                                                                {guide.category}
                                                            </span>
                                                        )}
                                                        {guide.readingTime && (
                                                            <span className="reg-mono text-xs text-muted-foreground">
                                                                {guide.readingTime}
                                                            </span>
                                                        )}
                                                        <time
                                                            dateTime={updated.toISOString()}
                                                            className="reg-mono text-xs text-muted-foreground"
                                                        >
                                                            {updated.toLocaleDateString("fr-FR", {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            })}
                                                        </time>
                                                    </p>

                                                    <h2 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-accent sm:text-base">
                                                        {guide.title}
                                                    </h2>

                                                    <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                                        {guide.description}
                                                    </p>
                                                </div>

                                                <ChevronRight
                                                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}

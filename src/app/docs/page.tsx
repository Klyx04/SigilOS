import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getDocMeta, CATEGORY_META } from "@/lib/doc-meta";
import { JsonLd } from "@/components/shared/json-ld";

export const metadata: Metadata = {
    title: "Centre de Documentation — SigilOS",
    description: "Guides complets, tutoriels pas-à-pas et références pour maîtriser SigilOS et piloter votre guilde Dofus.",
    alternates: {
        canonical: `${getAppBaseUrl()}/docs`,
    },
};

export default async function DocsHubPage() {
    const { getAllDocs } = await import("@/server/actions/doc-actions");
    const allDocs = await getAllDocs();

    // Group docs by category
    const groupedDocs: Record<string, typeof allDocs> = {};
    allDocs.forEach(doc => {
        const cat = doc.category || "Autres";
        if (!groupedDocs[cat]) groupedDocs[cat] = [];
        groupedDocs[cat].push(doc);
    });

    const categoryOrder = [
        "Progression & Objectifs",
        "Outils & Services",
        "Communauté & Guilde",
        "Administration & Staff",
        "Spécifications Techniques"
    ];

    const sortedCategories = Object.keys(groupedDocs).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <>
            <JsonLd
                id="json-ld-docs"
                nonce={nonce}
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                        { "@type": "ListItem", "position": 2, "name": "Documentation", "item": `${getAppBaseUrl()}/docs` },
                    ],
                }}
            />
            <div className="space-y-10">
                {/* En-tête de la doc — un titre, un chapeau : pas de hero, pas d'orbe. */}
                <header className="border-b border-border pb-6">
                    <p className="reg-eyebrow">Documentation</p>
                    <h1 className="mt-3 text-2xl font-semibold text-foreground">Centre de documentation</h1>
                    <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                        Guides pratiques, tutoriels pas-à-pas et références de configuration pour piloter votre guilde Dofus avec SigilOS.
                    </p>
                </header>

                {sortedCategories.length === 0 && (
                    <section className="reg-panel p-6">
                        <p className="text-[15px] font-semibold text-foreground">Aucun guide pour le moment</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                            La documentation est en cours de synchronisation.
                        </p>
                    </section>
                )}

                {/* Blocs thématiques */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sortedCategories.map(category => {
                        const catMeta = CATEGORY_META[category] || {
                            icon: BookOpen
                        };
                        const CategoryIcon = catMeta.icon;
                        const docsList = groupedDocs[category];

                        return (
                            <section key={category} className="reg-panel flex flex-col">
                                {/* En-tête de catégorie : libellé + compteur, séparés par un filet */}
                                <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <CategoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <h2 className="truncate text-[14px] font-semibold text-foreground">{category}</h2>
                                    </div>
                                    <span className="reg-mono shrink-0 text-[11px] text-muted-foreground">
                                        {docsList.length} guide{docsList.length > 1 ? "s" : ""}
                                    </span>
                                </div>

                                {/* Liste des guides — une ligne par doc, séparées par un filet */}
                                <ul className="flex-1 divide-y divide-border">
                                    {docsList.map(doc => {
                                        const docMeta = getDocMeta(doc.slug);
                                        const DocIcon = docMeta.icon;

                                        return (
                                            <li key={doc.id}>
                                                <Link
                                                    href={`/docs/${doc.slug}`}
                                                    className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-elevated"
                                                >
                                                    <DocIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                                                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
                                                        {doc.title}
                                                    </span>
                                                    <ArrowRight
                                                        className="h-3.5 w-3.5 shrink-0 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                                        aria-hidden="true"
                                                    />
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

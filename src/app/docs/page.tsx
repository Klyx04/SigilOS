import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { getDocMeta, CATEGORY_META } from "@/lib/doc-meta";

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
            <script
                type="application/ld+json"
                nonce={nonce}
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                            { "@type": "ListItem", "position": 2, "name": "Documentation", "item": `${getAppBaseUrl()}/docs` },
                        ],
                    }).replace(/</g, "\\u003c"),
                }}
            />
            <div className="space-y-12">
                {/* En-tête Hero de la Doc */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950/40 via-surface to-background border border-teal-500/20 p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
                    <div className="relative z-10 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-bold text-teal-400 uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Encyclopédie Officielle</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-foreground font-heading tracking-tight">
                            Centre de Documentation
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
                            Guides pratiques, tutoriels illustrés et références de configuration pour exploiter 100% de la puissance de SigilOS dans votre guilde Dofus.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 blur-[120px] -mr-20 -mt-20 pointer-events-none" />
                </div>

                {sortedCategories.length === 0 && (
                    <div className="relative flex flex-col items-center justify-center text-center p-12 rounded-3xl border bg-surface/40 border-border mt-8 overflow-hidden">
                        <div className="p-6 rounded-2xl bg-background/50 border border-border mb-6">
                            <BookOpen className="w-10 h-10 text-teal-400" />
                        </div>
                        <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight">Aucun guide pour le moment</h3>
                        <p className="text-base text-muted-foreground/80 leading-relaxed font-medium">
                            La documentation est en cours de synchronisation.
                        </p>
                    </div>
                )}

                {/* Grille des blocs thématiques */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {sortedCategories.map(category => {
                        const catMeta = CATEGORY_META[category] || {
                            icon: BookOpen,
                            color: "teal",
                            badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20"
                        };
                        const CategoryIcon = catMeta.icon;
                        const docsList = groupedDocs[category];

                        return (
                            <div
                                key={category}
                                className="bg-surface/60 border border-border rounded-3xl overflow-hidden hover:border-border transition-all duration-300 shadow-xl flex flex-col group/card"
                            >
                                {/* En-tête de la catégorie */}
                                <div className="px-6 py-5 border-b border-border bg-background/[0.03] flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl border ${catMeta.badgeClass}`}>
                                            <CategoryIcon className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-sm font-black text-foreground uppercase tracking-wider">
                                            {category}
                                        </h2>
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground px-2.5 py-1 rounded-full bg-background/40 border border-border">
                                        {docsList.length} guide{docsList.length > 1 ? "s" : ""}
                                    </span>
                                </div>

                                {/* Liste des guides avec icônes dédiées */}
                                <div className="p-4 flex-1">
                                    <ul className="space-y-1.5">
                                        {docsList.map(doc => {
                                            const docMeta = getDocMeta(doc.slug);
                                            const DocIcon = docMeta.icon;

                                            return (
                                                <li key={doc.id}>
                                                    <Link
                                                        href={`/docs/${doc.slug}`}
                                                        className="group flex items-center justify-between p-3 rounded-2xl hover:bg-background/80 hover:border-border border border-transparent transition-all duration-200"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${docMeta.badgeClass}`}>
                                                                <DocIcon className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-xs sm:text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors leading-snug truncate">
                                                                {doc.title}
                                                            </span>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 shrink-0 ml-2" />
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

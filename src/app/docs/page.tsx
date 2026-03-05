import Link from "next/link";
import { Folder, FileText, ArrowRight } from "lucide-react";
import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";

export const metadata: Metadata = {
    title: "Centre de Documentation",
    description: "Guides, tutoriels et documentation technique pour maîtriser SigilOS et optimiser votre guilde.",
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

    const categories = Object.keys(groupedDocs).sort();

    return (
        <>
            <script
                type="application/ld+json"
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                            { "@type": "ListItem", "position": 2, "name": "Documentation", "item": `${getAppBaseUrl()}/docs` },
                        ],
                    }),
                }}
            />
            <div className="space-y-12">
                <div className="relative overflow-hidden rounded-2xl bg-teal-900/10 border border-teal-500/10 p-8 sm:p-12">
                    <div className="relative z-10">
                        <h1 className="text-3xl sm:text-4xl font-black text-white font-heading mb-4">
                            Centre de Documentation
                        </h1>
                        <p className="text-lg text-teal-200/60 max-w-2xl">
                            Bienvenue sur le Wiki de SigilOS. Vous trouverez ici tous les guides, tutoriels et références pour maîtriser l'outil.
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 blur-[100px] -mr-32 -mt-32" />
                </div>

                {categories.length === 0 && (
                    <div className="relative flex flex-col items-center justify-center text-center p-12 rounded-3xl border bg-zinc-900/40 border-teal-500/10 mt-8 overflow-hidden">
                        <div className="p-6 rounded-2xl bg-zinc-950/50 border border-white/10 mb-6">
                            <FileText className="w-10 h-10 text-teal-400" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Aucun guide pour le moment</h3>
                        <p className="text-base text-zinc-400/80 leading-relaxed font-medium">
                            La documentation est en cours de rédaction. Revenez plus tard pour découvrir nos tutoriels.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {categories.map(category => (
                        <div key={category} className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors group/card">
                            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                                <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                        <Folder className="w-4 h-4 text-teal-400" />
                                    </div>
                                    {category}
                                </h2>
                            </div>

                            <div className="p-4 ">
                                <ul className="space-y-2">
                                    {groupedDocs[category].map(doc => (
                                        <li key={doc.id}>
                                            <Link
                                                href={`/docs/${doc.slug}`}
                                                className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                                            >
                                                <span className="text-zinc-400 group-hover:text-zinc-200 flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    {doc.title}
                                                </span>
                                                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

import Link from "next/link";
import { Folder, FileText, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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
        <div className="space-y-12">
            <div className="relative overflow-hidden rounded-2xl bg-indigo-900/20 border border-indigo-500/20 p-8 sm:p-12">
                <div className="relative z-10">
                    <h1 className="text-3xl sm:text-4xl font-black text-white font-heading mb-4">
                        Centre de Documentation
                    </h1>
                    <p className="text-lg text-indigo-200 max-w-2xl">
                        Bienvenue sur le Wiki de SigilOS. Vous trouverez ici tous les guides, tutoriels et références pour maîtriser l'outil.
                    </p>
                </div>
                {/* Decorative background elements can go here */}
            </div>

            {categories.length === 0 && (
                <EmptyState
                    icon={FileText}
                    title="Aucun guide pour le moment"
                    description="La documentation est en cours de rédaction. Revenez plus tard pour découvrir nos tutoriels."
                    variant="glow"
                    className="mt-8 border-indigo-500/10"
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categories.map(category => (
                    <div key={category} className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
                        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Folder className="w-5 h-5 text-indigo-400" />
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
    );
}

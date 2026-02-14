import { PublicHeader } from "@/components/layout/public-header";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Link from "next/link";
import { Home, Book, Terminal, FileText } from "lucide-react";
import { getAllDocs } from "@/server/actions/doc-actions";
import { redirect } from "next/navigation";
import { ResizableSidebar } from "./_components/resizable-sidebar";
import { DocsSearch } from "@/components/doc/docs-search";
import { cn } from "@/lib/utils";

export default async function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // 🔒 Security: Require Auth
    if (!session?.user?.id) {
        redirect("/api/auth/signin?callbackUrl=/docs");
    }

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
        <div className="relative min-h-screen bg-zinc-950 font-sans selection:bg-purple-500/30 flex flex-col">
            <PublicHeader user={session?.user} />

            <div className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-12 flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <ResizableSidebar className="hidden lg:block w-64 shrink-0">
                    <div className="sticky top-24 pr-4">
                        <div className="pb-6 border-b border-white/5 mb-6">
                            <Link href="/docs" className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors mb-4">
                                <Home className="w-4 h-4" />
                                Centre de Documentation
                            </Link>

                            {/* Dedicated Docs Search */}
                            <DocsSearch />
                        </div>

                        <nav className="space-y-8">

                            {/* Static / Important Links */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4 px-2">Essentiels</h4>
                                <ul className="space-y-1">
                                    <li>
                                        <Link href="/docs/intro" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                                            <Book className="w-4 h-4 text-indigo-400" />
                                            Introduction
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/docs/developer-guide" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                                            <Terminal className="w-4 h-4 text-emerald-400" />
                                            Guide Développeur
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Dynamic Categories */}
                            {categories.map(category => (
                                <div key={category}>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4 px-2">{category}</h4>
                                    <ul className="space-y-1">
                                        {groupedDocs[category].map(doc => {
                                            const isSubPage = doc.slug.includes("/");
                                            return (
                                                <li key={doc.id}>
                                                    <Link
                                                        href={`/docs/${doc.slug}`}
                                                        className={cn(
                                                            "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors truncate group",
                                                            isSubPage && "ml-4 border-l border-white/5 rounded-l-none pl-4"
                                                        )}
                                                        title={doc.title}
                                                    >
                                                        <FileText className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                                        {doc.title}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}

                            {categories.length === 0 && (
                                <div className="px-2 py-4 bg-zinc-900/50 rounded border border-white/5 text-xs text-zinc-500 text-center italic">
                                    Aucune page publiée.
                                </div>
                            )}

                        </nav>
                    </div>
                </ResizableSidebar>

                {/* Mobile Fallback (Simple Stack) */}
                <aside className="lg:hidden w-full space-y-8">
                    <div className="pb-6 border-b border-white/5 mb-6">
                        <Link href="/docs" className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                            <Home className="w-4 h-4" />
                            Centre de Documentation
                        </Link>
                    </div>
                    {/* Shortened Nav for Mobile could go here or just full list */}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>

            <GalacticFooter />
        </div>
    );
}

import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { getAdminDocs } from "@/server/actions/doc-actions";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";
import { DocsLibrary } from "./_components/docs-library";

export default async function AdminDocsPage() {
    const session = await auth();
    // P2 — un sous-god avec la brique "docs" accède aussi (sinon super-admin).
    const isAdmin = await isSuperAdmin() || await canAccessBrick("docs");
    if (!isAdmin) redirect("/");

    const docs = await getAdminDocs();

    return (
        <div className="flex-1 flex flex-col font-sans selection:bg-purple-500/30 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <main className="flex-1 w-full mx-auto px-4 md:px-12 pb-24 pt-12 md:pt-24 space-y-12 max-w-[1600px]">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-black text-teal-400 uppercase tracking-widest">
                            <BookOpen className="w-4 h-4" />
                            <span>Bibliothèque documentaire</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                            Documentation <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-teal-400 to-teal-600">Plateforme</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                            Chaque fiche vit en base et s'édite ici — membres comme staff. Recherchez, filtrez par portée, ouvrez, modifiez.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button asChild className="px-8 py-6 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-teal-500/20 group">
                            <Link href="/god/docs/new">
                                <Plus className="w-6 h-6 mr-3 group-hover:rotate-90 transition-transform" />
                                Nouvelle Page
                            </Link>
                        </Button>
                    </div>
                </div>

                <DocsLibrary docs={docs} />
            </main>
        </div>
    );
}

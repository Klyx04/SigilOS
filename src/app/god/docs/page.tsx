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
        <div className="flex-1 flex flex-col font-sans selection:bg-accent/30 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <main className="flex-1 w-full mx-auto px-4 md:px-12 pb-24 pt-12 md:pt-24 space-y-12 max-w-[1600px]">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-12">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success uppercase tracking-wide">
                            <BookOpen className="w-4 h-4" />
                            <span>Bibliothèque documentaire</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-semibold text-foreground font-heading tracking-tighter leading-none">
                            Documentation <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-success via-success to-success">Plateforme</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-medium">
                            Chaque fiche vit en base et s'édite ici — membres comme staff. Recherchez, filtrez par portée, ouvrez, modifiez.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button asChild className="px-8 py-6 rounded-xl bg-success hover:bg-success text-success-foreground font-semibold uppercase tracking-wide transition-all shadow-sm shadow-success/20 group">
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

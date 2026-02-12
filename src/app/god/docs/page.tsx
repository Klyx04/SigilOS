import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { getAdminDocs, deleteDoc } from "@/server/actions/doc-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, FileText, ExternalLink } from "lucide-react";
import { DeleteDocButton } from "./_components/delete-button";

export default async function AdminDocsPage() {
    const session = await auth();
    // In a real app, verify SuperAdmin access here
    // For now, assuming middleware or layout handles it, or user is authorized

    const docs = await getAdminDocs();

    return (
        <div className="flex flex-col font-sans selection:bg-purple-500/30">
            <main className="flex-1 container max-w-5xl mx-auto px-4 pb-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white font-heading">Gestion Documentation</h1>
                        <p className="text-zinc-400">Créez et modifiez les pages de la documentation.</p>
                    </div>
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white">
                        <Link href="/god/docs/new">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle Page
                        </Link>
                    </Button>
                </div>

                <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-zinc-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Titre</th>
                                <th className="px-4 py-3">Slug</th>
                                <th className="px-4 py-3">Catégorie</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {docs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">
                                        Aucune page de documentation. Créez-en une !
                                    </td>
                                </tr>
                            ) : (
                                docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-indigo-400" />
                                            {doc.title}
                                            {!doc.isPublished && (
                                                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                    Brouillon
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                                            {doc.slug}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">
                                            {doc.category}
                                        </td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white" asChild>
                                                <Link href={`/docs/${doc.slug}`} target="_blank" title="Voir">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10" asChild>
                                                <Link href={`/god/docs/${doc.id}`} title="Éditer">
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                            <DeleteDocButton id={doc.id} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

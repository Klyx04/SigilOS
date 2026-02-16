import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { getAdminDocs, deleteDoc } from "@/server/actions/doc-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, FileText, ExternalLink, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteDocButton } from "./_components/delete-button";

export default async function AdminDocsPage() {
    const session = await auth();
    // In a real app, verify SuperAdmin access here
    // For now, assuming middleware or layout handles it, or user is authorized

    const docs = await getAdminDocs();

    return (
        <div className="flex-1 flex flex-col font-sans selection:bg-purple-500/30 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <main className="flex-1 w-full mx-auto px-4 md:px-12 pb-24 pt-12 md:pt-24 space-y-16 max-w-[1600px]">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-black text-indigo-400 uppercase tracking-widest">
                            <Database className="w-4 h-4" />
                            <span>Architecture de Données</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                            Documentation <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-600">Platforme</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                            Structurez la connaissance technique et guidez les utilisateurs vers la maîtrise absolue de SigilOS.
                        </p>
                    </div>
                    <Button asChild className="px-8 py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-indigo-500/20">
                        <Link href="/god/docs/new">
                            <Plus className="w-6 h-6 mr-3" />
                            Nouvelle Page
                        </Link>
                    </Button>
                </div>

                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
                    <table className="w-full text-left text-base">
                        <thead className="bg-white/[0.03] text-zinc-500 font-black uppercase tracking-[0.2em] text-xs">
                            <tr>
                                <th className="px-8 py-6">Entité</th>
                                <th className="px-8 py-6">Identifiant (Slug)</th>
                                <th className="px-8 py-6">Classification</th>
                                <th className="px-8 py-6 text-right">Opérations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {docs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-zinc-600 italic text-xl font-medium">
                                        Aucune archive documentaire détectée dans la base.
                                    </td>
                                </tr>
                            ) : (
                                docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6 font-black text-white">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                                                    <FileText className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-lg group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{doc.title}</span>
                                                    {!doc.isPublished && (
                                                        <span className="text-[10px] bg-amber-500/10 text-amber-500 w-fit px-2 py-0.5 rounded-full border border-amber-500/20 font-black tracking-widest uppercase mt-1">
                                                            Scanning / Brouillon
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 font-mono text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">
                                            /{doc.slug}
                                        </td>
                                        <td className="px-8 py-6">
                                            <Badge variant="outline" className="px-3 py-1 rounded-full border-zinc-700 bg-zinc-800/50 text-zinc-400 font-bold text-[10px] uppercase tracking-widest">
                                                {doc.category}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white border border-transparent hover:border-white/10" asChild>
                                                    <Link href={`/docs/${doc.slug}`} target="_blank" title="Voir le rendu">
                                                        <ExternalLink className="w-5 h-5" />
                                                    </Link>
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-white/5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20" asChild>
                                                    <Link href={`/god/docs/${doc.id}`} title="Modifier la structure">
                                                        <Edit className="w-5 h-5" />
                                                    </Link>
                                                </Button>
                                                <div className="scale-110">
                                                    <DeleteDocButton id={doc.id} />
                                                </div>
                                            </div>
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

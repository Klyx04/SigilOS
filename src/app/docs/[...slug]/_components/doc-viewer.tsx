import { DocContent } from "@/components/doc/doc-content";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { Edit } from "lucide-react";

export function DocViewer({
    content,
    title,
    lastUpdate,
    canEdit,
    editUrl
}: {
    content: string,
    title: string,
    lastUpdate: Date,
    canEdit?: boolean,
    editUrl?: string
}) {
    return (
        <article className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 border-b border-white/5 pb-8">
                <h1 className="text-4xl font-black text-white font-heading tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                    {title}
                </h1>
                <div className="flex items-center justify-between gap-4 text-sm text-zinc-500">
                    <span>Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>

                    {canEdit && editUrl && (
                        <Link
                            href={editUrl}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors font-medium border border-indigo-500/20"
                        >
                            <Edit className="w-3 h-3" />
                            Éditer cette page
                        </Link>
                    )}
                </div>
            </header>

            <DocContent content={content} />
        </article>
    );
}

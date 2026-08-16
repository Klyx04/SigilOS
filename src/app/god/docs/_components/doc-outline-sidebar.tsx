"use client";

import { cn } from "@/lib/utils";
import { ListTree, AlertCircle } from "lucide-react";
import * as React from "react";

interface Heading {
    id: string;
    text: string;
    level: number;
}

interface DocOutlineSidebarProps {
    content: string;
    className?: string;
}

export function DocOutlineSidebar({ content, className }: DocOutlineSidebarProps) {
    const [headings, setHeadings] = React.useState<Heading[]>([]);

    React.useEffect(() => {
        // Extract headings from HTML stream
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const elements = doc.querySelectorAll('h2, h3');

        const extracted = Array.from(elements).map(el => {
            const text = el.textContent || "";
            const id = el.id || text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return {
                id,
                text,
                level: parseInt(el.tagName[1])
            };
        });

        setHeadings(extracted);
    }, [content]);

    if (headings.length === 0) {
        return (
            <div className={cn("p-6 flex flex-col items-center justify-center text-center opacity-30", className)}>
                <ListTree className="w-8 h-8 mb-2" />
                <p className="text-caption font-black uppercase tracking-widest text-zinc-500">Aucun titre détecté (H2/H3)</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ListTree className="w-3 h-3 text-teal-400" />
                    <span className="text-caption font-black text-white/40 uppercase tracking-[0.2em]">Chapitrage Temps Réel</span>
                </div>
                <span className="bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded text-caption font-black">
                    {headings.length}
                </span>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                {headings.map((h, i) => {
                    const isTooLong = h.text.length > 50;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "group relative flex items-start gap-3 p-2 rounded-lg transition-all hover:bg-white/[0.03] border border-transparent",
                                h.level === 3 && "ml-4"
                            )}
                        >
                            <div className={cn(
                                "mt-1.5 w-1 h-3 rounded-full shrink-0 transition-colors",
                                h.level === 2 ? "bg-teal-500/50 group-hover:bg-teal-400" : "bg-zinc-800 group-hover:bg-amber-400"
                            )} />

                            <div className="min-w-0 flex-1">
                                <p className={cn(
                                    "text-xs font-bold truncate transition-colors",
                                    h.level === 2 ? "text-zinc-300 group-hover:text-white" : "text-zinc-500 group-hover:text-zinc-300",
                                    isTooLong && "text-amber-400"
                                )}>
                                    {h.text}
                                </p>
                                {isTooLong && (
                                    <div className="flex items-center gap-1 mt-0.5 text-caption text-amber-500 font-bold uppercase tracking-tighter">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        Titre trop long
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/5 bg-zinc-950/40">
                <p className="text-caption text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                    Utilisez les balises 2.0 et 3.0 dans l'éditeur pour structurer votre documentation.
                </p>
            </div>
        </div>
    );
}

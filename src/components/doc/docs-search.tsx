"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Book } from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { getSearchableDocs } from "@/server/actions/doc-actions";

export function DocsSearch() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();
    const [docs, setDocs] = React.useState<{ title: string; slug: string; category: string; excerpt: string }[]>([]);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    React.useEffect(() => {
        if (open && docs.length === 0) {
            getSearchableDocs().then(setDocs);
        }
    }, [open, docs.length]);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full relative group flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 bg-zinc-900/50 border border-white/5 rounded-lg hover:text-white hover:bg-white/5 hover:border-indigo-500/30 transition-all text-left mb-6 shadow-sm"
            >
                <Search className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                <span className="flex-1 truncate">Rechercher...</span>
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-zinc-950 px-1.5 font-mono text-caption font-medium text-zinc-500">
                    <span className="text-xs">Ctrl</span>K
                </kbd>
            </button>

            <CommandDialog 
                open={open} 
                onOpenChange={setOpen}
                className="max-w-[600px] bg-zinc-950 border-white/10  backdrop-blur-2xl"
            >
                <DialogTitle className="sr-only">Recherche Documentation</DialogTitle>
                <div className="relative">
                    <CommandInput 
                        placeholder="Rechercher dans la documentation..." 
                        className="border-none focus:ring-0 text-lg font-medium h-16" 
                    />
                </div>

                <CommandList className="max-h-[450px] border-t border-white/5 no-scrollbar">
                    <CommandEmpty className="py-16 text-center text-zinc-500">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-white/5 flex items-center justify-center mx-auto mb-6">
                            <Book className="w-8 h-8 text-zinc-700" />
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-zinc-600">Aucun résultat</p>
                    </CommandEmpty>

                    <CommandGroup heading="Guides & Documentation" className="p-2">
                        {docs.map((doc) => (
                            <CommandItem
                                key={doc.slug}
                                onSelect={() => runCommand(() => router.push(`/docs/${doc.slug}`))}
                                value={`${doc.title} ${doc.category} ${doc.excerpt}`}
                                className="group flex items-start gap-4 p-4 rounded-2xl data-[selected=true]:bg-indigo-500/10 data-[selected=true]:text-white select-none cursor-pointer transition-all duration-300 mb-1"
                            >
                                <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 group-data-[selected=true]:border-indigo-500/30 group-data-[selected=true]:bg-indigo-500/5 transition-all">
                                    <FileText className="h-5 w-5 text-zinc-500 group-data-[selected=true]:text-indigo-400 shrink-0" />
                                </div>
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="font-bold text-sm text-zinc-200 group-data-[selected=true]:text-white transition-colors truncate">
                                        {doc.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-caption uppercase tracking-[0.2em] font-black text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-white/5 group-data-[selected=true]:border-indigo-500/20 group-data-[selected=true]:text-indigo-500/80">
                                            {doc.category}
                                        </span>
                                        {doc.excerpt && (
                                            <span className="text-xs text-zinc-600 line-clamp-1 group-data-[selected=true]:text-zinc-400 italic">
                                                {doc.excerpt.slice(0, 70)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
                
                <div className="p-3 border-t border-white/5 bg-zinc-950/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-zinc-900 text-caption font-black text-zinc-500">↑↓</kbd>
                            <span className="text-caption font-black text-zinc-600 uppercase tracking-widest">Naviguer</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-zinc-900 text-caption font-black text-zinc-500">Enter</kbd>
                            <span className="text-caption font-black text-zinc-600 uppercase tracking-widest">Ouvrir</span>
                        </div>
                    </div>
                    <span className="text-caption font-black text-indigo-500/40 uppercase tracking-widest">SigilOS Search Index</span>
                </div>
            </CommandDialog>
        </>
    );
}

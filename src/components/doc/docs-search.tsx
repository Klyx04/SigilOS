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
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-zinc-950 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
                    <span className="text-xs">Ctrl</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <DialogTitle className="sr-only">Recherche Documentation</DialogTitle>
                <div className="relative">
                    <CommandInput placeholder="Rechercher dans la documentation..." className="border-none focus:ring-0 text-lg font-medium" />
                </div>

                <CommandList className="max-h-[500px] border-t border-white/5">
                    <CommandEmpty className="py-12 text-center text-zinc-500">
                        <Book className="w-12 h-12 mx-auto mb-4 text-zinc-800" />
                        <p>Aucun article trouvé.</p>
                    </CommandEmpty>

                    <CommandGroup heading="Articles">
                        {docs.map((doc) => (
                            <CommandItem
                                key={doc.slug}
                                onSelect={() => runCommand(() => router.push(`/docs/${doc.slug}`))}
                                value={`${doc.title} ${doc.category} ${doc.excerpt}`}
                                className="group items-start py-3 data-[selected=true]:bg-indigo-500/10 data-[selected=true]:text-white select-none cursor-pointer"
                            >
                                <FileText className="mr-2 h-4 w-4 text-indigo-400 mt-1 shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-zinc-200 group-data-[selected=true]:text-white transition-colors">
                                        {doc.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-white/5">
                                            {doc.category}
                                        </span>
                                        {doc.excerpt && (
                                            <span className="text-xs text-zinc-600 line-clamp-1 max-w-[300px] group-data-[selected=true]:text-zinc-400">
                                                {doc.excerpt.slice(0, 60)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}

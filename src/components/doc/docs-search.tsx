"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText } from "lucide-react";
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
                className="group mb-3 flex w-full items-center gap-2 rounded-[4px] border border-border bg-surface px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">Rechercher…</span>
                <kbd className="hidden h-5 items-center gap-1 rounded-[3px] border border-border bg-background px-1.5 font-mono text-[11px] text-muted-foreground sm:inline-flex">
                    Ctrl K
                </kbd>
            </button>

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                className="registre max-w-[600px] bg-background border-border-strong"
            >
                <DialogTitle className="sr-only">Recherche Documentation</DialogTitle>
                <div className="relative">
                    <CommandInput
                        placeholder="Rechercher dans la documentation…"
                        className="h-14 border-none text-[15px] focus:ring-0"
                    />
                </div>

                <CommandList className="max-h-[450px] border-t border-border no-scrollbar">
                    <CommandEmpty className="py-12 text-center text-muted-foreground">
                        <p className="text-[13px]">Aucun résultat</p>
                    </CommandEmpty>

                    <CommandGroup heading="Guides & Documentation" className="p-2">
                        {docs.map((doc) => (
                            <CommandItem
                                key={doc.slug}
                                onSelect={() => runCommand(() => router.push(`/docs/${doc.slug}`))}
                                value={`${doc.title} ${doc.category} ${doc.excerpt}`}
                                className="group mb-0.5 flex cursor-pointer select-none items-start gap-3 rounded-[4px] px-3 py-2.5 transition-colors data-[selected=true]:bg-surface data-[selected=true]:text-foreground"
                            >
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-[13px] font-semibold text-foreground">
                                        {doc.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="shrink-0 text-[11px] text-muted-foreground">
                                            {doc.category}
                                        </span>
                                        {doc.excerpt && (
                                            <span className="line-clamp-1 text-[12px] text-muted-foreground">
                                                {doc.excerpt.slice(0, 70)}…
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>

                <div className="flex items-center gap-4 border-t border-border p-3">
                    <div className="flex items-center gap-1.5">
                        <kbd className="rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">↑↓</kbd>
                        <span className="text-[11px] text-muted-foreground">Naviguer</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <kbd className="rounded-[3px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">Entrée</kbd>
                        <span className="text-[11px] text-muted-foreground">Ouvrir</span>
                    </div>
                </div>
            </CommandDialog>
        </>
    );
}

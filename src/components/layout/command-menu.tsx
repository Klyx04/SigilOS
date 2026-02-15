"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Search,
    FileText,
    LayoutDashboard,
    Server,
    Book,
    Target,
    ScrollText,
    InfinityIcon
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog"; // Ensure accessibility
import { getSearchableDocs } from "@/server/actions/doc-actions";

export function CommandMenu() {
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

    // Fetch docs when opening
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
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-500 bg-zinc-900/50 border border-white/5 rounded-lg hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors w-64 justify-between"
            >
                <span className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5" />
                    Rechercher...
                </span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-zinc-950 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100">
                    <span className="text-xs">Ctrl</span>K
                </kbd>
            </button>

            {/* Provide a hidden title for accessibility if DialogTitle is required by your Dialog implementation but handled internally by CommandDialog (often CommandDialog wraps DialogContent but might miss Title) */}
            {/* However, Radix Dialog requires a Title for screen readers. CommandDialog usually handles this or we need to add it. */}
            {/* Checking shadcn implementation usually CommandDialog includes DialogContent. */}

            {/* Glassmorphism Premium Command Menu */}
            <CommandDialog open={open} onOpenChange={setOpen}>
                <DialogTitle className="sr-only">Menu de commande</DialogTitle>

                <div className="relative">
                    <CommandInput placeholder="Tapez une commande ou cherchez dans les docs..." className="border-none focus:ring-0 text-lg font-medium" />
                </div>

                <CommandList className="max-h-[500px] border-t border-white/5">
                    <CommandEmpty className="py-12 text-center text-zinc-500">
                        <p>Aucun résultat trouvé.</p>
                        <p className="text-xs mt-2">Essayez des mots-clés plus généraux.</p>
                    </CommandEmpty>

                    <CommandGroup heading="Navigation" className="text-zinc-400">
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/dashboard"))}
                            value="Dashboard Home Accueil Board"
                        >
                            <LayoutDashboard className="mr-2 h-4 w-4 text-indigo-400" />
                            <span className="font-medium">Dashboard</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/guilds"))}
                            value="Annuaire des Guildes Server Serveur Liste Recrutement"
                        >
                            <Server className="mr-2 h-4 w-4 text-emerald-400" />
                            <span className="font-medium">Annuaire des Guildes</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/docs"))}
                            value="Documentation Guide Help Aide API Tutoriel"
                        >
                            <Book className="mr-2 h-4 w-4 text-amber-400" />
                            <span className="font-medium">Documentation</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-white/5" />

                    <CommandGroup heading="Actions Rapides" className="text-zinc-400">
                        <CommandItem
                            onSelect={() => runCommand(() => router.push(`/dashboard/ocre/sync`))}
                            value="Synchroniser Ocre Metamob"
                        >
                            <Target className="mr-2 h-4 w-4 text-amber-400" />
                            <span className="font-medium">Synchroniser Ocre</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push(`/dashboard/missions/manage`))}
                            value="Gérer Missions Administration"
                        >
                            <ScrollText className="mr-2 h-4 w-4 text-emerald-400" />
                            <span className="font-medium">Gérer les Missions</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push(`/dashboard/songes`))}
                            value="Créer Run Songes Recruter"
                        >
                            <InfinityIcon className="mr-2 h-4 w-4 text-purple-400" />
                            <span className="font-medium">Lancer une Run Songes</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-white/5" />

                    <CommandGroup heading="Documentation (Recherche Profonde)" className="text-zinc-400">
                        {docs.map((doc) => (
                            <CommandItem
                                key={doc.slug}
                                onSelect={() => runCommand(() => router.push(`/docs/${doc.slug}`))}
                                // Deep Search: Includes Title, Category, and Content Excerpt
                                value={`${doc.title} ${doc.category} ${doc.excerpt} doc guide`}
                                className="group items-start py-3"
                            >
                                <FileText className="mr-2 h-4 w-4 text-purple-400 mt-1 shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-zinc-200 group-data-[selected=true]:text-white transition-colors">
                                        {doc.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-white/5">
                                            {doc.category}
                                        </span>
                                        {/* Excerpt Preview (truncated) */}
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

                    <CommandSeparator className="bg-white/5" />

                    <CommandGroup heading="Compte" className="text-zinc-400">
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/dashboard/settings"))}
                            value="Profil Settings Paramètres Config Account Compte"
                        >
                            <User className="mr-2 h-4 w-4 text-blue-400" />
                            <span className="font-medium">Profil</span>
                            <CommandShortcut>⌘P</CommandShortcut>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/api/auth/signout"))}
                            value="Se déconnecter Logout Déconnexion Exit Quit"
                        >
                            <LogOut className="mr-2 h-4 w-4 text-red-400" />
                            <span className="font-medium text-red-400/80 group-data-[selected=true]:text-red-400">Se déconnecter</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}

import { LogOut } from "lucide-react";

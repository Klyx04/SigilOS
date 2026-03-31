"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Settings,
    User,
    Search,
    ScrollText,
    Trophy,
    Sparkles,
    Crown,
    CheckSquare,
    LogOut,
    Home,
    Loader2,
    Users
} from "lucide-react";
import { useDebounce } from "use-debounce";
import { globalSearch, SearchResult } from "@/server/actions/search-actions";

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

interface CommandMenuProps {
    guildId: string;
}

export function CommandMenu({ guildId }: CommandMenuProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [debouncedQuery] = useDebounce(query, 300);
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        const openMenu = () => setOpen(true);

        document.addEventListener("keydown", down);
        document.addEventListener("open-command-menu", openMenu);
        return () => {
            document.removeEventListener("keydown", down);
            document.removeEventListener("open-command-menu", openMenu);
        };
    }, []);

    React.useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults([]);
            return;
        }

        const performSearch = async () => {
            setIsLoading(true);
            try {
                const searchResults = await globalSearch(debouncedQuery, guildId);
                setResults(searchResults);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, guildId]);

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    // Filter results by type
    const memberResults = results.filter(r => r.type === "MEMBER");
    const missionResults = results.filter(r => r.type === "MISSION");
    const pageResults = results.filter(r => r.type === "PAGE");

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            shouldFilter={false}
            className="bg-zinc-950/90 backdrop-blur-3xl border border-white/10 shadow-2xl sm:max-w-xl md:max-w-2xl rounded-2xl overflow-hidden"
        >
            <div className="flex items-center border-b border-white/5 px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <CommandInput 
                    placeholder="Rechercher un membre, une mission, une page... (Ctrl+K)" 
                    className="h-14 font-medium flex-1 bg-transparent focus:ring-0 border-none outline-none" 
                    value={query}
                    onValueChange={setQuery}
                />
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-emerald-500" />}
            </div>
            <CommandList className="max-h-[450px] premium-scrollbar">
                <CommandEmpty>Aucun résultat trouvé pour "{query}".</CommandEmpty>

                {/* --- DYNAMIC RESULTS --- */}
                {results.length > 0 && (
                    <>
                        {memberResults.length > 0 && (
                            <CommandGroup heading="Membres">
                                {memberResults.map((r) => (
                                    <CommandItem key={r.id} onSelect={() => runCommand(() => router.push(r.href))}>
                                        <Users className="mr-2 h-4 w-4 text-blue-400" />
                                        <div className="flex flex-col">
                                            <span>{r.title}</span>
                                            {r.subtitle && <span className="text-[10px] text-zinc-500">{r.subtitle}</span>}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {missionResults.length > 0 && (
                            <CommandGroup heading="Missions">
                                {missionResults.map((r) => (
                                    <CommandItem key={r.id} onSelect={() => runCommand(() => router.push(r.href))}>
                                        <ScrollText className="mr-2 h-4 w-4 text-amber-400" />
                                        <div className="flex flex-col">
                                            <span>{r.title}</span>
                                            {r.subtitle && <span className="text-[10px] text-zinc-500">{r.subtitle}</span>}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {pageResults.length > 0 && (
                            <CommandGroup heading="Pages & Outils">
                                {pageResults.map((r) => (
                                    <CommandItem key={r.id} onSelect={() => runCommand(() => router.push(r.href))}>
                                        <div className="mr-2 h-4 w-4 flex items-center justify-center">
                                            <Search className="h-3 w-3 text-zinc-400" />
                                        </div>
                                        <span>Aller vers {r.title}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        <CommandSeparator className="bg-white/5" />
                    </>
                )}

                <CommandGroup heading="Navigation Rapide">
                    <CommandItem onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}`))}>
                        <Home className="mr-2 h-4 w-4 text-emerald-400" />
                        <span>Accueil du Tableau de bord</span>
                        <CommandShortcut>🏠</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}/missions`))}>
                        <ScrollText className="mr-2 h-4 w-4 text-red-400" />
                        <span>Missions de Guilde</span>
                        <CommandShortcut>M</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}/ladder`))}>
                        <Trophy className="mr-2 h-4 w-4 text-amber-400" />
                        <span>Ladder d'Activité</span>
                        <CommandShortcut>L</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator className="bg-white/5" />

                <CommandGroup heading="Autre">
                    <CommandItem onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}/profile`))}>
                        <User className="mr-2 h-4 w-4 text-zinc-400" />
                        <span>Mon Profil Personnel</span>
                        <CommandShortcut>P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push("/api/auth/signout"))}>
                        <LogOut className="mr-2 h-4 w-4 text-red-500" />
                        <span>Déconnexion</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

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
            className="bg-zinc-950 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:max-w-[550px] rounded-2xl overflow-hidden p-0 gap-0"
        >
            <div className="relative">
                <div className="flex items-center border-b border-white/5 px-4 bg-white/[0.02]">
                    <Search className="mr-3 h-4 w-4 shrink-0 text-zinc-500" />
                    <CommandInput 
                        placeholder="Recherche globale..." 
                        className="h-14 font-medium flex-1 bg-transparent focus:ring-0 border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-600" 
                        value={query}
                        onValueChange={setQuery}
                    />
                    {isLoading && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin text-zinc-500" />
                    )}
                </div>

                <CommandList className="max-h-[380px] premium-scrollbar p-2">
                    <CommandEmpty className="py-12 text-center text-xs text-zinc-600">
                        Aucun résultat pour "{query}"
                    </CommandEmpty>

                    {/* --- DYNAMIC RESULTS --- */}
                    {results.length > 0 && (
                        <>
                            {memberResults.length > 0 && (
                                <CommandGroup heading={<span className="text-zinc-500 font-black tracking-widest uppercase text-[9px] px-2 mb-2 block">Membres</span>}>
                                    {memberResults.map((r) => (
                                        <CommandItem 
                                            key={r.id} 
                                            onSelect={() => runCommand(() => router.push(r.href))}
                                            className="group mx-1 my-0.5 p-2.5 rounded-xl data-[selected=true]:bg-white/5 border border-transparent transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center mr-3 shrink-0">
                                                <Users className="h-4 w-4 text-zinc-400" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-zinc-200 truncate text-sm">{r.title}</span>
                                                {r.subtitle && <span className="text-[10px] text-zinc-600 truncate">{r.subtitle}</span>}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {missionResults.length > 0 && (
                                <CommandGroup heading={<span className="text-zinc-500 font-black tracking-widest uppercase text-[9px] px-2 mb-2 block">Missions</span>}>
                                    {missionResults.map((r) => (
                                        <CommandItem 
                                            key={r.id} 
                                            onSelect={() => runCommand(() => router.push(r.href))}
                                            className="group mx-1 my-0.5 p-2.5 rounded-xl data-[selected=true]:bg-white/5 border border-transparent transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center mr-3 shrink-0">
                                                <ScrollText className="h-4 w-4 text-zinc-400" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-zinc-200 truncate text-sm">{r.title}</span>
                                                {r.subtitle && <span className="text-[10px] text-zinc-600 truncate">{r.subtitle}</span>}
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {pageResults.length > 0 && (
                                <CommandGroup heading={<span className="text-zinc-500 font-black tracking-widest uppercase text-[9px] px-2 mb-2 block">Pages</span>}>
                                    {pageResults.map((r) => (
                                        <CommandItem 
                                            key={r.id} 
                                            onSelect={() => runCommand(() => router.push(r.href))}
                                            className="group mx-1 my-0.5 p-2.5 rounded-xl data-[selected=true]:bg-white/5 border border-transparent transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center mr-3 shrink-0">
                                                <Sparkles className="h-4 w-4 text-zinc-400" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-zinc-200 truncate text-sm">{r.title}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                            <CommandSeparator className="bg-white/5 my-2" />
                        </>
                    )}

                    <CommandGroup heading={<span className="text-zinc-500 font-black tracking-widest uppercase text-[9px] px-2 mb-2 block">Navigation</span>}>
                        <CommandItem 
                            onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}`))}
                            className="mx-1 my-0.5 rounded-xl data-[selected=true]:bg-white/5 transition-all p-2.5"
                        >
                            <Home className="mr-3 h-3.5 w-3.5 text-zinc-500" />
                            <span className="font-semibold text-sm">Tableau de bord</span>
                        </CommandItem>
                        <CommandItem 
                            onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}/missions`))}
                            className="mx-1 my-0.5 rounded-xl data-[selected=true]:bg-white/5 transition-all p-2.5"
                        >
                            <ScrollText className="mr-3 h-3.5 w-3.5 text-zinc-500" />
                            <span className="font-semibold text-sm">Missions</span>
                        </CommandItem>
                        <CommandItem 
                            onSelect={() => runCommand(() => router.push(`/dashboard/${guildId}/ladder`))}
                            className="mx-1 my-0.5 rounded-xl data-[selected=true]:bg-white/5 transition-all p-2.5"
                        >
                            <Trophy className="mr-3 h-3.5 w-3.5 text-zinc-500" />
                            <span className="font-semibold text-sm">Ladder</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-white/5 my-2" />

                    <CommandGroup>
                        <CommandItem 
                            onSelect={() => runCommand(() => router.push("/api/auth/signout"))}
                            className="mx-1 my-0.5 rounded-xl data-[selected=true]:bg-red-500/10 text-red-500/80 transition-all p-2.5"
                        >
                            <LogOut className="mr-3 h-3.5 w-3.5" />
                            <span className="font-bold text-sm">Déconnexion</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>

                <div className="p-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[9px] font-black text-zinc-700 uppercase tracking-widest px-6">
                    <span>Recherche globale</span>
                    <span>v3.0</span>
                </div>
            </div>
        </CommandDialog>
    );
}

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchGuildMembers } from "@/server/actions/user-actions";

// Simple debounce hook implementation if not available
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface Member {
    id: string; // UserProfile ID
    name: string;
    subtitle?: string;
    image?: string | null;
}

interface MemberSelectorProps {
    guildId: string;
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
    maxSelection?: number;
}

export function MemberSelector({ guildId, selectedIds, onSelect, maxSelection = 7 }: MemberSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [options, setOptions] = React.useState<Member[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedMembers, setSelectedMembers] = React.useState<Member[]>([]); // Cache selected member objects

    const debouncedQuery = useDebounceValue(query, 300);

    // Fetch members on query change
    React.useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setOptions([]);
            return;
        }

        let active = true;
        setLoading(true);

        searchGuildMembers(guildId, debouncedQuery).then((res) => {
            if (active && res.success && res.data) {
                setOptions(res.data);
            }
            if (active) setLoading(false);
        });

        return () => { active = false; };
    }, [debouncedQuery, guildId]);

    const handleSelect = (member: Member) => {
        if (selectedIds.includes(member.id)) {
            onSelect(selectedIds.filter(id => id !== member.id));
            setSelectedMembers(prev => prev.filter(m => m.id !== member.id));
        } else {
            if (selectedIds.length >= maxSelection) return;
            onSelect([...selectedIds, member.id]);
            setSelectedMembers(prev => [...prev, member]);
        }
    };

    const handleRemove = (id: string) => {
        onSelect(selectedIds.filter(sid => sid !== id));
        setSelectedMembers(prev => prev.filter(m => m.id !== id));
    };

    return (
        <div className="space-y-3">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between bg-zinc-900/50 border-white/10 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                        disabled={selectedIds.length >= maxSelection}
                    >
                        <span className="flex items-center gap-2">
                            <Search className="w-4 h-4 opacity-50" />
                            {selectedIds.length >= maxSelection
                                ? "Limite atteinte"
                                : "Rechercher des membres..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-zinc-900 border-zinc-800 text-white" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Pseudo Dofus ou Discord..."
                            value={query}
                            onValueChange={setQuery}
                            className="bg-transparent border-none focus:ring-0"
                        />
                        <CommandList>
                            {loading && <div className="p-4 text-center text-xs text-zinc-500"><LoaderSpin /> Recherche...</div>}
                            {!loading && options.length === 0 && query.length >= 2 && (
                                <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                            )}
                            {!loading && query.length < 2 && (
                                <div className="p-4 text-center text-xs text-zinc-500">Tapez 2 lettres pour chercher</div>
                            )}

                            <CommandGroup>
                                {options.map((member) => {
                                    const isSelected = selectedIds.includes(member.id);
                                    return (
                                        <CommandItem
                                            key={member.id}
                                            value={member.id}
                                            onSelect={() => handleSelect(member)}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800 aria-selected:bg-zinc-800"
                                        >
                                            <div className="relative">
                                                <Avatar className="h-8 w-8 border border-white/10">
                                                    <AvatarImage src={member.image || undefined} />
                                                    <AvatarFallback className="bg-zinc-800 text-xs">
                                                        {member.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border border-black">
                                                        <Check className="w-2 h-2 text-black font-bold" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">{member.name}</span>
                                                {member.subtitle && (
                                                    <span className="text-xs text-zinc-500">{member.subtitle}</span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Selected Members Tags */}
            {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center gap-2 pl-1 pr-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-full transition-colors group"
                        >
                            <Avatar className="h-6 w-6 border border-white/10">
                                <AvatarImage src={member.image || undefined} />
                                <AvatarFallback className="bg-zinc-700 text-caption">
                                    {member.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-zinc-200">{member.name}</span>
                            <button
                                onClick={() => handleRemove(member.id)}
                                className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400 text-zinc-500 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="text-caption text-zinc-500">
                {selectedIds.length} / {maxSelection} participants sélectionnés
            </div>
        </div>
    );
}

function LoaderSpin() {
    return (
        <svg
            className="animate-spin h-4 w-4 text-zinc-400 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            ></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    );
}

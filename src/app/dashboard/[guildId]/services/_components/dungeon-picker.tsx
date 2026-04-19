"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronDown, X } from "lucide-react";
import { searchDungeons, type DungeonWithAchievements } from "@/server/actions/picker-actions";
import Image from "next/image";
import { getAchievementIconUrl } from "@/lib/achievement-icon";

export interface DungeonSelection {
    dungeon: DungeonWithAchievements;
    selectedAchievementIds: string[];
}

interface DungeonPickerProps {
    guildId: string;
    onSelect: (selection: DungeonSelection | null) => void;
    value?: DungeonSelection | null;
    disabled?: boolean;
}

export function DungeonPicker({ guildId, onSelect, value, disabled = false }: DungeonPickerProps) {
    const [query, setQuery] = useState(value?.dungeon.name ?? "");
    const [results, setResults] = useState<DungeonWithAchievements[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedDungeon, setSelectedDungeon] = useState<DungeonWithAchievements | null>(value?.dungeon ?? null);
    const [selectedAchievements, setSelectedAchievements] = useState<Set<string>>(
        new Set(value?.selectedAchievementIds ?? [])
    );
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        setLoading(true);
        try {
            const result = await searchDungeons(guildId, q || undefined);
            if (result.success) {
                setResults(result.data);
                setOpen(true);
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    function handleQueryChange(val: string) {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 300);
    }

    function handleFocus() {
        if (!open && results.length === 0 && !selectedDungeon) {
            doSearch("");
        } else {
            setOpen(true);
        }
    }

    function handleSelectDungeon(dungeon: DungeonWithAchievements) {
        setSelectedDungeon(dungeon);
        setSelectedAchievements(new Set());
        setQuery(dungeon.name);
        setOpen(false);
        onSelect({ dungeon, selectedAchievementIds: [] });
    }

    function handleToggleAchievement(id: string) {
        const next = new Set(selectedAchievements);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedAchievements(next);
        if (selectedDungeon) {
            onSelect({ dungeon: selectedDungeon, selectedAchievementIds: Array.from(next) });
        }
    }

    function handleClear() {
        setSelectedDungeon(null);
        setSelectedAchievements(new Set());
        setQuery("");
        setResults([]);
        setOpen(false);
        onSelect(null);
    }

    return (
        <div ref={containerRef} className="space-y-3">
            {/* Search input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                <Input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Nom du donjon (ex: Cawotte, Sphincter Cell...)"
                    disabled={disabled}
                    className="bg-white/5 border-white/10 pl-9 pr-16"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
                    {selectedDungeon && !loading && (
                        <button onClick={handleClear} className="text-zinc-500 hover:text-white transition-colors p-1">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {!selectedDungeon && (
                        <ChevronDown className="h-4 w-4 text-zinc-500 pointer-events-none" />
                    )}
                </div>
            </div>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 w-full rounded-md border border-white/10 bg-zinc-950 shadow-xl max-h-64 overflow-auto">
                    {results.length === 0 && !loading && (
                        <p className="px-3 py-4 text-center text-sm text-zinc-500">
                            {query ? `Aucun donjon pour "${query}"` : "Aucun donjon en base"}
                        </p>
                    )}
                    {results.map((dungeon) => (
                        <button
                            key={dungeon.id}
                            onClick={() => handleSelectDungeon(dungeon)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{dungeon.name}</p>
                                <p className="text-xs text-zinc-500 truncate">Boss: {dungeon.bossName} • Niv. {dungeon.level}</p>
                            </div>
                            {dungeon.achievements.length > 0 && (
                                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px] flex-shrink-0">
                                    {dungeon.achievements.length} succès
                                </Badge>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Achievements checkboxes (shown when a dungeon is selected and has achievements) */}
            {selectedDungeon && selectedDungeon.achievements.length > 0 && (
                <div className="rounded-md border border-white/10 bg-white/3 p-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                        Succès proposés
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                        {selectedDungeon.achievements.map((ach) => {
                            const iconUrl = getAchievementIconUrl(ach.challenge.slug, ach.challenge.iconUrl);
                            return (
                                <div key={ach.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${selectedAchievements.has(ach.id) ? "bg-cyan-500/10 border border-cyan-500/20" : "border border-transparent hover:bg-white/5"
                                    }`} onClick={() => handleToggleAchievement(ach.id)}>
                                    <Checkbox
                                        id={`ach-${ach.id}`}
                                        checked={selectedAchievements.has(ach.id)}
                                        onCheckedChange={() => handleToggleAchievement(ach.id)}
                                        className="border-white/20 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600 shrink-0"
                                    />
                                    {iconUrl && (
                                        <div className="relative h-7 w-7 shrink-0">
                                            <Image
                                                src={iconUrl}
                                                alt={ach.challenge.name}
                                                fill
                                                className="object-contain"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>
                                    )}
                                    <Label
                                        htmlFor={`ach-${ach.id}`}
                                        className="text-sm text-zinc-300 cursor-pointer flex-1"
                                    >
                                        {ach.challenge.name}
                                    </Label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, ExternalLink, PenLine } from "lucide-react";
import { searchDofusQuests, type DofusQuest } from "@/lib/dofusdude-client";

export interface QuestSelection {
    questId?: number;       // ID numérique DofusDB
    questName: string;
    dofusdbUrl?: string;    // Lien DofusDB
    isManual?: boolean;
    questType?: "COMBAT" | "TACTIQUE" | null; // Sous-catégorie
}

interface QuestPickerProps {
    onSelect: (selection: QuestSelection | null) => void;
    value?: QuestSelection | null;
    disabled?: boolean;
    showSubCategory?: boolean;
}

export function QuestPicker({ onSelect, value, disabled = false, showSubCategory = true }: QuestPickerProps) {
    const [query, setQuery] = useState(value?.questName ?? "");
    const [results, setResults] = useState<DofusQuest[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<QuestSelection | null>(value ?? null);
    const [questType, setQuestType] = useState<"COMBAT" | "TACTIQUE" | null>(value?.questType ?? null);
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
            const data = await searchDofusQuests(q || "");
            setResults(data);
            setOpen(true);
        } catch {
            // fail silently
        } finally {
            setLoading(false);
        }
    }, []);

    function handleQueryChange(val: string) {
        setQuery(val);
        setSelected(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 350);
    }

    function handleFocus() {
        if (!selected) doSearch(query);
        else setOpen(true);
    }

    function handleSelectFromAPI(quest: DofusQuest) {
        const sel: QuestSelection = {
            questId: quest.id,
            questName: quest.name,
            dofusdbUrl: quest.dofusdbUrl,
            isManual: false,
            questType,
        };
        setSelected(sel);
        setQuery(quest.name);
        setOpen(false);
        onSelect(sel);
    }

    function handleSelectManual() {
        if (!query.trim()) return;
        const sel: QuestSelection = { questName: query.trim(), isManual: true, questType };
        setSelected(sel);
        setOpen(false);
        onSelect(sel);
    }

    function handleQuestType(t: "COMBAT" | "TACTIQUE" | null) {
        const next = questType === t ? null : t;
        setQuestType(next);
        if (selected) {
            const updated = { ...selected, questType: next };
            setSelected(updated);
            onSelect(updated);
        }
    }

    function handleClear() {
        setSelected(null);
        setQuery("");
        setResults([]);
        setOpen(false);
        setQuestType(null);
        onSelect(null);
    }

    return (
        <div ref={containerRef} className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                <Input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Quête Ocre, Ligue de la Magie..."
                    disabled={disabled}
                    className="bg-white/5 border-white/10 pl-9 pr-8"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-500" />}
                {selected && !loading && (
                    <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Selected state */}
            {selected && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={selected.isManual ? "border-amber-500/30 text-amber-400 text-caption" : "border-violet-500/30 text-violet-400 text-caption"}>
                        {selected.isManual ? "Saisie libre" : "DofusDB ✓"}
                    </Badge>
                    {selected.dofusdbUrl && (
                        <a
                            href={selected.dofusdbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Voir sur DofusDB
                        </a>
                    )}
                </div>
            )}

            {/* Sous-catégorie combat */}
            {showSubCategory && (
                <div className="space-y-1.5">
                    <p className="text-caption font-bold uppercase tracking-wider text-zinc-500">Type de combat (optionnel)</p>
                    <div className="flex gap-2">
                        {([["COMBAT", "⚔️ Combat de quête"], ["TACTIQUE", "🧩 Combat tactique"]] as const).map(([val, label]) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => handleQuestType(val)}
                                className={`px-3 py-1 rounded text-xs font-medium border transition-all ${questType === val
                                        ? "border-violet-500/60 bg-violet-500/15 text-violet-300"
                                        : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-white/10 bg-zinc-950 shadow-xl">
                    <ul className="max-h-56 overflow-auto py-1">
                        {results.map((quest) => (
                            <li key={quest.id}>
                                <button
                                    onClick={() => handleSelectFromAPI(quest)}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white truncate">{quest.name}</p>
                                        {quest.isDungeonQuest && (
                                            <p className="text-caption text-cyan-400">Quête de donjon</p>
                                        )}
                                    </div>
                                    {quest.levelMin && (
                                        <span className="text-xs text-zinc-500 flex-shrink-0">Niv. {quest.levelMin}{quest.levelMax && quest.levelMax !== quest.levelMin ? `–${quest.levelMax}` : ""}</span>
                                    )}
                                </button>
                            </li>
                        ))}

                        {query.trim().length >= 2 && (
                            <li>
                                <button
                                    onClick={handleSelectManual}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-amber-500/5 transition-colors text-left border-t border-white/5"
                                >
                                    <PenLine className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                    <span className="text-amber-400">Utiliser &quot;{query.trim()}&quot; (saisie libre)</span>
                                </button>
                            </li>
                        )}

                        {results.length === 0 && !loading && (
                            <li className="px-3 py-4 text-center text-sm text-zinc-500">
                                {query.length >= 2 ? `Aucune quête trouvée sur DofusDB` : "Tapez pour rechercher..."}
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import type { DofusItem, DofusItemCategory } from "@/lib/dofusdude-client";
import Image from "next/image";

interface DofusItemSearchProps {
    onSelect: (item: DofusItem) => void;
    category?: DofusItemCategory;
    placeholder?: string;
    value?: DofusItem | null;
    onClear?: () => void;
    disabled?: boolean;
}

export function DofusItemSearch({
    onSelect,
    category = "all",
    placeholder = "Rechercher un item Dofus...",
    value,
    onClear,
    disabled = false,
}: DofusItemSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<DofusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const search = useCallback(
        async (q: string) => {
            if (q.length < 2) {
                setResults([]);
                setOpen(false);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/dofusdude/search?q=${encodeURIComponent(q)}&cat=${category}`);
                const json = await res.json() as { items?: DofusItem[]; error?: string };
                if (json.items) {
                    setResults(json.items);
                    setOpen(true);
                }
            } catch {
                // Silently fail
            } finally {
                setLoading(false);
            }
        },
        [category]
    );

    function handleChange(val: string) {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(val), 300);
    }

    function handleSelect(item: DofusItem) {
        onSelect(item);
        setQuery(item.name);
        setOpen(false);
        setResults([]);
    }

    function handleClear() {
        setQuery("");
        setResults([]);
        setOpen(false);
        onClear?.();
    }

    // If a value is pre-selected, show it
    if (value && !query) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <Image
                    src={value.iconUrl}
                    alt={value.name}
                    width={24}
                    height={24}
                    className="rounded"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/placeholder-item.png"; }}
                />
                <span className="flex-1 font-medium text-foreground">{value.name}</span>
                <span className="text-xs text-muted-foreground">Niv. {value.level}</span>
                <button
                    onClick={handleClear}
                    className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="bg-surface border-border pl-9 pr-8"
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {query && !loading && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-xl">
                    <ul className="max-h-60 overflow-auto py-1">
                        {results.map((item) => (
                            <li key={item.ankamaId}>
                                <button
                                    onClick={() => handleSelect(item)}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-surface transition-colors text-left"
                                >
                                    <Image
                                        src={item.iconUrl}
                                        alt={item.name}
                                        width={28}
                                        height={28}
                                        className="rounded flex-shrink-0"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/placeholder-item.png"; }}
                                    />
                                    <span className="flex-1 font-medium text-foreground leading-tight">
                                        {item.name}
                                    </span>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <span className="text-xs text-muted-foreground">Niv. {item.level}</span>
                                        <span className="text-caption text-muted-foreground">{item.type}</span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <p className="border-t border-border px-3 py-1.5 text-caption text-muted-foreground">
                        Source : Dofusdude (api.dofusdu.de)
                    </p>
                </div>
            )}

            {open && !loading && results.length === 0 && query.length >= 2 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background p-3 text-center text-sm text-muted-foreground shadow-xl">
                    Aucun résultat pour &quot;{query}&quot;
                </div>
            )}
        </div>
    );
}

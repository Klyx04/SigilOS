"use client";

import { useState, useRef, useCallback } from "react";
import { Search, ExternalLink, Loader2, X, PackageOpen, BookMarked } from "lucide-react";
import Image from "next/image";

// ─── Types (DofusDB API) ──────────────────────────────────────────────────────

interface DofusItem {
    id: number;
    name: { fr: string };
    level: number;
    type: { name: { fr: string } };
    imgset?: { sd?: string; icon?: string }[];
    img?: string;
}

interface DofusDBResponse {
    data: DofusItem[];
}

// ─── Type color ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    "Arme": "#ef4444",
    "Équipement": "#a855f7",
    "Ressource": "#f59e0b",
    "Consommable": "#10b981",
    "Parchemin": "#3b82f6",
    "Quête": "#ec4899",
    "Familier": "#8b5cf6",
};

function getTypeColor(typeName: string): string {
    for (const [key, color] of Object.entries(TYPE_COLORS)) {
        if (typeName?.includes(key)) return color;
    }
    return "#8b5cf6"; // Default nice purple
}

function getItemUrl(id: number): string {
    return `https://www.dofusdb.fr/fr/database/item/${id}`;
}

function extractImg(item: DofusItem): string | null {
    if (item.imgset && item.imgset.length > 0) {
        return item.imgset[0].icon ?? item.imgset[0].sd ?? null;
    }
    if (item.img) return item.img;
    return null;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce(fn: (value: string) => void, delay: number) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    return useCallback((value: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => fn(value), delay);
    }, [fn, delay]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemSearchPanel() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<DofusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const search = useCallback(async (q: string) => {
        if (!q.trim() || q.trim().length < 2) {
            setResults([]);
            setSearched(false);
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            // Using slug.fr[$search] because the API expects it for search queries now
            const url = `https://api.dofusdb.fr/items?slug.fr[$search]=${encodeURIComponent(q)}&$limit=6&$skip=0`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error("API error");
            const data: DofusDBResponse = await res.json();
            setResults(data.data ?? []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedSearch = useDebounce(search, 350);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        debouncedSearch(val);
    };

    const clear = () => {
        setQuery("");
        setResults([]);
        setSearched(false);
        inputRef.current?.focus();
    };

    return (
        <div
            className="flex flex-col rounded-2xl overflow-hidden relative shadow-lg"
            style={{
                background: "linear-gradient(145deg, rgba(30,27,75,0.4) 0%, rgba(13,17,23,0.8) 100%)", /* Plus lumineux/bleuté que l'ancien noir absolu */
                border: "1px solid rgba(139, 92, 246, 0.2)",
                backdropFilter: "blur(12px)",
                minHeight: 380,
            }}
        >
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
                style={{ background: "#8b5cf6", transform: "translate(30%, -30%)" }} />

            {/* Header */}
            <div className="px-5 py-4 relative z-10 font-bold" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center border border-violet-500/20">
                        <BookMarked className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                            Encyclopédie DofusDB
                        </h3>
                        <p className="text-[10px] text-zinc-400 font-medium">Recherche d'équipements & ressources</p>
                    </div>
                </div>
            </div>

            {/* Search input */}
            <div className="px-4 pt-4 pb-2 relative z-10">
                <div className="relative flex items-center group/input">
                    <Search className="absolute left-3.5 h-4 w-4 text-violet-400 pointer-events-none transition-colors group-focus-within/input:text-violet-300" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleChange}
                        placeholder="Ex: Gelano, Amulette..."
                        className="w-full pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 rounded-xl outline-none transition-all shadow-inner"
                        style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(139, 92, 246, 0.2)",
                            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)"
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = "rgba(139, 92, 246, 0.6)";
                            e.target.style.background = "rgba(0,0,0,0.4)";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = "rgba(139, 92, 246, 0.2)";
                            e.target.style.background = "rgba(0,0,0,0.3)";
                        }}
                    />
                    {query && (
                        <button onClick={clear} className="absolute right-3 p-1 rounded-md bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 relative z-10 mt-2">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-violet-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-xs font-medium uppercase tracking-widest">Recherche en cours...</span>
                    </div>
                )}

                {!loading && searched && results.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                        <PackageOpen className="h-10 w-10 text-zinc-600 mb-1" />
                        <p className="text-sm text-zinc-400">Aucun objet trouvé pour<br />
                            <span className="text-white font-semibold mt-1 inline-block">&ldquo;{query}&rdquo;</span>
                        </p>
                    </div>
                )}

                {!loading && !searched && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center opacity-60">
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-violet-500/30 flex items-center justify-center">
                            <Search className="h-5 w-5 text-violet-400" />
                        </div>
                        <p className="text-xs font-medium text-violet-200/50 uppercase tracking-widest">Entrez au moins 2 lettres</p>
                    </div>
                )}

                {!loading && results.map((item) => {
                    const imgUrl = extractImg(item);
                    const typeColor = getTypeColor(item.type?.name?.fr ?? "");
                    const typeName = item.type?.name?.fr ?? "Objet";

                    return (
                        <a
                            key={item.id}
                            href={getItemUrl(item.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-300 cursor-pointer bg-white/[0.02]"
                            style={{ border: "1px solid rgba(255,255,255,0.03)" }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background = `linear-gradient(90deg, ${typeColor}15, rgba(255,255,255,0.02))`;
                                (e.currentTarget as HTMLElement).style.borderColor = `${typeColor}30`;
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.03)";
                            }}
                        >
                            {/* Icon */}
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative shadow-inner"
                                style={{ background: "rgba(0,0,0,0.4)" }}
                            >
                                <div className="absolute inset-0 opacity-20" style={{ background: typeColor }} />
                                {imgUrl ? (
                                    <Image
                                        src={imgUrl}
                                        alt={item.name.fr}
                                        width={40}
                                        height={40}
                                        className="object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300 relative z-10"
                                        unoptimized
                                    />
                                ) : (
                                    <PackageOpen className="h-5 w-5 relative z-10" style={{ color: typeColor, opacity: 0.7 }} />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold text-white group-hover:text-violet-200 transition-colors truncate">
                                    {item.name.fr}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span
                                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm"
                                        style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}25` }}
                                    >
                                        {typeName}
                                    </span>
                                    <span className="text-[10px] font-medium text-zinc-400">Niveau {item.level}</span>
                                </div>
                            </div>

                            <ExternalLink
                                className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                                style={{ color: typeColor }}
                            />
                        </a>
                    );
                })}
            </div>

            {/* Footer */}
            {results.length > 0 && (
                <div className="px-4 py-3 bg-black/20 text-center border-t border-white/5 relative z-10">
                    <a
                        href={`https://www.dofusdb.fr/fr/database/item?name=${encodeURIComponent(query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold uppercase tracking-widest text-violet-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                        Voir tous les résultats sur DofusDB <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            )}
        </div>
    );
}

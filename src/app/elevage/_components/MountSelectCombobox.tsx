"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { MountInfo } from "@/data/mount-data";

export interface MountSelectComboboxProps {
    value: string;
    onChange: (mountName: string) => void;
    mounts: MountInfo[];
    label: string;
    genderLabel?: string;
    genderColor?: string; // e.g. "text-cyan-400" or "text-rose-400"
}

export function MountSelectCombobox({
    value,
    onChange,
    mounts,
    label,
    genderLabel,
    genderColor = "text-foreground",
}: MountSelectComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGen, setSelectedGen] = useState<number | "all">("all");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();

    const selectedMount = useMemo(() => {
        return mounts.find((m) => m.name === value) || mounts[0];
    }, [mounts, value]);

    // Available generations for this family
    const generations = useMemo(() => {
        const gens = new Set(mounts.map((m) => m.generation));
        return Array.from(gens).sort((a, b) => a - b);
    }, [mounts]);

    // Filtered mounts
    const filteredMounts = useMemo(() => {
        const norm = (s: string) =>
            s
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

        const q = norm(searchQuery.trim());

        return mounts.filter((m) => {
            if (selectedGen !== "all" && m.generation !== selectedGen) {
                return false;
            }
            if (!q) return true;
            const matchName = norm(m.name).includes(q);
            const matchStats = norm(m.stats).includes(q);
            const matchGen = `gen ${m.generation}`.includes(q) || `g${m.generation}` === q;
            return matchName || matchStats || matchGen;
        });
    }, [mounts, searchQuery, selectedGen]);

    // Handle outside click & Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        // Auto focus search input when opened
        const timer = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
            clearTimeout(timer);
        };
    }, [isOpen]);

    const handleSelect = (mount: MountInfo) => {
        onChange(mount.name);
        setIsOpen(false);
        setSearchQuery("");
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Header label & Gen tag */}
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5 px-0.5">
                <span className="flex items-center gap-1.5 text-foreground">
                    {genderLabel && <span className={genderColor}>{genderLabel}</span>}
                    <span>{label}</span>
                </span>
                {selectedMount && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border">
                        Gen {selectedMount.generation}
                    </span>
                )}
            </div>

            {/* Trigger Button Card */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                    isOpen
                        ? "bg-surface border-foreground/30 shadow-lg shadow-black/20 ring-1 ring-foreground/20"
                        : "bg-surface/50 hover:bg-surface border-border hover:border-border-strong"
                }`}
            >
                {selectedMount ? (
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-12 h-12 shrink-0 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                            <Image
                                src={selectedMount.img}
                                alt={selectedMount.name}
                                width={40}
                                height={40}
                                unoptimized
                                className="object-contain"
                            />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground truncate block">
                                    {selectedMount.name}
                                </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate block font-mono">
                                {selectedMount.stats}
                            </span>
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">Sélectionner une monture...</span>
                )}

                <div className="shrink-0 pl-1 text-muted-foreground group-hover:text-foreground transition-colors">
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                            isOpen ? "rotate-180 text-foreground" : ""
                        }`}
                    />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label={label}
                    className="absolute z-50 left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-elevated/95 backdrop-blur-2xl shadow-2xl p-2.5 space-y-2.5 animate-in fade-in-0 zoom-in-95 duration-150"
                    style={{ minWidth: "300px" }}
                >
                    {/* Search Field */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher (nom, gen, stats)..."
                            className="w-full pl-8.5 pr-8 py-2 text-xs rounded-lg bg-surface/80 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                                title="Effacer la recherche"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Quick Gen Badges */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                        <button
                            type="button"
                            onClick={() => setSelectedGen("all")}
                            className={`px-2 py-0.5 rounded-md font-semibold shrink-0 transition-colors ${
                                selectedGen === "all"
                                    ? "bg-foreground text-background"
                                    : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface/80"
                            }`}
                        >
                            Toutes ({mounts.length})
                        </button>
                        {generations.map((gen) => (
                            <button
                                key={gen}
                                type="button"
                                onClick={() => setSelectedGen(gen)}
                                className={`px-2 py-0.5 rounded-md font-mono shrink-0 transition-colors ${
                                    selectedGen === gen
                                        ? "bg-foreground text-background font-bold"
                                        : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface/80"
                                }`}
                            >
                                G{gen}
                            </button>
                        ))}
                    </div>

                    {/* Mount Items List */}
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                        {filteredMounts.length === 0 ? (
                            <div className="text-center py-6 text-xs text-muted-foreground">
                                Aucune monture trouvée pour « {searchQuery} »
                            </div>
                        ) : (
                            filteredMounts.map((mount) => {
                                const isSelected = mount.name === value;
                                return (
                                    <button
                                        key={mount.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelect(mount)}
                                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                            isSelected
                                                ? "bg-foreground/10 border-foreground/30 text-foreground"
                                                : "bg-surface/40 hover:bg-surface border-transparent hover:border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="relative w-8 h-8 shrink-0 rounded-md bg-background border border-border p-0.5 flex items-center justify-center overflow-hidden">
                                                <Image
                                                    src={mount.img}
                                                    alt={mount.name}
                                                    width={28}
                                                    height={28}
                                                    unoptimized
                                                    className="object-contain"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted/50 text-muted-foreground shrink-0">
                                                        G{mount.generation}
                                                    </span>
                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                        {mount.name}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground truncate block font-mono">
                                                    {mount.stats}
                                                </span>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <Check className="w-4 h-4 text-foreground shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

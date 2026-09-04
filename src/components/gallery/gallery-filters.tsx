"use client";

import { useState } from "react";
import { Check, ChevronDown, Mars, Search, Venus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import NextImage from "next/image";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { DO_TAGS } from "@/lib/dofus-tags";

// Extract numeric icon ID from icon path (e.g. "/assets/dofus/classes/9.png" → 9)
export function getNumericClassId(cls: typeof DOFUS_CLASSES[number]): number | null {
    const match = cls.icon.match(/classes\/(\d+)\.png/);
    return match ? parseInt(match[1]) : null;
}

export function AdvancedTagFilter({
    selectedTags, onToggleTag
}: { selectedTags: string[]; onToggleTag: (id: string) => void }) {
    // Separate tags into categories for a better UX
    const categories = [
        {
            title: "Bi-éléments",
            tags: ["terrefeu","terreeau","terreair","feueau","feuair","eauair"]
        },
        {
            title: "Stats & Spécialités",
            tags: ["tank","soin","pp","sagesse","ini","retpa","retpm"]
        },
        {
            title: "Dommages & Modes",
            tags: ["dopou","docrit","multinocrit","leveling","songes"]
        },
        {
            title: "PvP & Autres",
            tags: ["koli1v1","koli2v2","koli3v3","perco"]
        }
    ];

    const [query, setQuery] = useState("");
    const activeCount = selectedTags.length;
    const q = query.trim().toLowerCase();

    const visibleCategories = categories
        .map(cat => ({
            ...cat,
            tags: q
                ? cat.tags.filter(tid => {
                    const tag = DO_TAGS.find(t => t.id === tid);
                    return tag && (tag.text.toLowerCase().includes(q) || tag.label.toLowerCase().includes(q));
                })
                : cat.tags
        }))
        .filter(cat => cat.tags.length > 0);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-sm",
                    activeCount > 0
                        ? "bg-warning/15 text-warning border border-warning/30 shadow-[0_0_12px_rgba(234,179,8,0.15)]"
                        : "bg-surface/90 text-muted-foreground hover:text-foreground hover:bg-elevated border border-border/80"
                )} aria-label={`Tags avancés${activeCount > 0 ? ` (${activeCount} actifs)` : ""}`}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 transition-all", activeCount > 0 ? "bg-warning ring-2 ring-warning/30" : "bg-muted-foreground/40")} />
                    Tags Avancés
                    {activeCount > 0 && (
                        <span className="min-w-[1.1rem] h-4 px-1 flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-black tabular-nums shadow-sm">
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(340px,calc(100vw-2rem))] max-h-[calc(100dvh-3rem)] overflow-hidden flex flex-col bg-background border-border rounded-2xl p-4 shadow-lg" align="start" side="bottom" sideOffset={8}>
                {/* Recherche dans les tags */}
                <div className="relative mb-3 shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un tag..."
                        aria-label="Rechercher un tag avancé"
                        className="pl-8 h-8 text-xs bg-surface border-border rounded-lg"
                    />
                </div>
                <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                    {visibleCategories.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                            Aucun tag ne correspond à « {query} »
                        </p>
                    )}
                    {visibleCategories.map(cat => (
                        <div key={cat.title} className="space-y-2.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pl-1">{cat.title}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.tags.map(tid => {
                                    const tag = DO_TAGS.find(t => t.id === tid);
                                    if (!tag) return null;
                                    const isSelected = selectedTags.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => onToggleTag(tag.id)}
                                            aria-pressed={isSelected}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                                                isSelected
                                                    ? `${tag.className} ring-1 ring-border-strong`
                                                    : "text-muted-foreground bg-surface border-transparent hover:text-foreground hover:bg-surface hover:border-border"
                                            )}
                                        >
                                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                                            {tag.text}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function ClassFilter({
    selectedClass, onSelectClass, label = "Classe"
}: { selectedClass: string | number | null; onSelectClass: (id: string | number | null) => void; label?: string }) {
    const active = DOFUS_CLASSES.find(c => {
        const numId = getNumericClassId(c);
        return numId !== null && String(numId) === String(selectedClass);
    });
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 min-w-[7rem] justify-between shadow-sm",
                    active 
                        ? "bg-success/15 text-foreground border border-success/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]" 
                        : "bg-surface/90 text-muted-foreground hover:text-foreground hover:bg-elevated border border-border/80"
                )}>
                    {active ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <NextImage src={active.icon} alt={active.name} width={16} height={16} className="object-contain shrink-0 drop-shadow-sm" />
                            <span className="truncate font-bold">{active.name}</span>
                            <Check className="w-3 h-3 shrink-0 text-success ml-0.5" />
                        </div>
                    ) : (
                        <span>{label}</span>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(280px,calc(100vw-2rem))] max-h-[calc(100dvh-3rem)] overflow-y-auto bg-background/95 backdrop-blur-2xl border-border rounded-2xl p-2.5 shadow-2xl" align="start" side="bottom" sideOffset={8}>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-2 flex items-center justify-between">
                    <span>Filtrer par {label.toLowerCase()}</span>
                    {active && <span className="text-success text-[10px] lowercase font-semibold">1 active</span>}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                    {DOFUS_CLASSES.map(cls => {
                        const numId = getNumericClassId(cls);
                        if (numId === null) return null;
                        const idStr = String(numId);
                        const isSelected = String(selectedClass) === idStr;
                        return (
                            <button
                                key={cls.id}
                                onClick={() => onSelectClass(isSelected ? null : idStr)}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-bold transition-all",
                                    isSelected
                                        ? "bg-success/15 text-foreground border border-success/40 shadow-sm ring-1 ring-success/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface/90 border border-transparent hover:border-border/60"
                                )}
                            >
                                <NextImage src={cls.icon} alt={cls.name} width={26} height={26} className="object-contain drop-shadow-sm" />
                                <span className="truncate max-w-full text-center">{cls.name}</span>
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function GenderFilter({
    selectedGender, onSelectGender
}: { selectedGender: string | null; onSelectGender: (gender: string | null) => void }) {
    return (
        <div className="flex items-center gap-1 bg-elevated p-1 rounded-xl border border-border">
            <button
                onClick={() => onSelectGender(selectedGender === "M" ? null : "M")}
                className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    selectedGender === "M" ? "bg-info text-info-foreground" : "text-muted-foreground hover:text-info hover:bg-surface"
                )}
                title="Sexe Masculin"
            >
                <Mars className="w-4 h-4" />
            </button>
            <button
                onClick={() => onSelectGender(selectedGender === "F" ? null : "F")}
                className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    selectedGender === "F" ? "bg-danger text-danger-foreground" : "text-muted-foreground hover:text-danger hover:bg-surface"
                )}
                title="Sexe F�minin"
            >
                <Venus className="w-4 h-4" />
            </button>
        </div>
    );
}

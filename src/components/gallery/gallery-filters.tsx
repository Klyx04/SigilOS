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
                    "h-8 px-3 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0",
                    activeCount > 0
                        ? "bg-elevated text-foreground border border-border-strong"
                        : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface"
                )} aria-label={`Tags avancés${activeCount > 0 ? ` (${activeCount} actifs)` : ""}`}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeCount > 0 ? "bg-warning" : "bg-muted")} />
                    Tags Avancés
                    {activeCount > 0 && (
                        <span className="min-w-[1.1rem] h-4 px-1 flex items-center justify-center rounded-full bg-warning text-warning-foreground text-caption font-bold tabular-nums">
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] bg-background border-border rounded-2xl p-4 shadow-lg" align="start" side="bottom">
                {/* Recherche dans les tags */}
                <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un tag..."
                        aria-label="Rechercher un tag avancé"
                        className="pl-8 h-8 text-xs bg-surface border-border rounded-lg"
                    />
                </div>
                <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
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
                                                    ? `${tag.className} ring-1 ring-white/10`
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
                    "h-8 px-3 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 min-w-[6.5rem] justify-between",
                    active ? "bg-surface text-foreground border border-border-strong" : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface"
                )}>
                    {active ? (
                        <>
                            <NextImage src={active.icon} alt={active.name} width={14} height={14} className="object-contain" />
                            {active.name}
                            <Check className="w-3 h-3 shrink-0 text-success" />
                        </>
                    ) : label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-background border-border rounded-2xl p-2 shadow-lg" align="start" side="bottom">
                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest px-2 pt-1 pb-2">Filtrer par {label.toLowerCase()}</p>
                <div className="grid grid-cols-3 gap-1">
                    {DOFUS_CLASSES.map(cls => {
                        const numId = getNumericClassId(cls);
                        if (numId === null) return null;
                        const idStr = String(numId);
                        return (
                            <button
                                key={cls.id}
                                onClick={() => onSelectClass(String(selectedClass) === idStr ? null : idStr)}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-2 rounded-xl text-caption font-semibold transition-all",
                                    String(selectedClass) === idStr
                                        ? "bg-surface text-foreground ring-1 ring-white/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface"
                                )}
                            >
                                <NextImage src={cls.icon} alt={cls.name} width={24} height={24} className="object-contain" />
                                {cls.name}
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
                    selectedGender === "F" ? "bg-pink-500 text-foreground" : "text-muted-foreground hover:text-pink-400 hover:bg-surface"
                )}
                title="Sexe Féminin"
            >
                <Venus className="w-4 h-4" />
            </button>
        </div>
    );
}

"use client";

import { useRef, useState } from "react";
import { Search, X, Swords, Map, Zap, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DjFiltersState {
    search: string;
    mode: string;         // "" | "DONJON" | "QUETE"
    minLevel: number;
    maxLevel: number;
    showClosed: boolean;
    onlyWithAchievement: boolean;
    onlyWithSpots: boolean;
}

export const DEFAULT_FILTERS: DjFiltersState = {
    search: "",
    mode: "",
    minLevel: 1,
    maxLevel: 1000,
    showClosed: false,
    onlyWithAchievement: false,
    onlyWithSpots: false,
};

interface DjFiltersBarProps {
    filters: DjFiltersState;
    onChange: (f: DjFiltersState) => void;
    total: number;
    filtered: number;
}

const LEVEL_PRESETS = [
    { label: "Tout", min: 1, max: 1000 },
    { label: "1-100", min: 1, max: 100 },
    { label: "100-140", min: 100, max: 140 },
    { label: "140-200", min: 140, max: 200 },
    { label: "200+", min: 200, max: 1000 },
];

export function DjFiltersBar({ filters, onChange, total, filtered }: DjFiltersBarProps) {
    const searchRef = useRef<HTMLInputElement>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const hasActiveAdvancedFilters =
        filters.minLevel !== 1 ||
        filters.maxLevel !== 1000 ||
        filters.showClosed ||
        filters.onlyWithAchievement ||
        filters.onlyWithSpots;

    const hasActiveFilters = filters.search !== "" || filters.mode !== "" || hasActiveAdvancedFilters;

    const activePreset = LEVEL_PRESETS.find(
        (p) => p.min === filters.minLevel && p.max === filters.maxLevel
    );

    return (
        <div className="space-y-3">
            {/* Row 1: Essential Search + Mode + Filter Toggle */}
            <div className="flex flex-col md:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1 group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300">
                        <Search className={cn(
                            "w-4 h-4 transition-colors",
                            filters.search ? "text-warning" : "text-muted-foreground group-focus-within:text-warning"
                        )} />
                    </div>
                    <input
                        ref={searchRef}
                        type="text"
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        placeholder="Rechercher un donjon, boss, quête…"
                        className="w-full bg-surface/80 border border-border rounded-xl pl-10 pr-8 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-warning/50 h-11"
                    />
                    {filters.search && (
                        <button 
                            onClick={() => onChange({ ...filters, search: "" })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Mode Selector — 4 segments à largeur fixe (aucun décalage au toggle) */}
                    <div className="grid grid-cols-4 bg-surface/80 border border-border rounded-xl p-1 h-11 items-stretch w-[336px] shrink-0" role="group" aria-label="Type de post">
                        {[
                            { value: "", label: "Tous", icon: null },
                            { value: "DONJON", label: "DJ", icon: Swords },
                            { value: "QUETE", label: "Quête", icon: Map },
                            { value: "DEFI", label: "Défi", icon: Zap },
                        ].map(({ value, label, icon: Icon }) => {
                            const isActive = filters.mode === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => onChange({ ...filters, mode: value })}
                                    aria-pressed={isActive}
                                    className={cn(
                                        "flex items-center justify-center gap-1 px-1 rounded-lg text-caption font-black transition-colors min-w-0",
                                        isActive ? "bg-info text-info-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                                    <span className="uppercase tracking-wider truncate">{label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Advanced Filter Toggle — largeur fixe (le compteur ne déplace rien) */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        aria-expanded={showAdvanced}
                        className={`flex items-center justify-center gap-2 px-4 rounded-xl text-caption font-black h-11 transition-all border min-w-[132px] ${showAdvanced || hasActiveAdvancedFilters
                            ? "bg-surface border-border-strong text-foreground"
                            : "bg-surface/50 border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                            }`}
                    >
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        Filtres
                        {hasActiveFilters && (
                            <span className="font-mono tabular-nums text-[10px] opacity-80">{filtered}/{total}</span>
                        )}
                    </button>

                    {/* Reset — toujours monté (désactivé), icône X distincte du refresh données */}
                    <button
                        onClick={() => onChange({ ...DEFAULT_FILTERS })}
                        disabled={!hasActiveFilters}
                        className="flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground border border-border bg-surface/50 transition-colors shrink-0 enabled:hover:text-danger enabled:hover:border-danger/50 enabled:hover:bg-danger/30 disabled:opacity-30 disabled:cursor-default"
                        title="Effacer les filtres"
                        aria-label="Effacer les filtres"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Row 2: Advanced Filters — hauteur animée (la page ne saute plus) */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    showAdvanced ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-surface/50 border border-border rounded-2xl shadow-inner mb-2">
                            {/* Level presets */}
                            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mr-2">Niveau</span>
                            {LEVEL_PRESETS.map((preset) => {
                                const isActive = activePreset?.label === preset.label;
                                return (
                                    <button
                                        key={preset.label}
                                        onClick={() => onChange({ ...filters, minLevel: preset.min, maxLevel: preset.max })}
                                        className={`px-3 py-1.5 rounded-lg text-caption font-black transition-colors border ${isActive
                                            ? "bg-info/20 text-info border-info/30"
                                            : "bg-surface text-muted-foreground border-transparent hover:bg-surface hover:text-foreground"
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}

                            <div className="w-px h-4 bg-surface mx-2" />

                            {/* Smart toggles */}
                            <ToggleChip
                                icon={<Users className="w-3 h-3" />}
                                label="Places dispo"
                                active={filters.onlyWithSpots}
                                onToggle={() => onChange({ ...filters, onlyWithSpots: !filters.onlyWithSpots })}
                                colorClass="bg-success/15 text-success border-success/30"
                            />
                            <ToggleChip
                                icon={<Star className="w-3 h-3" />}
                                label="Avec succès"
                                active={filters.onlyWithAchievement}
                                onToggle={() => onChange({ ...filters, onlyWithAchievement: !filters.onlyWithAchievement })}
                                colorClass="bg-warning/15 text-warning border-warning/30"
                            />
                            <ToggleChip
                                icon={<X className="w-3 h-3" />}
                                label="Posts fermés"
                                active={filters.showClosed}
                                onToggle={() => onChange({ ...filters, showClosed: !filters.showClosed })}
                                colorClass="bg-muted/15 text-muted-foreground border-border/30"
                            />

                            {/* Results count */}
                            {hasActiveFilters && showAdvanced && (
                                <span className="ml-auto text-caption text-muted-foreground font-black uppercase tracking-widest">
                                    {filtered}/{total} RÉSULTATS
                                </span>
                            )}
                        </div>
                        </div>
            </div>
        </div>
    );
}

function ToggleChip({
    icon, label, active, onToggle, colorClass,
}: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onToggle: () => void;
    colorClass: string;
}) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-bold border transition-colors ${active
                ? colorClass
                : "bg-background text-muted-foreground border-border hover:bg-elevated hover:text-foreground"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

"use client";

import { useRef, useState } from "react";
import { Search, X, Swords, Map, Zap, Users, Star, RotateCcw } from "lucide-react";
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
                    {/* Mode Selector */}
                    <div className="flex bg-surface/80 border border-border rounded-xl p-1 h-11 items-center">
                        {[
                            { value: "", label: "Tous", icon: null, active: "bg-info text-info-foreground" },
                            { value: "DONJON", label: "DJ", icon: Swords, active: "bg-danger text-danger-foreground" },
                            { value: "QUETE", label: "Quête", icon: Map, active: "bg-success text-success-foreground" },
                            { value: "DEFI", label: "Défi", icon: Zap, active: "bg-amber-500 text-white" },
                        ].map(({ value, label, icon: Icon, active }) => {
                            const isActive = filters.mode === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => onChange({ ...filters, mode: value })}
                                    aria-pressed={isActive}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 px-4 h-full rounded-lg text-caption font-black transition-colors",
                                        isActive ? active : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    <span className="uppercase tracking-wider">{label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Advanced Filter Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`relative flex items-center gap-2 px-4 rounded-xl text-caption font-black h-11 transition-all border ${showAdvanced || hasActiveAdvancedFilters
                            ? "bg-surface border-border-strong text-foreground"
                            : "bg-surface/50 border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                            }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Filtres
                        {hasActiveAdvancedFilters && (
                            <span className="w-1.5 h-1.5 rounded-full bg-background" />
                        )}
                    </button>

                    {/* Reset */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => onChange({ ...DEFAULT_FILTERS })}
                            className="flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-danger border border-border hover:border-danger/50 bg-surface/50 hover:bg-danger/30 transition-colors shrink-0"
                            title="Reset"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Row 2: Advanced Filters — collapse en CSS léger (opti) */}
            {showAdvanced && (
                <div className="overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
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
                                        Lvl {preset.label}
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
                            {hasActiveFilters && (
                                <span className="ml-auto text-caption text-muted-foreground font-black uppercase tracking-widest">
                                    {filtered}/{total} RÉSULTATS
                                </span>
                            )}
                        </div>
                        </div>
            )}
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
                : "bg-surface text-muted-foreground border-border hover:bg-surface hover:text-foreground"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

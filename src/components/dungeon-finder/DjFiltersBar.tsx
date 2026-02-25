"use client";

import { useRef } from "react";
import { Search, X, Swords, Map, Users, Star, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

    const hasActiveFilters =
        filters.search !== "" ||
        filters.mode !== "" ||
        filters.minLevel !== 1 ||
        filters.maxLevel !== 1000 ||
        filters.showClosed ||
        filters.onlyWithAchievement ||
        filters.onlyWithSpots;

    const activePreset = LEVEL_PRESETS.find(
        (p) => p.min === filters.minLevel && p.max === filters.maxLevel
    );

    return (
        <div className="space-y-2.5">
            {/* Row 1: Search + Mode + Reset */}
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        placeholder="Rechercher un donjon, boss, quête…"
                        className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-all"
                    />
                    <AnimatePresence>
                        {filters.search && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => { onChange({ ...filters, search: "" }); searchRef.current?.focus(); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mode: Donjon / Quête / All */}
                <div className="flex gap-1 bg-slate-900/70 border border-slate-700/60 rounded-xl p-1 shrink-0">
                    {[
                        { value: "", label: "Tous", icon: null },
                        { value: "DONJON", label: "Donjon", icon: Swords },
                        { value: "QUETE", label: "Quête", icon: Map },
                    ].map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            onClick={() => onChange({ ...filters, mode: value })}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filters.mode === value
                                    ? value === "DONJON"
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                                        : value === "QUETE"
                                            ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/30"
                                            : "bg-slate-700 text-white"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            {Icon && <Icon className="w-3 h-3" />}
                            {label}
                        </button>
                    ))}
                </div>

                {/* Reset */}
                <AnimatePresence>
                    {hasActiveFilters && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => onChange({ ...DEFAULT_FILTERS })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-white border border-slate-700/60 bg-slate-900/70 hover:bg-slate-800 transition-all shrink-0"
                            title="Réinitialiser les filtres"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Row 2: Smart chips */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Level presets */}
                {LEVEL_PRESETS.map((preset) => {
                    const isActive = activePreset?.label === preset.label;
                    return (
                        <button
                            key={preset.label}
                            onClick={() => onChange({ ...filters, minLevel: preset.min, maxLevel: preset.max })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${isActive
                                    ? "bg-slate-700 text-white border-slate-600"
                                    : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                                }`}
                        >
                            Lvl {preset.label}
                        </button>
                    );
                })}

                <div className="w-px h-4 bg-slate-800 mx-0.5" />

                {/* Smart toggles */}
                <ToggleChip
                    icon={<Users className="w-3 h-3" />}
                    label="Places dispo"
                    active={filters.onlyWithSpots}
                    onToggle={() => onChange({ ...filters, onlyWithSpots: !filters.onlyWithSpots })}
                    colorClass="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                />
                <ToggleChip
                    icon={<Star className="w-3 h-3" />}
                    label="Avec succès"
                    active={filters.onlyWithAchievement}
                    onToggle={() => onChange({ ...filters, onlyWithAchievement: !filters.onlyWithAchievement })}
                    colorClass="bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                />
                <ToggleChip
                    icon={<X className="w-3 h-3" />}
                    label="Posts fermés"
                    active={filters.showClosed}
                    onToggle={() => onChange({ ...filters, showClosed: !filters.showClosed })}
                    colorClass="bg-slate-500/15 text-slate-400 border-slate-500/30"
                />

                {/* Results count */}
                {hasActiveFilters && (
                    <span className="ml-auto text-[11px] text-slate-600 font-medium">
                        {filtered}/{total} post{total !== 1 ? "s" : ""}
                    </span>
                )}
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${active
                    ? colorClass
                    : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

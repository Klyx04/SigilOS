"use client";

import { useRef, useState } from "react";
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
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        placeholder="Rechercher un donjon, boss, quête…"
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 shadow-inner transition-all h-11 backdrop-blur-md"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Mode Selector */}
                    <div className="flex bg-slate-900/50 border border-white/5 rounded-xl p-1 relative shadow-inner h-11 items-center">
                        {[
                            { value: "", label: "Tous", icon: null },
                            { value: "DONJON", label: "DJ", icon: Swords },
                            { value: "QUETE", label: "Quête", icon: Map },
                        ].map(({ value, label, icon: Icon }) => {
                            const isActive = filters.mode === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => onChange({ ...filters, mode: value })}
                                    className={`relative z-10 flex items-center justify-center gap-1.5 px-3 h-full rounded-lg text-[11px] font-black transition-all ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-mode-pill"
                                            className="absolute inset-0 rounded-lg -z-10 bg-indigo-600 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                        />
                                    )}
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Advanced Filter Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`relative flex items-center gap-2 px-4 rounded-xl text-[11px] font-black h-11 transition-all border ${showAdvanced || hasActiveAdvancedFilters
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                            : "bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                            }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Filtres
                        {hasActiveAdvancedFilters && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        )}
                    </button>

                    {/* Reset */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => onChange({ ...DEFAULT_FILTERS })}
                            className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-500 hover:text-rose-400 border border-white/5 hover:border-rose-900/50 bg-slate-900/50 hover:bg-rose-950/30 transition-all shadow-inner shrink-0"
                            title="Reset"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Row 2: Collapsible Advanced Filters */}
            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, y: -10 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -10 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-900/50 border border-white/5 rounded-2xl shadow-inner mb-2">
                            {/* Level presets */}
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-2">Niveau</span>
                            {LEVEL_PRESETS.map((preset) => {
                                const isActive = activePreset?.label === preset.label;
                                return (
                                    <button
                                        key={preset.label}
                                        onClick={() => onChange({ ...filters, minLevel: preset.min, maxLevel: preset.max })}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${isActive
                                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-indigo-900/20"
                                            : "bg-white/5 text-slate-500 border-transparent hover:bg-white/10 hover:text-slate-300"
                                            }`}
                                    >
                                        Lvl {preset.label}
                                    </button>
                                );
                            })}

                            <div className="w-px h-4 bg-white/10 mx-2" />

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
                                <span className="ml-auto text-[10px] text-slate-600 font-black uppercase tracking-widest">
                                    {filtered}/{total} RÉSULTATS
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border shadow-sm transition-all ${active
                ? colorClass
                : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-300 shadow-inner"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

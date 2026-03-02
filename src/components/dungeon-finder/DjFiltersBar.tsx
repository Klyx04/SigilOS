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
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner transition-all h-11"
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

                {/* Gamified Mode: Donjon / Quête / All */}
                <div className="flex bg-slate-900/50 border border-white/5 rounded-xl p-1 shrink-0 relative shadow-inner h-11 items-center">
                    {[
                        { value: "", label: "Tous", icon: null },
                        { value: "DONJON", label: "Donjon", icon: Swords },
                        { value: "QUETE", label: "Quête", icon: Map },
                    ].map(({ value, label, icon: Icon }) => {
                        const isActive = filters.mode === value;
                        return (
                            <button
                                key={value}
                                onClick={() => onChange({ ...filters, mode: value })}
                                className={`relative z-10 flex items-center justify-center gap-1.5 px-4 h-full rounded-lg text-xs font-bold transition-colors whitespace-nowrap min-w-[80px] ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="active-mode-pill"
                                        className={`absolute inset-0 rounded-lg -z-10 shadow-md ${value === "DONJON" ? "bg-indigo-600 border border-indigo-500/50 shadow-indigo-900/40"
                                            : value === "QUETE" ? "bg-cyan-600 border border-cyan-500/50 shadow-cyan-900/40"
                                                : "bg-slate-700 border border-slate-600 shadow-black/40"
                                            }`}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                                {Icon && <Icon className="w-3.5 h-3.5" />}
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Reset Button Placeholder to avoid Layout Shift */}
                <div className="w-[110px] sm:w-[130px] flex justify-end shrink-0">
                    <AnimatePresence>
                        {hasActiveFilters && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                                onClick={() => onChange({ ...DEFAULT_FILTERS })}
                                className="flex items-center justify-center gap-1.5 px-3 w-full rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-900/50 bg-slate-900/50 hover:bg-rose-950/30 transition-all shadow-inner h-11"
                                title="Réinitialiser les filtres"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Reset</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
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
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border shadow-sm ${isActive
                                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-indigo-900/20"
                                : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-300 shadow-inner"
                                }`}
                        >
                            Lvl {preset.label}
                        </button>
                    );
                })}

                <div className="w-px h-4 bg-white/10 mx-0.5" />

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

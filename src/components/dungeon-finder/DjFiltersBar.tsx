"use client";

import { useState } from "react";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export interface DjFiltersState {
    search: string;
    mode: string;
    minLevel: number;
    maxLevel: number;
    showClosed: boolean;
}

const DEFAULT_FILTERS: DjFiltersState = {
    search: "",
    mode: "",
    minLevel: 1,
    maxLevel: 1000,
    showClosed: false,
};

const MODES = [
    { value: "", label: "Tous" },
    { value: "FARM", label: "Farm" },
    { value: "SUCCES", label: "Succès" },
    { value: "MIXED", label: "Mixte" },
    { value: "QUETE", label: "Quête" },
];

interface DjFiltersBarProps {
    filters: DjFiltersState;
    onChange: (f: DjFiltersState) => void;
    total: number;
    filtered: number;
}

export function DjFiltersBar({ filters, onChange, total, filtered }: DjFiltersBarProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const hasActiveFilters =
        filters.search !== "" ||
        filters.mode !== "" ||
        filters.minLevel !== 1 ||
        filters.maxLevel !== 1000 ||
        filters.showClosed;

    function reset() {
        onChange({ ...DEFAULT_FILTERS });
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        placeholder="Rechercher un donjon, boss…"
                        className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 backdrop-blur-sm"
                    />
                    {filters.search && (
                        <button onClick={() => onChange({ ...filters, search: "" })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Mode tabs */}
                <div className="flex gap-1 bg-slate-900/60 border border-slate-700/60 rounded-xl p-1 backdrop-blur-sm">
                    {MODES.map((m) => (
                        <button
                            key={m.value}
                            onClick={() => onChange({ ...filters, mode: m.value })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filters.mode === m.value
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Advanced toggle */}
                <Button variant="outline" size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`h-10 border-slate-700/60 text-slate-400 hover:text-white shrink-0 ${showAdvanced ? "bg-slate-800 border-slate-600" : ""}`}>
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                    Filtres
                    {hasActiveFilters && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </Button>
            </div>

            {/* Advanced filters */}
            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 pb-2">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Niveau min</label>
                                <input
                                    type="number"
                                    min={1} max={1000}
                                    value={filters.minLevel}
                                    onChange={(e) => onChange({ ...filters, minLevel: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Niveau max</label>
                                <input
                                    type="number"
                                    min={1} max={1000}
                                    value={filters.maxLevel}
                                    onChange={(e) => onChange({ ...filters, maxLevel: parseInt(e.target.value) || 1000 })}
                                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div onClick={() => onChange({ ...filters, showClosed: !filters.showClosed })}
                                        className={`w-10 h-5 rounded-full border transition-all relative ${filters.showClosed ? "bg-indigo-600 border-indigo-500" : "bg-slate-800 border-slate-700"}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${filters.showClosed ? "left-5" : "left-0.5"}`} />
                                    </div>
                                    <span className="text-xs text-slate-400">Posts fermés</span>
                                </label>
                            </div>
                            {hasActiveFilters && (
                                <div className="flex items-end">
                                    <Button variant="ghost" size="sm" onClick={reset}
                                        className="h-9 text-xs text-slate-500 hover:text-white">
                                        <X className="w-3 h-3 mr-1" /> Réinitialiser
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results count */}
            {hasActiveFilters && (
                <p className="text-[11px] text-slate-600">
                    {filtered} résultat{filtered !== 1 ? "s" : ""} sur {total} post{total !== 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}

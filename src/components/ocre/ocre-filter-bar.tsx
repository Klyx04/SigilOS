"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";

// =============================================================================
// OCRE FILTER BAR - Modern, readable filters
// =============================================================================

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    RefreshCw,
    X,
    Swords,
    Skull,
    Crown,
    Footprints,
    Sparkles,
    ArrowUpDown,
    ChevronDown,
    Check,
} from "lucide-react";
import { OcreExchangeModal } from "./ocre-exchange-modal";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type MonsterType = "all" | "boss" | "archimonstre";
export type SortOption = "name-asc" | "name-desc" | "step-asc" | "step-desc";

export interface OcreFilters {
    searchQuery: string;
    selectedType: MonsterType;
    selectedStep: string;
    selectedZone: string;
    minQuantity: number;
    sortBy: SortOption;
}

interface OcreFilterBarProps {
    filters: OcreFilters;
    onFiltersChange: (filters: OcreFilters) => void;
    steps: number[];
    zones: string[];
    guildId: string;
    showMarketplace?: boolean;
    hasOcreChannel?: boolean;
    selectionMode?: boolean;
    onSelectionModeToggle?: () => void;
}

// =============================================================================
// CONFIG
// =============================================================================

const MONSTER_TYPES: Array<{ id: MonsterType; label: string; icon: typeof Swords; shortLabel: string }> = [
    { id: "all", label: "Tous types", shortLabel: "Tous", icon: Swords },
    { id: "boss", label: "Boss", shortLabel: "Boss", icon: Skull },
    { id: "archimonstre", label: "Archimonstres", shortLabel: "Archis", icon: Crown },
];

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
    { id: "step-asc", label: "Étape croissante" },
    { id: "step-desc", label: "Étape décroissante" },
    { id: "name-asc", label: "Nom A → Z" },
    { id: "name-desc", label: "Nom Z → A" },
];

const QUANTITY_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 0, label: "Toute quantité" },
    { value: 1, label: "1+ (Possédés)" },
    { value: 2, label: "2+ (Doublons)" },
    { value: 3, label: "3+ (Triples)" },
    { value: 4, label: "4+ (Quadruples)" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function OcreFilterBar({
    filters,
    onFiltersChange,
    steps,
    zones,
    guildId,
    showMarketplace = true,
    hasOcreChannel,
    selectionMode,
    onSelectionModeToggle,
}: OcreFilterBarProps) {
    const updateFilter = <K extends keyof OcreFilters>(key: K, value: OcreFilters[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const hasActiveFilters =
        filters.searchQuery.trim() !== "" ||
        filters.selectedType !== "all" ||
        filters.selectedStep !== "all" ||
        filters.selectedZone !== "all" ||
        filters.minQuantity > 0 ||
        filters.sortBy !== "step-asc";

    const [localSearch, setLocalSearch] = useState(filters.searchQuery);
    const debouncedSearch = useDebounce(localSearch, 300);

    useEffect(() => {
        if (debouncedSearch !== filters.searchQuery) {
            updateFilter("searchQuery", debouncedSearch);
        }
    }, [debouncedSearch]);

    // Sync local search when filters are reset
    useEffect(() => {
        setLocalSearch(filters.searchQuery);
    }, [filters.searchQuery]);

    const clearFilters = () => {
        onFiltersChange({
            searchQuery: "",
            selectedType: "all",
            selectedStep: "all",
            selectedZone: "all",
            minQuantity: 0,
            sortBy: "step-asc",
        });
    };

    const currentSort = SORT_OPTIONS.find(s => s.id === filters.sortBy);
    const currentQty = QUANTITY_OPTIONS.find(q => q.value === filters.minQuantity);
    const currentType = MONSTER_TYPES.find(t => t.id === filters.selectedType);

    return (
        <div className="space-y-3">
            {/* Compact Search & Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
                    <Input
                        placeholder="Rechercher un monstre..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        className="pl-10 h-10 text-xs bg-zinc-900/60 backdrop-blur-md border-white/5 rounded-xl focus:border-amber-500/50 focus:ring-amber-500/10 transition-all placeholder:text-zinc-500"
                    />
                    {localSearch && (
                        <button
                            onClick={() => setLocalSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground font-bold rounded-xl hover:bg-white/5"
                        >
                            Réinitialiser
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSelectionModeToggle}
                        className={cn(
                            "h-10 px-4 rounded-xl text-xs font-bold gap-2 transition-all border-white/5",
                            selectionMode 
                                ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20" 
                                : "bg-zinc-900/40 text-muted-foreground hover:bg-zinc-800"
                        )}
                    >
                        <Check className="h-3.5 w-3.5" />
                        <span>{selectionMode ? "Quitter" : "Sélectionner"}</span>
                    </Button>

                    {showMarketplace && (
                        <OcreExchangeModal
                            guildId={guildId}
                            hasOcreChannel={hasOcreChannel}
                            trigger={
                                <Button
                                    size="sm"
                                    className="h-10 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-900/20 rounded-xl font-bold gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs"
                                >
                                    <Sparkles className="h-3.5 w-3.5 fill-white/20" />
                                    <span>Échanges</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>

            {/* Compact Filters & Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Type Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-9 px-3 text-xs font-bold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-1.5 hover:bg-zinc-800 transition-all text-zinc-400",
                                filters.selectedType !== "all" && "border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-sm"
                            )}
                        >
                            {filters.selectedType === "all" ? (
                                <>
                                    <Swords className="h-3.5 w-3.5" />
                                    Tous types
                                </>
                            ) : filters.selectedType === "boss" ? (
                                <>
                                    <Skull className="h-3.5 w-3.5 text-red-400" />
                                    Boss
                                </>
                            ) : (
                                <>
                                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                                    Archimonstres
                                </>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-zinc-950 border border-white/10 shadow-2xl rounded-xl p-1 z-[100] min-w-[150px]">
                        {MONSTER_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                                <DropdownMenuItem
                                    key={type.id}
                                    onClick={() => updateFilter("selectedType", type.id)}
                                    className="text-xs py-2 px-3 gap-2 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {type.label}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Step Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-9 px-3 text-xs font-bold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-1.5 hover:bg-zinc-800 transition-all text-zinc-400",
                                filters.selectedStep !== "all" && "border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-sm"
                            )}
                        >
                            <Footprints className="h-3.5 w-3.5" />
                            {filters.selectedStep === "all" ? "Toutes étapes" : `Étape ${filters.selectedStep}`}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[250px] overflow-y-auto bg-zinc-950 border border-white/10 shadow-2xl rounded-xl p-1 z-[100] min-w-[150px]">
                        <DropdownMenuItem
                            onClick={() => updateFilter("selectedStep", "all")}
                            className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                        >
                            <Check className={cn("mr-2 h-3.5 w-3.5", filters.selectedStep !== "all" && "opacity-0")} />
                            Toutes étapes
                        </DropdownMenuItem>
                        {steps.map((step) => (
                            <DropdownMenuItem
                                key={step}
                                onClick={() => updateFilter("selectedStep", step.toString())}
                                className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                            >
                                <Check className={cn("mr-2 h-3.5 w-3.5", filters.selectedStep !== step.toString() && "opacity-0")} />
                                Étape {step}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-9 px-3 text-xs font-bold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-1.5 hover:bg-zinc-800 transition-all text-zinc-400",
                                filters.sortBy !== "step-asc" && "border-blue-500/30 bg-blue-500/10 text-blue-500 shadow-sm"
                            )}
                        >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            {currentSort?.label || "Tri"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-zinc-950 border border-white/10 shadow-2xl rounded-xl p-1 z-[100] min-w-[160px]">
                        {SORT_OPTIONS.map((sort) => (
                            <DropdownMenuItem
                                key={sort.id}
                                onClick={() => updateFilter("sortBy", sort.id)}
                                className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                            >
                                <Check className={cn("mr-2 h-3.5 w-3.5", filters.sortBy !== sort.id && "opacity-0")} />
                                {sort.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Zone Dropdown (only if zones exist) */}
                {zones.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-9 px-3 text-xs font-bold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-1.5 max-w-[150px] hover:bg-zinc-800 transition-all text-zinc-400",
                                    filters.selectedZone !== "all" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 shadow-sm"
                                )}
                            >
                                <span className="truncate">
                                    {filters.selectedZone === "all" ? "Toutes zones" : filters.selectedZone}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[250px] overflow-y-auto bg-zinc-950 border border-white/10 shadow-2xl rounded-xl p-1 z-[100] min-w-[180px]">
                            <DropdownMenuItem
                                onClick={() => updateFilter("selectedZone", "all")}
                                className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                            >
                                <Check className={cn("mr-2 h-3.5 w-3.5", filters.selectedZone !== "all" && "opacity-0")} />
                                Toutes zones
                            </DropdownMenuItem>
                            {zones.map((zone) => (
                                <DropdownMenuItem
                                    key={zone}
                                    onClick={() => updateFilter("selectedZone", zone)}
                                    className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                                >
                                    <Check className={cn("mr-2 h-3.5 w-3.5", filters.selectedZone !== zone && "opacity-0")} />
                                    {zone}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Quantity Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-9 px-3 text-xs font-bold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-1.5 hover:bg-zinc-800 transition-all text-zinc-400",
                                filters.minQuantity > 0 && "border-purple-500/30 bg-purple-500/10 text-purple-500 shadow-sm"
                            )}
                        >
                            <Crown className="h-3.5 w-3.5" />
                            {currentQty?.label || "Quantité"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-zinc-950 border border-white/10 shadow-2xl rounded-xl p-1 z-[100] min-w-[160px]">
                        {QUANTITY_OPTIONS.map((q) => (
                            <DropdownMenuItem
                                key={q.value}
                                onClick={() => updateFilter("minQuantity", q.value)}
                                className="text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-300 hover:text-white"
                            >
                                <Check className={cn("mr-2 h-3.5 w-3.5", filters.minQuantity !== q.value && "opacity-0")} />
                                {q.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

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

export type MonsterType = "all" | "monstre" | "boss" | "archimonstre";
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
}

// =============================================================================
// CONFIG
// =============================================================================

const MONSTER_TYPES: Array<{ id: MonsterType; label: string; icon: typeof Swords; shortLabel: string }> = [
    { id: "all", label: "Tous types", shortLabel: "Tous", icon: Swords },
    { id: "monstre", label: "Monstres", shortLabel: "Monstres", icon: Swords },
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
        <div className="space-y-4">
            {/* Search Row */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
                    <Input
                        placeholder="Rechercher un monstre..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        className="pl-12 h-12 text-base bg-zinc-900/40 backdrop-blur-md border-white/5 rounded-xl focus:border-amber-500/50 focus:ring-amber-500/10 transition-all"
                    />
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="lg"
                        onClick={clearFilters}
                        className="h-12 px-4 text-muted-foreground hover:text-foreground shrink-0"
                    >
                        <X className="h-5 w-5 mr-2" />
                        Reset
                    </Button>
                )}

                {showMarketplace && (
                    <>
                        <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block" />
                        <OcreExchangeModal
                            guildId={guildId}
                            hasOcreChannel={hasOcreChannel}
                            trigger={
                                <Button
                                    size="lg"
                                    className="h-12 px-3 sm:px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-900/20 rounded-xl font-semibold gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Sparkles className="h-5 w-5 fill-white/20" />
                                    <span className="hidden sm:inline">Place de Marché</span>
                                </Button>
                            }
                        />
                    </>
                )}
            </div>

            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type Selector - Large Pills */}
                <div className="flex items-center rounded-xl bg-zinc-900/40 backdrop-blur-md border border-white/5 p-1.5 overflow-x-auto max-w-full no-scrollbar">
                    {MONSTER_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isActive = filters.selectedType === type.id;
                        return (
                            <button
                                key={type.id}
                                onClick={() => updateFilter("selectedType", type.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
                                    isActive
                                        ? "bg-amber-500/10 text-amber-500 shadow-md border border-amber-500/20"
                                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                                <span className="hidden sm:inline">{type.label}</span>
                                <span className="sm:hidden">{type.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-10 bg-white/10" />

                {/* Step Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="lg"
                            className={cn(
                                "h-12 px-5 text-sm font-semibold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-2 hover:bg-zinc-800 transition-all",
                                filters.selectedStep !== "all" && "border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]"
                            )}
                        >
                            <Footprints className="h-4 w-4" />
                            {filters.selectedStep === "all" ? "Toutes étapes" : `Étape ${filters.selectedStep}`}
                            <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto min-w-[180px]">
                        <DropdownMenuItem
                            onClick={() => updateFilter("selectedStep", "all")}
                            className="text-sm py-2.5"
                        >
                            <Check className={cn("mr-2 h-4 w-4", filters.selectedStep !== "all" && "opacity-0")} />
                            Toutes les étapes
                        </DropdownMenuItem>
                        {steps.map((step) => (
                            <DropdownMenuItem
                                key={step}
                                onClick={() => updateFilter("selectedStep", step.toString())}
                                className="text-sm py-2.5"
                            >
                                <Check className={cn("mr-2 h-4 w-4", filters.selectedStep !== step.toString() && "opacity-0")} />
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
                            size="lg"
                            className={cn(
                                "h-12 px-5 text-sm font-semibold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-2 hover:bg-zinc-800 transition-all",
                                filters.sortBy !== "step-asc" && "border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]"
                            )}
                        >
                            <ArrowUpDown className="h-4 w-4" />
                            {currentSort?.label || "Tri"}
                            <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[180px]">
                        {SORT_OPTIONS.map((sort) => (
                            <DropdownMenuItem
                                key={sort.id}
                                onClick={() => updateFilter("sortBy", sort.id)}
                                className="text-sm py-2.5"
                            >
                                <Check className={cn("mr-2 h-4 w-4", filters.sortBy !== sort.id && "opacity-0")} />
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
                                size="lg"
                                className={cn(
                                    "h-12 px-5 text-sm font-semibold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-2 max-w-[200px] hover:bg-zinc-800 transition-all",
                                    filters.selectedZone !== "all" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                                )}
                            >
                                <span className="truncate">
                                    {filters.selectedZone === "all" ? "Toutes zones" : filters.selectedZone}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto min-w-[200px]">
                            <DropdownMenuItem
                                onClick={() => updateFilter("selectedZone", "all")}
                                className="text-sm py-2.5"
                            >
                                <Check className={cn("mr-2 h-4 w-4", filters.selectedZone !== "all" && "opacity-0")} />
                                Toutes les zones
                            </DropdownMenuItem>
                            {zones.map((zone) => (
                                <DropdownMenuItem
                                    key={zone}
                                    onClick={() => updateFilter("selectedZone", zone)}
                                    className="text-sm py-2.5"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", filters.selectedZone !== zone && "opacity-0")} />
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
                            size="lg"
                            className={cn(
                                "h-12 px-5 text-sm font-semibold border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl gap-2 hover:bg-zinc-800 transition-all",
                                filters.minQuantity > 0 && "border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]"
                            )}
                        >
                            <Crown className="h-4 w-4" />
                            {currentQty?.label || "Quantité"}
                            <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[180px]">
                        {QUANTITY_OPTIONS.map((q) => (
                            <DropdownMenuItem
                                key={q.value}
                                onClick={() => updateFilter("minQuantity", q.value)}
                                className="text-sm py-2.5"
                            >
                                <Check className={cn("mr-2 h-4 w-4", filters.minQuantity !== q.value && "opacity-0")} />
                                {q.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

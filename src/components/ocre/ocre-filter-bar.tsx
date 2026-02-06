"use client";

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
    isRefreshing: boolean;
    onRefresh: () => void;
    guildId: string;
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
    isRefreshing,
    onRefresh,
    guildId,
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
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un monstre..."
                        value={filters.searchQuery}
                        onChange={(e) => updateFilter("searchQuery", e.target.value)}
                        className="pl-12 h-12 text-base bg-black/30 border-white/10 rounded-xl"
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

                <Button
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="h-12 w-12 border-white/10 bg-black/30 rounded-xl shrink-0 hover:bg-white/5 transition-colors"
                    title="Synchroniser avec Metamob"
                >
                    <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
                </Button>

                <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block" />

                <OcreExchangeModal
                    guildId={guildId}
                    trigger={
                        <Button
                            size="lg"
                            className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-900/20 rounded-xl font-semibold gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Sparkles className="h-5 w-5 fill-white/20" />
                            Place de Marché
                        </Button>
                    }
                />
            </div>

            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type Selector - Large Pills */}
                <div className="flex items-center rounded-xl bg-black/40 border border-white/10 p-1.5 overflow-x-auto max-w-full no-scrollbar">
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
                                        ? "bg-zinc-800 text-white shadow-md border border-white/10"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-4 w-4" />
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
                                "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2 hover:bg-black/50 transition-all",
                                filters.selectedStep !== "all" && "border-amber-500/50 bg-amber-500/10 text-amber-200"
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
                                "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2 hover:bg-black/50 transition-all",
                                filters.sortBy !== "step-asc" && "border-blue-500/50 bg-blue-500/10 text-blue-200"
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
                                    "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2 max-w-[200px] hover:bg-black/50 transition-all",
                                    filters.selectedZone !== "all" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
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
                                "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2 hover:bg-black/50 transition-all",
                                filters.minQuantity > 0 && "border-purple-500/50 bg-purple-500/10 text-purple-200"
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

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
    sortBy: SortOption;
    showExchangeableOnly: boolean;
}

interface OcreFilterBarProps {
    filters: OcreFilters;
    onFiltersChange: (filters: OcreFilters) => void;
    steps: number[];
    zones: string[];
    exchangeableCount: number;
    isRefreshing: boolean;
    onRefresh: () => void;
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

// =============================================================================
// COMPONENT
// =============================================================================

export function OcreFilterBar({
    filters,
    onFiltersChange,
    steps,
    zones,
    exchangeableCount,
    isRefreshing,
    onRefresh,
}: OcreFilterBarProps) {
    const updateFilter = <K extends keyof OcreFilters>(key: K, value: OcreFilters[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const hasActiveFilters =
        filters.searchQuery.trim() !== "" ||
        filters.selectedType !== "all" ||
        filters.selectedStep !== "all" ||
        filters.selectedZone !== "all" ||
        filters.sortBy !== "step-asc" ||
        filters.showExchangeableOnly;

    const clearFilters = () => {
        onFiltersChange({
            searchQuery: "",
            selectedType: "all",
            selectedStep: "all",
            selectedZone: "all",
            sortBy: "step-asc",
            showExchangeableOnly: false,
        });
    };

    const currentSort = SORT_OPTIONS.find(s => s.id === filters.sortBy);
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
                    className="h-12 w-12 border-white/10 bg-black/30 rounded-xl shrink-0"
                    title="Synchroniser avec Metamob"
                >
                    <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
                </Button>
            </div>

            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type Selector - Large Pills */}
                <div className="flex items-center rounded-xl bg-black/40 border border-white/10 p-1.5">
                    {MONSTER_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isActive = filters.selectedType === type.id;
                        return (
                            <button
                                key={type.id}
                                onClick={() => updateFilter("selectedType", type.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                                    isActive
                                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 shadow-lg"
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
                                "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2",
                                filters.selectedStep !== "all" && "border-amber-500/50 bg-amber-500/10 text-amber-300"
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
                                "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2",
                                filters.sortBy !== "step-asc" && "border-blue-500/50 bg-blue-500/10 text-blue-300"
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
                                    "h-12 px-5 text-sm font-semibold border-white/10 bg-black/30 rounded-xl gap-2 max-w-[200px]",
                                    filters.selectedZone !== "all" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
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

                {/* Divider */}
                <div className="hidden sm:block w-px h-10 bg-white/10" />

                {/* Exchangeable Toggle - Large & Visible */}
                <button
                    onClick={() => updateFilter("showExchangeableOnly", !filters.showExchangeableOnly)}
                    disabled={exchangeableCount === 0}
                    title={exchangeableCount === 0 ? "Aucun guildeux n'a de doublons à proposer" : "Filtrer les monstres échangeables"}
                    className={cn(
                        "flex items-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold transition-all border",
                        filters.showExchangeableOnly
                            ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/50 shadow-lg"
                            : exchangeableCount > 0
                                ? "bg-black/30 text-zinc-300 border-white/10 hover:text-white hover:border-emerald-500/30"
                                : "bg-black/20 text-zinc-600 border-white/5 cursor-not-allowed opacity-50"
                    )}
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Échangeables</span>
                    <span className="sm:hidden">Éch.</span>
                    {exchangeableCount > 0 ? (
                        <Badge className="bg-emerald-500/30 text-emerald-200 border-0 text-xs px-2">
                            {exchangeableCount}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="text-xs px-2 opacity-50">
                            0
                        </Badge>
                    )}
                </button>
            </div>
        </div>
    );
}

"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";

// =============================================================================
// OCRE FILTER BAR - Modern, readable filters with premium glassmorphism
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

    return (
        <div className="bg-[#12181a]/80 backdrop-blur-xl border border-border rounded-3xl p-5 md:p-6 space-y-5 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
            {/* Search & Primary Actions Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                {/* Search Input */}
                <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors duration-200" />
                    <Input
                        placeholder="Rechercher un monstre..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        className="pl-10 h-11 text-sm bg-[#161e20]/70 focus:bg-[#1a2426]/90 border border-border focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 rounded-2xl transition-all duration-300 placeholder:text-muted-foreground text-foreground shadow-inner"
                    />
                    {localSearch && (
                        <button
                            onClick={() => setLocalSearch("")}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-11 px-4 text-xs text-muted-foreground hover:text-foreground font-bold rounded-2xl hover:bg-surface transition-all duration-200 border border-transparent hover:border-border"
                        >
                            Réinitialiser
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSelectionModeToggle}
                        className={cn(
                            "h-11 px-5 rounded-2xl text-xs font-bold gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border",
                            selectionMode
                                ? "bg-amber-500 text-warning-foreground border-amber-500 shadow-lg shadow-amber-500/25"
                                : "bg-[#161e20]/60 text-foreground border-border hover:bg-[#202a2c] hover:border-border"
                        )}
                    >
                        <Check className="h-4 w-4" />
                        <span>{selectionMode ? "Quitter" : "Sélectionner"}</span>
                    </Button>

                    {showMarketplace && (
                        <OcreExchangeModal
                            guildId={guildId}
                            hasOcreChannel={hasOcreChannel}
                            trigger={
                                <Button
                                    size="sm"
                                    className="h-11 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-foreground border-0 shadow-lg shadow-emerald-950/50 rounded-2xl font-bold gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-xs"
                                >
                                    <Sparkles className="h-4 w-4 fill-white/25" />
                                    <span>Échanges</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "h-10 px-4 text-xs font-semibold rounded-2xl gap-2 border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                filters.selectedType !== "all"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 "
                                    : "border-border bg-[#161e20]/60 text-foreground hover:bg-[#202a2d] hover:border-border"
                            )}
                        >
                            {filters.selectedType === "all" ? (
                                <><Swords className="h-3.5 w-3.5" />Tous types</>
                            ) : filters.selectedType === "boss" ? (
                                <><Skull className="h-3.5 w-3.5 text-red-400" />Boss</>
                            ) : (
                                <><Crown className="h-3.5 w-3.5 text-amber-500" />Archimonstres</>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#13191b] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 z-[100] min-w-[160px]">
                        {MONSTER_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                                <DropdownMenuItem
                                    key={type.id}
                                    onClick={() => updateFilter("selectedType", type.id)}
                                    className="text-xs py-2.5 px-3.5 gap-2.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {type.label}
                                    {filters.selectedType === type.id && <Check className="h-3 w-3 ml-auto text-amber-500" />}
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
                                "h-10 px-4 text-xs font-semibold rounded-2xl gap-2 border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                filters.selectedStep !== "all"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 "
                                    : "border-border bg-[#161e20]/60 text-foreground hover:bg-[#202a2d] hover:border-border"
                            )}
                        >
                            <Footprints className="h-3.5 w-3.5" />
                            {filters.selectedStep === "all" ? "Toutes étapes" : `Étape ${filters.selectedStep}`}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto bg-[#13191b] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 z-[100] min-w-[160px]">
                        <DropdownMenuItem
                            onClick={() => updateFilter("selectedStep", "all")}
                            className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                        >
                            Toutes étapes
                            {filters.selectedStep === "all" && <Check className="h-3 w-3 ml-auto text-amber-500" />}
                        </DropdownMenuItem>
                        {steps.map((step) => (
                            <DropdownMenuItem
                                key={step}
                                onClick={() => updateFilter("selectedStep", step.toString())}
                                className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                            >
                                Étape {step}
                                {filters.selectedStep === step.toString() && <Check className="h-3 w-3 ml-auto text-amber-500" />}
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
                                "h-10 px-4 text-xs font-semibold rounded-2xl gap-2 border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                filters.sortBy !== "step-asc"
                                    ? "border-blue-500/40 bg-blue-500/10 text-blue-400 "
                                    : "border-border bg-[#161e20]/60 text-foreground hover:bg-[#202a2d] hover:border-border"
                            )}
                        >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            {currentSort?.label || "Tri"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#13191b] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 z-[100] min-w-[185px]">
                        {SORT_OPTIONS.map((sort) => (
                            <DropdownMenuItem
                                key={sort.id}
                                onClick={() => updateFilter("sortBy", sort.id)}
                                className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                            >
                                {sort.label}
                                {filters.sortBy === sort.id && <Check className="h-3 w-3 ml-auto text-blue-400" />}
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
                                    "h-10 px-4 text-xs font-semibold rounded-2xl gap-2 border max-w-[180px] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                    filters.selectedZone !== "all"
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 "
                                        : "border-border bg-[#161e20]/60 text-foreground hover:bg-[#202a2d] hover:border-border"
                                )}
                            >
                                <span className="truncate">
                                    {filters.selectedZone === "all" ? "Toutes zones" : filters.selectedZone}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto bg-[#13191b] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 z-[100] min-w-[200px]">
                            <DropdownMenuItem
                                onClick={() => updateFilter("selectedZone", "all")}
                                className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                            >
                                Toutes zones
                                {filters.selectedZone === "all" && <Check className="h-3 w-3 ml-auto text-emerald-500" />}
                            </DropdownMenuItem>
                            {zones.map((zone) => (
                                <DropdownMenuItem
                                    key={zone}
                                    onClick={() => updateFilter("selectedZone", zone)}
                                    className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                                >
                                    <span className="truncate flex-1">{zone}</span>
                                    {filters.selectedZone === zone && <Check className="h-3 w-3 ml-auto text-emerald-500 shrink-0" />}
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
                                "h-10 px-4 text-xs font-semibold rounded-2xl gap-2 border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                filters.minQuantity > 0
                                    ? "border-purple-500/40 bg-purple-500/10 text-purple-400 "
                                    : "border-border bg-[#161e20]/60 text-foreground hover:bg-[#202a2d] hover:border-border"
                            )}
                        >
                            <Crown className="h-3.5 w-3.5" />
                            {currentQty?.label || "Quantité"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#13191b] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 z-[100] min-w-[180px]">
                        {QUANTITY_OPTIONS.map((q) => (
                            <DropdownMenuItem
                                key={q.value}
                                onClick={() => updateFilter("minQuantity", q.value)}
                                className="text-xs py-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-surface text-foreground hover:text-foreground transition-colors"
                            >
                                {q.label}
                                {filters.minQuantity === q.value && <Check className="h-3 w-3 ml-auto text-purple-400" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Active filters summary badge */}
                {hasActiveFilters && (
                    <Badge className="h-6 px-2.5 text-caption font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                        Filtres actifs
                    </Badge>
                )}
            </div>
        </div>
    );
}
